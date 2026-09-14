from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from .models import Farmer, CentreOperator, OTPRecord


class FarmerSerializer(serializers.ModelSerializer):
    """
    Serializer for the Farmer custom user model.
    """
    phone = serializers.CharField(source='phone_number', read_only=True)

    class Meta:
        model = Farmer
        fields = [
            'id',
            'phone_number',
            'phone',
            'full_name',
            'village',
            'district',
            'state',
            'preferred_language',
            'crop_type',
            'is_staff',
            'date_joined',
        ]
        read_only_fields = ['id', 'is_staff', 'date_joined']


# Alias for backward compatibility
FarmerProfileSerializer = FarmerSerializer


class CentreOperatorSerializer(serializers.ModelSerializer):
    """
    Serializer for Centre Operator profiles with nested centre details.
    """
    user = FarmerSerializer(read_only=True)
    centre_name = serializers.CharField(source='centre.name', read_only=True)
    centre_district = serializers.CharField(source='centre.district', read_only=True)

    class Meta:
        model = CentreOperator
        fields = [
            'id',
            'user',
            'centre',
            'centre_name',
            'centre_district',
            'badge_number',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SendOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15, required=False)
    phone = serializers.CharField(max_length=15, required=False)

    def validate(self, attrs):
        phone_val = attrs.get('phone_number') or attrs.get('phone')
        if not phone_val:
            raise serializers.ValidationError({"phone_number": "Mobile number is required."})

        cleaned = str(phone_val).strip().replace(" ", "").replace("-", "")
        if cleaned.startswith("+91"):
            cleaned = cleaned[3:]

        if not cleaned.isdigit() or len(cleaned) != 10:
            raise serializers.ValidationError({"phone_number": "Please enter a valid 10-digit mobile number."})

        attrs['phone_number'] = cleaned
        attrs['phone'] = cleaned
        return attrs


class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15, required=False)
    phone = serializers.CharField(max_length=15, required=False)
    otp = serializers.CharField(max_length=6, required=True)
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    village = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    district = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    state = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    preferred_language = serializers.CharField(max_length=10, required=False, default="hi")
    crop_type = serializers.CharField(max_length=100, required=False, default="Wheat")

    def validate(self, attrs):
        phone_val = attrs.get('phone_number') or attrs.get('phone')
        if not phone_val:
            raise serializers.ValidationError({"phone_number": "Mobile number is required."})

        cleaned = str(phone_val).strip().replace(" ", "").replace("-", "")
        if cleaned.startswith("+91"):
            cleaned = cleaned[3:]

        if not cleaned.isdigit() or len(cleaned) != 10:
            raise serializers.ValidationError({"phone_number": "Please enter a valid 10-digit mobile number."})

        attrs['phone_number'] = cleaned
        attrs['phone'] = cleaned

        otp_val = str(attrs.get('otp', '')).strip()
        if not otp_val.isdigit() or len(otp_val) != 6:
            raise serializers.ValidationError({"otp": "OTP must be a 6-digit number."})

        attrs['otp'] = otp_val
        return attrs


class FarmerRegisterSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15, required=False)
    phone_number = serializers.CharField(max_length=15, required=False)
    full_name = serializers.CharField(max_length=150, required=True)
    village = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    district = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    state = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    preferred_language = serializers.CharField(max_length=10, required=False, default="hi")
    crop_type = serializers.CharField(max_length=100, required=False, default="Wheat")

    def validate(self, attrs):
        phone_val = attrs.get('phone_number') or attrs.get('phone')
        if not phone_val:
            raise serializers.ValidationError({"phone_number": "Mobile number is required."})

        cleaned = str(phone_val).strip().replace(" ", "").replace("-", "")
        if cleaned.startswith("+91"):
            cleaned = cleaned[3:]

        if not cleaned.isdigit() or len(cleaned) != 10:
            raise serializers.ValidationError({"phone_number": "Please enter a valid 10-digit mobile number."})

        attrs['phone_number'] = cleaned
        attrs['phone'] = cleaned
        return attrs


class StaffLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT Token Obtain Pair Serializer that accepts username or phone_number.
    Works for CentreOperators, Officers, and Admins.
    """
    username = serializers.CharField(required=False, write_only=True)
    phone_number = serializers.CharField(required=False, write_only=True)
    password = serializers.CharField(required=True, write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.username_field in self.fields:
            self.fields[self.username_field].required = False

    def validate(self, attrs):
        identifier = attrs.get('username') or attrs.get('phone_number') or attrs.get('phone')
        password = attrs.get('password')

        if not identifier:
            raise serializers.ValidationError({"detail": "Must provide a username or phone number."})
        if not password:
            raise serializers.ValidationError({"detail": "Password is required."})

        clean_id = str(identifier).strip().replace(" ", "").replace("-", "")
        if clean_id.startswith("+91"):
            clean_id = clean_id[3:]

        request = self.context.get('request')
        user = authenticate(request, username=clean_id, password=password)
        if user is None:
            user = authenticate(request, phone_number=clean_id, password=password)
        if user is None:
            user = authenticate(request, username=str(identifier).strip(), password=password)

        if not user:
            raise serializers.ValidationError({"detail": "No active account found with the given credentials."})

        if not user.is_active:
            raise serializers.ValidationError({"detail": "User account is disabled."})

        self.user = user
        refresh = self.get_token(user)

        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }

        is_operator = hasattr(user, 'centre_operator') and user.centre_operator.is_active
        role = "centre_operator" if is_operator else ("admin" if user.is_superuser else "farmer")

        data['user'] = {
            'id': user.id,
            'phone_number': user.phone_number,
            'phone': user.phone_number,
            'full_name': user.full_name,
            'role': role,
            'is_staff': user.is_staff,
        }
        if is_operator:
            data['user']['centre_id'] = user.centre_operator.centre_id
            data['user']['centre_name'] = user.centre_operator.centre.name

        return data
