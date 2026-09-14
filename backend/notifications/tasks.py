import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from .services import send_sms
from .models import Notification

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_booking_confirmation_sms(self, booking_id: int):
    """
    Celery task dispatched immediately after a booking is confirmed.
    Sends an SMS confirmation to the farmer and logs an in-app Notification record.
    Never blocks the request/response HTTP cycle.
    """
    try:
        from bookings.models import Booking

        booking = (
            Booking.objects.select_related("farmer", "slot", "slot__centre")
            .filter(id=booking_id)
            .first()
        )
        if not booking:
            logger.warning(f"[CELERY SMS] Booking #{booking_id} not found.")
            return f"Booking #{booking_id} not found."

        farmer = booking.farmer
        slot = booking.slot
        centre = slot.centre

        start_time_str = slot.start_time.strftime("%I:%M %p")
        end_time_str = slot.end_time.strftime("%I:%M %p")
        date_str = slot.date.strftime("%d-%b-%Y")

        sms_text = (
            f"KisanSlot: Delivery confirmed for {farmer.full_name}! "
            f"Mandi: {centre.name}. Date: {date_str} ({start_time_str} - {end_time_str}). "
            f"Qty: {booking.quantity_kg}kg. Token: {str(booking.qr_code_token)[:8]}. "
            f"Carry your QR code for gate check-in."
        )

        res = send_sms(farmer.phone_number, sms_text)

        # Log an in-app Notification for persistence
        Notification.objects.create(
            recipient=farmer,
            title="Slot Booking Confirmed",
            message=sms_text,
            notification_type="slot_confirmation",
        )

        logger.info(
            f"[CELERY SMS] Confirmation dispatched for Booking #{booking.id} to +91-{farmer.phone_number}: success={res.get('success')}"
        )
        return f"Confirmation SMS for booking #{booking.id}: {res}"

    except Exception as exc:
        logger.error(f"[CELERY SMS ERROR] Confirmation SMS task failed for booking #{booking_id}: {exc}")
        # Retry with exponential backoff if Celery is running
        try:
            return self.retry(exc=exc)
        except Exception:
            return f"Failed: {exc}"


@shared_task
def send_slot_reminders():
    """
    Celery Beat periodic task executed every 5 minutes.
    Finds bookings for today whose time slot starts ~1 hour from now (45 - 75 minutes),
    and sends reminder SMS to farmers who haven't received one yet.
    """
    from bookings.models import Booking

    now = timezone.localtime()
    today = now.date()
    current_time = now.time()

    # Time window: 45 minutes to 75 minutes from now
    target_start = (now + timedelta(minutes=45)).time()
    target_end = (now + timedelta(minutes=75)).time()

    candidate_bookings = Booking.objects.filter(
        slot__date=today,
        slot__start_time__gte=target_start,
        slot__start_time__lte=target_end,
        status="booked",
    ).select_related("farmer", "slot", "slot__centre")

    sent_count = 0
    for booking in candidate_bookings:
        farmer = booking.farmer
        # Avoid duplicate reminders
        already_notified = Notification.objects.filter(
            recipient=farmer,
            notification_type="slot_reminder",
            created_at__date=today,
            message__contains=f"Booking #{booking.id}",
        ).exists()

        if already_notified:
            continue

        start_time_str = booking.slot.start_time.strftime("%I:%M %p")
        sms_text = (
            f"KisanSlot Reminder (Booking #{booking.id}): Your crop delivery at "
            f"{booking.slot.centre.name} is scheduled for {start_time_str} today. "
            f"Please show your QR token at the mandi gate."
        )

        send_sms(farmer.phone_number, sms_text)

        Notification.objects.create(
            recipient=farmer,
            title="Slot Delivery Reminder",
            message=sms_text,
            notification_type="slot_reminder",
        )
        sent_count += 1

    logger.info(f"[CELERY BEAT] Checked slot reminders: {sent_count} sent.")
    return f"Slot reminders sent: {sent_count}"
