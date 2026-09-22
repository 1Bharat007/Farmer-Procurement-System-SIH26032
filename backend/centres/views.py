from django.utils import timezone
from rest_framework import viewsets, permissions
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from .models import ProcurementCentre, OperatingHours
from .serializers import ProcurementCentreSerializer, OperatingHoursSerializer
from accounts.permissions import IsAdminOrReadOnly
from bookings.models import Booking, Slot
from queue_app.models import QueueToken


class CentresRootView(APIView):
    """
    Module health/root endpoint.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            "message": "Procurement Centres endpoint ready",
            "module": "centres"
        }, status=status.HTTP_200_OK)


class ProcurementCentreViewSet(viewsets.ModelViewSet):
    """
    ViewSet for listing and retrieving procurement centres.
    - Anyone can browse active centres
    - Staff / Admins can modify centres
    """
    serializer_class = ProcurementCentreSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = ProcurementCentre.objects.all().prefetch_related('operating_hours', 'operators')
        district = self.request.query_params.get('district')
        is_active = self.request.query_params.get('is_active')

        if district:
            queryset = queryset.filter(district__iexact=district)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset

    @action(detail=True, methods=['get'], url_path='analytics', permission_classes=[permissions.IsAuthenticated])
    def analytics(self, request, pk=None):
        """
        Real-time analytics for the selected procurement centre.
        Calculates:
        - Today's footfall count (farmers arrived at gate)
        - Average wait time in minutes
        - No-show rate percentage
        - Bookings per time slot distribution
        """
        centre = self.get_object()
        today = timezone.localdate()

        # 1. Today's footfall count (checked-in, in-queue, completed)
        today_active_bookings = Booking.objects.filter(
            slot__centre=centre,
            slot__date=today
        )
        footfall_count = today_active_bookings.filter(
            status__in=['checked_in', 'in_queue', 'completed']
        ).count()
        checked_in_count = today_active_bookings.filter(status='checked_in').count()
        in_queue_count = today_active_bookings.filter(status='in_queue').count()
        completed_count = today_active_bookings.filter(status='completed').count()

        # 2. Average wait time in minutes
        tokens_today = QueueToken.objects.filter(centre=centre, date=today)
        wait_durations = []
        for tok in tokens_today:
            if tok.called_at and tok.created_at and tok.called_at > tok.created_at:
                wait_durations.append((tok.called_at - tok.created_at).total_seconds() / 60.0)
            elif tok.estimated_wait_minutes:
                wait_durations.append(float(tok.estimated_wait_minutes))

        if wait_durations:
            avg_wait_minutes = round(sum(wait_durations) / len(wait_durations), 1)
        else:
            avg_wait_minutes = float(centre.avg_processing_time_minutes or 20)

        # 3. No-show rate
        total_eligible = Booking.objects.filter(
            slot__centre=centre,
            slot__date__lte=today
        ).exclude(status='cancelled').count()
        no_show_count = Booking.objects.filter(
            slot__centre=centre,
            slot__date__lte=today,
            status='no_show'
        ).count()
        no_show_rate = round((no_show_count / total_eligible) * 100, 1) if total_eligible > 0 else 0.0

        # 4. Bookings per time slot
        date_param = request.query_params.get('date', today.isoformat())
        slots = Slot.objects.filter(centre=centre, date=date_param).order_by('start_time')
        slots_chart = []
        for s in slots:
            slots_chart.append({
                "slot_id": s.id,
                "start_time": s.start_time.strftime('%I:%M %p'),
                "end_time": s.end_time.strftime('%I:%M %p'),
                "label": f"{s.start_time.strftime('%I:%M %p')} - {s.end_time.strftime('%I:%M %p')}",
                "booked_count": s.booked_count,
                "capacity": s.capacity,
                "available_capacity": max(0, s.capacity - s.booked_count),
                "fill_percentage": round((s.booked_count / s.capacity) * 100, 1) if s.capacity > 0 else 0.0,
            })

        total_capacity_today = sum(s.capacity for s in slots)
        total_booked_today = sum(s.booked_count for s in slots)

        return Response({
            "status": "success",
            "centre_id": centre.id,
            "centre_name": centre.name,
            "district": centre.district,
            "state": centre.state,
            "date": str(today),
            "footfall_today": footfall_count,
            "footfall_breakdown": {
                "checked_in": checked_in_count,
                "in_queue": in_queue_count,
                "completed": completed_count,
            },
            "avg_wait_time_minutes": avg_wait_minutes,
            "no_show_rate_percent": no_show_rate,
            "no_show_count": no_show_count,
            "total_bookings_evaluated": total_eligible,
            "total_capacity_today": total_capacity_today,
            "total_booked_today": total_booked_today,
            "slots_distribution": slots_chart,
        }, status=status.HTTP_200_OK)



class OperatingHoursViewSet(viewsets.ModelViewSet):
    """
    ViewSet for operating hours of procurement centres.
    """
    serializer_class = OperatingHoursSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = OperatingHours.objects.all().select_related('centre')
        centre_id = self.request.query_params.get('centre')
        if centre_id:
            queryset = queryset.filter(centre_id=centre_id)
        return queryset
