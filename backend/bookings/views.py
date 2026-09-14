import logging
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Slot, Booking, PaymentStatus
from .serializers import SlotSerializer, BookingSerializer, PaymentStatusSerializer
from accounts.permissions import IsOwnerOrCentreOperatorOrAdmin, IsAdminOrReadOnly

logger = logging.getLogger(__name__)


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

    def perform_create(self, serializer):
        user = self.request.user
        # If user is farmer or operator booking on farmer's behalf
        farmer = serializer.validated_data.get('farmer')
        if not farmer or not user.is_staff:
            booking = serializer.save(farmer=user)
        else:
            booking = serializer.save()

        # Trigger async confirmation SMS via Celery
        try:
            from notifications.tasks import send_booking_confirmation_sms
            send_booking_confirmation_sms.delay(booking.id)
        except Exception as exc:
            logger.warning(f"Could not dispatch confirmation SMS for Booking #{booking.id}: {exc}")

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

        return Response({
            "status": "success",
            "message": "Farmer checked in successfully.",
            "booking_id": booking.id,
            "token_number": token.token_number,
        })

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_booking(self, request, pk=None):
        """
        Cancel a booking and release slot capacity.
        """
        booking = self.get_object()
        if booking.status in ['completed', 'cancelled']:
            return Response(
                {"error": f"Cannot cancel booking with status '{booking.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = 'cancelled'
        booking.save(update_fields=['status', 'updated_at'])

        if booking.slot.booked_count > 0:
            booking.slot.booked_count -= 1
            booking.slot.save(update_fields=['booked_count'])

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
