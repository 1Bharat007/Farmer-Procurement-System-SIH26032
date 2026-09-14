import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from .services import send_sms
from .models import Notification

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Language-aware SMS template builder
# ---------------------------------------------------------------------------

def _booking_confirmation_text(farmer, centre, date_str, start_time_str, end_time_str, booking) -> str:
    """
    Returns a booking confirmation SMS in the farmer's preferred language.
    Falls back to English if the language code is unrecognised.
    """
    lang = getattr(farmer, "preferred_language", "hi")
    token_short = str(booking.qr_code_token)[:8]

    if lang == "pa":
        # Punjabi (Gurmukhi) — SMS is Unicode; Fast2SMS Quick-SMS route supports it
        return (
            f"ਕਿਸਾਨਸਲਾਟ: {farmer.full_name} ਜੀ, ਤੁਹਾਡੀ ਡਿਲੀਵਰੀ ਪੱਕੀ ਹੋ ਗਈ! "
            f"ਮੰਡੀ: {centre.name}. ਤਾਰੀਖ: {date_str} ({start_time_str} - {end_time_str}). "
            f"ਮਾਤਰਾ: {booking.quantity_kg}kg. ਟੋਕਨ: {token_short}. "
            f"ਗੇਟ 'ਤੇ QR ਕੋਡ ਦਿਖਾਓ।"
        )
    elif lang == "hi":
        return (
            f"किसानस्लॉट: {farmer.full_name} जी, आपकी डिलीवरी कन्फर्म हो गई! "
            f"मंडी: {centre.name}. दिनांक: {date_str} ({start_time_str} - {end_time_str}). "
            f"मात्रा: {booking.quantity_kg}kg. टोकन: {token_short}. "
            f"गेट पर QR कोड दिखाएं।"
        )
    else:
        # English (default)
        return (
            f"KisanSlot: Delivery confirmed for {farmer.full_name}! "
            f"Mandi: {centre.name}. Date: {date_str} ({start_time_str} - {end_time_str}). "
            f"Qty: {booking.quantity_kg}kg. Token: {token_short}. "
            f"Carry your QR code for gate check-in."
        )


def _slot_reminder_text(farmer, centre_name, booking_id, start_time_str) -> str:
    """
    Returns a slot reminder SMS in the farmer's preferred language.
    """
    lang = getattr(farmer, "preferred_language", "hi")

    if lang == "pa":
        return (
            f"ਕਿਸਾਨਸਲਾਟ ਯਾਦ-ਦਹਾਨੀ (ਬੁਕਿੰਗ #{booking_id}): "
            f"ਅੱਜ {start_time_str} ਨੂੰ {centre_name} ਵਿਖੇ ਤੁਹਾਡੀ ਫ਼ਸਲ ਡਿਲੀਵਰੀ ਹੈ। "
            f"ਮੰਡੀ ਗੇਟ 'ਤੇ QR ਟੋਕਨ ਜ਼ਰੂਰ ਦਿਖਾਓ।"
        )
    elif lang == "hi":
        return (
            f"किसानस्लॉट रिमाइंडर (बुकिंग #{booking_id}): "
            f"आज {start_time_str} बजे {centre_name} में आपकी फसल डिलीवरी है। "
            f"मंडी गेट पर QR टोकन दिखाएं।"
        )
    else:
        return (
            f"KisanSlot Reminder (Booking #{booking_id}): Your crop delivery at "
            f"{centre_name} is scheduled for {start_time_str} today. "
            f"Please show your QR token at the mandi gate."
        )


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_booking_confirmation_sms(self, booking_id: int):
    """
    Celery task dispatched immediately after a booking is confirmed.
    Sends an SMS confirmation in the farmer's preferred language and logs
    an in-app Notification record.
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

        sms_text = _booking_confirmation_text(
            farmer, centre, date_str, start_time_str, end_time_str, booking
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
            f"[CELERY SMS] Confirmation dispatched for Booking #{booking.id} "
            f"to +91-{farmer.phone_number} (lang={farmer.preferred_language}): "
            f"success={res.get('success')}"
        )
        return f"Confirmation SMS for booking #{booking.id}: {res}"

    except Exception as exc:
        logger.error(f"[CELERY SMS ERROR] Confirmation SMS task failed for booking #{booking_id}: {exc}")
        try:
            return self.retry(exc=exc)
        except Exception:
            return f"Failed: {exc}"


@shared_task
def send_slot_reminders():
    """
    Celery Beat periodic task executed every 5 minutes.
    Finds bookings for today whose time slot starts ~1 hour from now (45-75 minutes),
    and sends reminder SMS in each farmer's preferred language to those who
    haven't received one yet.
    """
    from bookings.models import Booking

    now = timezone.localtime()
    today = now.date()

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
        sms_text = _slot_reminder_text(
            farmer, booking.slot.centre.name, booking.id, start_time_str
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
