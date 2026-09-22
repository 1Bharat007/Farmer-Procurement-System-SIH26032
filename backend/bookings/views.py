import logging
from django.db import transaction, DatabaseError, OperationalError
from rest_framework import viewsets, permissions, status, exceptions
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Slot, Booking, PaymentStatus
from .serializers import SlotSerializer, BookingSerializer, PaymentStatusSerializer
from accounts.permissions import IsOwnerOrCentreOperatorOrAdmin, IsAdminOrReadOnly
from core.throttling import BookingRateThrottle

logger = logging.getLogger('bookings')


class BookingsRootView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            "message": "Slot Bookings endpoint ready",
            "module": "bookings"
        }, status=status.HTTP_200_OK)


class SlotViewSet(viewsets.ModelViewSet):
    """
    ViewSet for available delivery time slots.
    - Anyone can browse available slots
    - Centre Operators and Admins can create and manage slots
    """
    serializer_class = SlotSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Slot.objects.all().select_related('centre')
        centre_id = self.request.query_params.get('centre')
        date = self.request.query_params.get('date')
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')

        if centre_id:
            queryset = queryset.filter(centre_id=centre_id)
        if date:
            queryset = queryset.filter(date=date)
        if from_date:
            queryset = queryset.filter(date__gte=from_date)
        if to_date:
            queryset = queryset.filter(date__lte=to_date)

        return queryset.order_by('date', 'start_time')


class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for crop intake slot bookings.
    - Farmers see only their own bookings
    - Centre Operators see bookings for their assigned centre
    - Admins see all bookings
    """
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrCentreOperatorOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Booking.objects.all().select_related('farmer', 'slot', 'slot__centre', 'payment', 'queue_token')

        if hasattr(user, 'centre_operator') and user.centre_operator.is_active:
            centre = user.centre_operator.centre
            return Booking.objects.filter(slot__centre=centre).select_related(
                'farmer', 'slot', 'slot__centre', 'payment', 'queue_token'
            )

        return Booking.objects.filter(farmer=user).select_related(
            'farmer', 'slot', 'slot__centre', 'payment', 'queue_token'
        )

    def get_throttles(self):
        if self.action == 'create':
            return [BookingRateThrottle()]
        return super().get_throttles()

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except (OperationalError, DatabaseError) as exc:
            logger.warning(f"Concurrent booking conflict detected: {exc}")
            return Response(
                {"error": "This slot is no longer available or is currently being booked. Please try another slot."},
                status=status.HTTP_400_BAD_REQUEST
            )

    def perform_create(self, serializer):
        user = self.request.user
        farmer = serializer.validated_data.get('farmer')
        slot = serializer.validated_data.get('slot')
        slot_id = slot.id if slot else self.request.data.get('slot')

        with transaction.atomic():
            if slot_id:
                try:
                    locked_slot = Slot.objects.select_for_update().get(pk=slot_id)
                except Slot.DoesNotExist:
                    raise exceptions.ValidationError({"slot": "Invalid slot specified."})

                if locked_slot.booked_count >= locked_slot.capacity:
                    raise exceptions.ValidationError({
                        "slot": "This slot is fully booked and no longer available. Please choose another slot."
                    })

                locked_slot.booked_count += 1
                locked_slot.save(update_fields=['booked_count'])
                serializer.validated_data['slot'] = locked_slot

            if not farmer or not user.is_staff:
                booking = serializer.save(farmer=user)
            else:
                booking = serializer.save()

        logger.info(
            f"[BOOKING CREATED] Booking #{booking.id} created for farmer {booking.farmer.phone_number} "
            f"at centre {booking.slot.centre.name} (Slot: {booking.slot.date} "
            f"{booking.slot.start_time.strftime('%I:%M %p')}-{booking.slot.end_time.strftime('%I:%M %p')}, "
            f"Qty: {booking.quantity_kg}kg)"
        )

        # Trigger async confirmation SMS via Celery (isolated with graceful degradation)
        try:
            from notifications.tasks import send_booking_confirmation_sms
            send_booking_confirmation_sms.delay(booking.id)
            logger.info(f"[SMS QUEUED] Confirmation SMS task queued for Booking #{booking.id}")
        except Exception as exc:
            # Graceful degradation: never fail booking creation if Celery/Redis queueing fails
            logger.warning(
                f"[CELERY/REDIS DEGRADED] Could not dispatch confirmation SMS for Booking #{booking.id}: {exc}"
            )

    @action(detail=False, methods=['post'], url_path='check-in-qr')
    def check_in_by_qr(self, request):
        """
        Admin/Operator QR-based check-in endpoint.
        Accepts a qr_code_token (UUID string), validates:
          1. Matching booking exists
          2. Booking is for today's operating date
          3. Booking hasn't already been checked in or completed
        Updates status to 'checked_in', generates sequential queue token,
        and broadcasts real-time queue update.
        """
        qr_token_str = str(
            request.data.get('qr_code_token') or
            request.data.get('token') or
            ''
        ).strip()

        if not qr_token_str:
            return Response(
                {"error": "Please provide a valid qr_code_token."},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking = Booking.objects.filter(
            qr_code_token=qr_token_str
        ).select_related('farmer', 'slot', 'slot__centre').first()

        if not booking:
            return Response(
                {"error": "Invalid or non-existent QR token."},
                status=status.HTTP_404_NOT_FOUND
            )

        today = timezone.localdate()
        if booking.slot.date != today:
            return Response(
                {
                    "error": f"Invalid check-in date: Booking is for {booking.slot.date.strftime('%d-%b-%Y')}, not today ({today.strftime('%d-%b-%Y')})."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if booking.status in ['checked_in', 'in_queue', 'completed']:
            return Response(
                {
                    "error": f"Invalid or already-used QR code. Current status: {booking.get_status_display()}."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if booking.status == 'cancelled':
            return Response(
                {"error": "Cannot check in a cancelled booking."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark as checked-in
        booking.status = 'checked_in'
        booking.save(update_fields=['status', 'updated_at'])

        # Auto-create queue token if not exists
        from queue_app.models import QueueToken
        from django.db.models import Max

        token_num = (
            QueueToken.objects.filter(centre=booking.slot.centre, date=today)
            .aggregate(Max('token_number'))['token_number__max'] or 0
        ) + 1

        queue_token, _ = QueueToken.objects.get_or_create(
            booking=booking,
            defaults={
                'centre': booking.slot.centre,
                'date': today,
                'token_number': token_num,
                'status': 'waiting',
                'estimated_wait_minutes': 20,
            }
        )

        # Trigger queue broadcast
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"queue_{booking.slot.centre_id}",
                    {
                        "type": "queue.update",
                        "message": {
                            "event": "farmer_checked_in",
                            "booking_id": booking.id,
                            "farmer_name": booking.farmer.full_name,
                            "token_number": queue_token.token_number,
                        }
                    }
                )
        except Exception as exc:
            logger.warning(f"Queue broadcast error: {exc}")

        # Structured logging for QR check-in
        logger.info(
            f"[CHECK-IN QR] Farmer {booking.farmer.phone_number} checked in for Booking #{booking.id} "
            f"with Token #{queue_token.token_number} at {booking.slot.centre.name}"
        )

        return Response({
            "status": "success",
            "message": f"Farmer {booking.farmer.full_name} checked in successfully.",
            "farmer_name": booking.farmer.full_name,
            "phone_number": booking.farmer.phone_number,
            "booking_id": booking.id,
            "token_number": queue_token.token_number,
            "centre_name": booking.slot.centre.name,
            "quantity_kg": str(booking.quantity_kg),
            "time_window": f"{booking.slot.start_time.strftime('%I:%M %p')} - {booking.slot.end_time.strftime('%I:%M %p')}",
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='check-in')
    def check_in(self, request, pk=None):
        """
        Mark farmer as checked-in at the centre gate and generate queue token.
        """
        booking = self.get_object()
        if booking.status in ['completed', 'cancelled']:
            return Response(
                {"error": f"Cannot check in a booking with status '{booking.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = 'checked_in'
        booking.save(update_fields=['status', 'updated_at'])

        # Auto-create queue token if not exists
        from queue_app.models import QueueToken
        from django.db.models import Max

        token, created = QueueToken.objects.get_or_create(
            booking=booking,
            defaults={
                'centre': booking.slot.centre,
                'date': booking.slot.date,
                'token_number': (
                    QueueToken.objects.filter(centre=booking.slot.centre, date=booking.slot.date)
                    .aggregate(Max('token_number'))['token_number__max'] or 0
                ) + 1,
                'status': 'waiting',
                'estimated_wait_minutes': 20,
            }
        )

        # Trigger queue broadcast
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"queue_{booking.slot.centre_id}",
                    {
                        "type": "queue.update",
                        "message": {
                            "event": "farmer_checked_in",
                            "booking_id": booking.id,
                            "farmer_name": booking.farmer.full_name,
                            "token_number": token.token_number,
                        }
                    }
                )
        except Exception as exc:
            logger.warning(f"Queue broadcast error: {exc}")

        logger.info(
            f"[CHECK-IN MANUAL] Farmer {booking.farmer.phone_number} checked in for Booking #{booking.id} "
            f"with Token #{token.token_number} at {booking.slot.centre.name}"
        )

        return Response({
            "status": "success",
            "message": "Farmer checked in successfully.",
            "booking_id": booking.id,
            "token_number": token.token_number,
        })

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_booking(self, request, pk=None):
        """
        Cancel a booking and release slot capacity atomically.
        """
        with transaction.atomic():
            booking = Booking.objects.select_for_update().filter(pk=pk).first()
            if not booking:
                return Response(
                    {"error": "Booking not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

            self.check_object_permissions(request, booking)

            if booking.status in ['completed', 'cancelled']:
                return Response(
                    {"error": f"Cannot cancel booking with status '{booking.status}'."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            booking.status = 'cancelled'
            booking.save(update_fields=['status', 'updated_at'])

            locked_slot = Slot.objects.select_for_update().filter(pk=booking.slot_id).first()
            if locked_slot and locked_slot.booked_count > 0:
                locked_slot.booked_count -= 1
                locked_slot.save(update_fields=['booked_count'])

            logger.info(
                f"[BOOKING CANCELLED] Booking #{booking.id} cancelled by user {request.user.phone_number}. "
                f"Released capacity for Slot #{booking.slot_id}."
            )

        return Response({
            "status": "success",
            "message": "Booking cancelled successfully.",
            "booking_id": booking.id,
        })


class PaymentStatusViewSet(viewsets.ModelViewSet):
    """
    ViewSet for DBT payment statuses.
    - Farmers see only payments for their own bookings
    - Centre Operators see payments for bookings at their centre
    - Admins see all payments
    """
    serializer_class = PaymentStatusSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrCentreOperatorOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return PaymentStatus.objects.all().select_related('booking', 'booking__farmer')

        if hasattr(user, 'centre_operator') and user.centre_operator.is_active:
            centre = user.centre_operator.centre
            return PaymentStatus.objects.filter(booking__slot__centre=centre).select_related(
                'booking', 'booking__farmer'
            )

        return PaymentStatus.objects.filter(booking__farmer=user).select_related('booking', 'booking__farmer')
