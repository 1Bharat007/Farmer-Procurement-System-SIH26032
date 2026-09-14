from datetime import timedelta
from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
    BaseUserManager,
)
from django.utils import timezone
from django.conf import settings


class FarmerManager(BaseUserManager):
    """
    Custom user manager where phone_number is the unique identifier.
    """
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError("The phone number must be provided.")

        clean_phone = str(phone_number).strip().replace(" ", "").replace("-", "")
        if clean_phone.startswith("+91"):
            clean_phone = clean_phone[3:]

        extra_fields.setdefault("is_active", True)
        user = self.model(phone_number=clean_phone, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("full_name", "Admin")

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(phone_number, password, **extra_fields)


class Farmer(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model representing registered farmers, staff, and system administrators.
    Uses phone_number as USERNAME_FIELD.
    """
    phone_number = models.CharField(
        max_length=15,
        unique=True,
        db_index=True,
        help_text="10-digit Indian mobile number without +91 or leading zeros"
    )
    full_name = models.CharField(max_length=150)
    village = models.CharField(max_length=100, blank=True, default='')
    district = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    preferred_language = models.CharField(max_length=10, default='hi')
    crop_type = models.CharField(max_length=100, default='Wheat')

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = FarmerManager()

    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name = "Farmer / User"
        verbose_name_plural = "Farmers / Users"
        ordering = ['-date_joined']

    def __str__(self):
        return f"{self.full_name} ({self.phone_number}) - {self.district or 'No district'}"

    # Backward compatibility properties for existing serializers/views
    @property
    def phone(self):
        return self.phone_number

    @phone.setter
    def phone(self, value):
        self.phone_number = value

    @property
    def username(self):
        return self.phone_number

    @property
    def farmer_profile(self):
        """Self-reference to ensure user.farmer_profile doesn't break existing code."""
        return self

    @property
    def staff_profile(self):
        """Returns linked centre operator profile if user is an operator."""
        return getattr(self, 'centre_operator', None)


class CentreOperator(models.Model):
    """
    Procurement Centre operator profile linked to a user and assigned ProcurementCentre.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='centre_operator'
    )
    centre = models.ForeignKey(
        'centres.ProcurementCentre',
        on_delete=models.CASCADE,
        related_name='operators'
    )
    badge_number = models.CharField(max_length=50, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Centre Operator"
        verbose_name_plural = "Centre Operators"

    def __str__(self):
        return f"Operator: {self.user.full_name} ({self.badge_number}) @ {self.centre.name}"

    @property
    def role(self):
        return "operator"


class OTPRecord(models.Model):
    """
    Temporary store for 6-digit SMS OTP verification records.
    """
    phone = models.CharField(max_length=15, db_index=True)
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_verified = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def is_valid(self):
        return not self.is_verified and (timezone.now() - self.created_at < timedelta(minutes=5))

    def __str__(self):
        return f"OTP for {self.phone}: {self.otp_code} (Verified: {self.is_verified})"
