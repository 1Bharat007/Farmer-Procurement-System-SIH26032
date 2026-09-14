import json
import logging
import urllib.request
import urllib.error
from django.conf import settings

logger = logging.getLogger(__name__)

FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


def clean_indian_phone(phone_number: str) -> str:
    """
    Cleans and normalizes an Indian phone number to 10 digits.
    Strips '+91', leading '0', spaces, and dashes.
    """
    if not phone_number:
        return ""
    cleaned = str(phone_number).strip().replace(" ", "").replace("-", "")
    if cleaned.startswith("+91"):
        cleaned = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]
    return cleaned


def send_sms(phone_number: str, message: str, otp_code: str = None) -> dict:
    """
    Dispatches an SMS notification using Fast2SMS API.
    Uses:
      - 'otp' route if otp_code is provided (optimized for 6-digit OTPs)
      - 'q' (Quick SMS) route for general text messages (booking confirmation, reminders)

    Graceful Error Handling:
      - Never raises unhandled exceptions.
      - Returns a standardized dict: {'success': bool, 'data': dict | None, 'error': str | None}
      - If API key is missing or call fails, returns success=False with the reason,
        allowing callers to log or use console fallbacks.
    """
    clean_phone = clean_indian_phone(phone_number)
    if not clean_phone or len(clean_phone) != 10 or not clean_phone.isdigit():
        err_msg = f"Invalid 10-digit mobile number format: '{phone_number}'"
        logger.warning(f"[FAST2SMS] {err_msg}")
        return {"success": False, "error": err_msg, "phone": clean_phone}

    api_key = getattr(settings, "FAST2SMS_API_KEY", "")
    if not api_key:
        err_msg = "FAST2SMS_API_KEY is not configured in environment or settings."
        logger.warning(f"[FAST2SMS] {err_msg}")
        return {"success": False, "error": err_msg, "phone": clean_phone}

    headers = {
        "authorization": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    if otp_code:
        payload = {
            "route": "otp",
            "variables_values": str(otp_code),
            "numbers": clean_phone,
        }
    else:
        payload = {
            "route": "q",
            "message": message,
            "language": "english",
            "flash": 0,
            "numbers": clean_phone,
        }

    try:
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(FAST2SMS_URL, data=data_bytes, headers=headers, method="POST")

        with urllib.request.urlopen(req, timeout=5) as response:
            resp_bytes = response.read()
            resp_json = json.loads(resp_bytes.decode("utf-8"))

            is_return = resp_json.get("return", False)
            if is_return:
                logger.info(f"[FAST2SMS SUCCESS] SMS dispatched to +91-{clean_phone}. Request ID: {resp_json.get('request_id')}")
                return {"success": True, "data": resp_json, "error": None, "phone": clean_phone}
            else:
                err_msg = resp_json.get("message", "Fast2SMS returned failure response.")
                logger.warning(f"[FAST2SMS REJECTED] +91-{clean_phone}: {err_msg}")
                return {"success": False, "data": resp_json, "error": str(err_msg), "phone": clean_phone}

    except urllib.error.HTTPError as he:
        try:
            err_body = he.read().decode("utf-8")
            err_json = json.loads(err_body)
            err_detail = err_json.get("message") or err_body
        except Exception:
            err_detail = str(he)
        logger.error(f"[FAST2SMS HTTP ERROR] Status {he.code} sending to {clean_phone}: {err_detail}")
        return {"success": False, "error": f"HTTP {he.code}: {err_detail}", "phone": clean_phone}

    except urllib.error.URLError as ue:
        logger.error(f"[FAST2SMS NETWORK ERROR] Failed connecting to gateway: {ue.reason}")
        return {"success": False, "error": f"Network unreachable: {ue.reason}", "phone": clean_phone}

    except Exception as exc:
        logger.error(f"[FAST2SMS UNEXPECTED ERROR] {exc}")
        return {"success": False, "error": str(exc), "phone": clean_phone}
