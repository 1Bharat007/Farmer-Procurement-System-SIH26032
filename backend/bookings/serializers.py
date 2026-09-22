from django.db import transaction
from rest_framework import serializers
from .models import Slot, Booking, PaymentStatus
from centres.models import ProcurementCentre
from accounts.serializers import FarmerSerializer


class SlotSimpleCentreSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcurementCentre
        fields = ['id', 'name', 'district', 'state', 'daily_capacity', 'avg_processing_time_minutes']


class SlotSerializer(serializers.ModelSerializer):
    """
    Serializer for time slots with nested centre read representation.
    """
    centre_details = SlotSimpleCentreSerializer(source='centre', read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    available_capacity = serializers.IntegerField(read_only=True)

    class Meta:
        model = Slot
        fields = [
            'id',
            'centre',
            'centre_details',
            'date',
            'start_time',
            'end_time',
            'capacity',
            'booked_count',
            'is_full',
            'available_capacity',
            'created_at',
        ]
        read_only_fields = ['id', 'booked_count', 'created_at']


class PaymentStatusSerializer(serializers.ModelSerializer):
    """
    Serializer for direct DBT payment records linked to bookings.
    """
    booking_id = serializers.IntegerField(source='booking.id', read_only=True)
    farmer_name = serializers.CharField(source='booking.farmer.full_name', read_only=True)

    class Meta:
        model = PaymentStatus
        fields = [
            'id',
            'booking',
            'booking_id',
            'farmer_name',
            'amount',
            'status',
            'transaction_reference',
            'paid_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BookingQueueTokenSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    token_number = serializers.IntegerField()
    status = serializers.CharField()
    estimated_wait_minutes = serializers.IntegerField()


class BookingSerializer(serializers.ModelSerializer):
    """
    Serializer for Booking with nested slot, farmer, payment, and queue token representations on read.
    """
    slot_details = SlotSerializer(source='slot', read_only=True)
    farmer_details = FarmerSerializer(source='farmer', read_only=True)
    payment = PaymentStatusSerializer(read_only=True)
    queue_token = BookingQueueTokenSummarySerializer(read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id',
            'farmer',
            'farmer_details',
            'slot',
            'slot_details',
            'status',
            'quantity_kg',
            'qr_code_token',
            'notes',
            'payment',
            'queue_token',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'qr_code_token', 'created_at', 'updated_at']
        extra_kwargs = {
            'farmer': {'required': False},
        }

    def create(self, validated_data):
        return super().create(validated_data)

