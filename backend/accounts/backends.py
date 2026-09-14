import logging
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

logger = logging.getLogger(__name__)


class PhoneOrUsernameAuthBackend(ModelBackend):
    """
    Authenticate using either phone_number or username alias with password.
    Supports staff, operators, and admin login with demo credentials fallback.
    """
    def authenticate(self, request, username=None, password=None, phone_number=None, **kwargs):
        UserModel = get_user_model()
        identifier = phone_number or username or kwargs.get("phone")

        if not identifier or not password:
            return None

        ident_str = str(identifier).strip()
        clean_id = ident_str.replace(" ", "").replace("-", "")
        if clean_id.startswith("+91"):
            clean_id = clean_id[3:]

        try:
            # 1. Alias matching for demo convenience
            user = None
            ident_lower = ident_str.lower()
            if ident_lower in ["admin", "administrator", "superuser", "officer"]:
                user = UserModel.objects.filter(Q(is_superuser=True) | Q(phone_number="9999999999")).first()
            elif ident_lower in ["operator", "operator_karnal", "karnal"]:
                user = UserModel.objects.filter(phone_number="9876500001").first()
            elif ident_lower in ["operator_panipat", "panipat"]:
                user = UserModel.objects.filter(phone_number="9876500002").first()

            # 2. Standard phone_number search
            if not user:
                query = Q(phone_number=clean_id) | Q(phone_number=ident_str)
                user = UserModel.objects.filter(query).first()

            if not user:
                return None

            # 3. Password validation with demo compatibility
            password_valid = user.check_password(password)

            # Support both 'admin123' and 'adminpassword123' for demo superuser
            if not password_valid and user.is_superuser and password in ["admin123", "adminpassword123"]:
                user.set_password(password)
                user.save(update_fields=["password"])
                password_valid = True

            # Support both 'operator123' and 'operatorpassword123' for staff
            if not password_valid and user.is_staff and password in ["operator123", "operatorpassword123", "admin123", "adminpassword123"]:
                user.set_password(password)
                user.save(update_fields=["password"])
                password_valid = True

            if password_valid and self.user_can_authenticate(user):
                logger.info(f"[AUTH] Successfully authenticated {user.full_name} ({user.phone_number}) via '{identifier}'")
                return user

        except Exception as exc:
            logger.error(f"[AUTH ERROR] Failed during authentication of '{identifier}': {exc}")
            return None

        return None
