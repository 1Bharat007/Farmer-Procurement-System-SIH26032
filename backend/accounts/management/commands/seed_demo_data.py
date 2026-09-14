from datetime import date, time, timedelta
import uuid
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import Farmer, CentreOperator
from centres.models import ProcurementCentre, OperatingHours
from bookings.models import Slot, Booking, PaymentStatus
from queue_app.models import QueueToken


class Command(BaseCommand):
    help = "Seeds database with realistic demo procurement centres, operating hours, time slots, users, and bookings."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding KisanSlot / FarmQueue demo data..."))

        with transaction.atomic():
            # 1. Procurement Centres
            centres_data = [
                {
                    "name": "Karnal Central Grain Mandi",
                    "address": "Near GT Road, Karnal, Haryana - 132001",
                    "district": "Karnal",
                    "state": "Haryana",
                    "daily_capacity": 100,
                    "avg_processing_time_minutes": 20,
                    "latitude": Decimal("29.685700"),
                    "longitude": Decimal("76.990500"),
                    "is_active": True,
                },
                {
                    "name": "Panipat Anaj Mandi",
                    "address": "Old Grain Market, Panipat, Haryana - 132103",
                    "district": "Panipat",
                    "state": "Haryana",
                    "daily_capacity": 80,
                    "avg_processing_time_minutes": 25,
                    "latitude": Decimal("29.390900"),
                    "longitude": Decimal("76.963500"),
                    "is_active": True,
                },
                {
                    "name": "Ambala City Procurement Depot",
                    "address": "Sector 7 Mandi Complex, Ambala, Haryana - 134003",
                    "district": "Ambala",
                    "state": "Haryana",
                    "daily_capacity": 60,
                    "avg_processing_time_minutes": 30,
                    "latitude": Decimal("30.378200"),
                    "longitude": Decimal("76.776700"),
                    "is_active": True,
                },
                {
                    "name": "Kurukshetra MSP Centre",
                    "address": "Pipli Road Mandi, Kurukshetra, Haryana - 136131",
                    "district": "Kurukshetra",
                    "state": "Haryana",
                    "daily_capacity": 90,
                    "avg_processing_time_minutes": 20,
                    "latitude": Decimal("29.969500"),
                    "longitude": Decimal("76.878300"),
                    "is_active": True,
                },
            ]

            created_centres = []
            for c_data in centres_data:
                centre, created = ProcurementCentre.objects.update_or_create(
                    name=c_data["name"],
                    defaults=c_data,
                )
                created_centres.append(centre)
                status_str = "Created" if created else "Updated"
                self.stdout.write(f"  {status_str} centre: {centre.name}")

            # 2. Operating Hours for each centre (Mon-Sat 08:00-17:00, Sun closed)
            for centre in created_centres:
                for day in range(7):
                    is_closed = (day == 6)  # Sunday
                    OperatingHours.objects.update_or_create(
                        centre=centre,
                        day_of_week=day,
                        defaults={
                            "opening_time": time(8, 0),
                            "closing_time": time(17, 0),
                            "is_closed": is_closed,
                        },
                    )

            # 3. Slots for the next 14 days (including today)
            today = date.today()
            slot_times = [
                (time(8, 0), time(10, 0), 20),
                (time(10, 0), time(12, 0), 25),
                (time(13, 0), time(15, 0), 25),
                (time(15, 0), time(17, 0), 20),
            ]

            slots_created_count = 0
            for centre in created_centres:
                for day_offset in range(14):
                    slot_date = today + timedelta(days=day_offset)
                    # Skip Sunday slots
                    if slot_date.weekday() == 6:
                        continue
                    for start_t, end_t, cap in slot_times:
                        _, created = Slot.objects.get_or_create(
                            centre=centre,
                            date=slot_date,
                            start_time=start_t,
                            end_time=end_t,
                            defaults={"capacity": cap, "booked_count": 0},
                        )
                        if created:
                            slots_created_count += 1

            self.stdout.write(f"  Created {slots_created_count} new time slots across {len(created_centres)} centres.")

            # 4. Users: Staff and Operators
            admin_user, created = Farmer.objects.update_or_create(
                phone_number="9999999999",
                defaults={
                    "full_name": "State Procurement Officer",
                    "is_staff": True,
                    "is_superuser": True,
                    "district": "Karnal",
                    "state": "Haryana",
                },
            )
            admin_user.set_password("adminpassword123")
            admin_user.save()
            self.stdout.write(f"  Admin: {admin_user.phone_number} / adminpassword123")

            # Karnal Operator
            karnal_centre = created_centres[0]
            op1, _ = Farmer.objects.update_or_create(
                phone_number="9876500001",
                defaults={
                    "full_name": "Rajesh Kumar (Karnal Mandi)",
                    "is_staff": True,
                    "district": "Karnal",
                    "state": "Haryana",
                },
            )
            op1.set_password("operatorpassword123")
            op1.save()
            CentreOperator.objects.update_or_create(
                user=op1,
                defaults={"centre": karnal_centre, "badge_number": "KNL-OP-01", "is_active": True},
            )

            # Panipat Operator
            panipat_centre = created_centres[1]
            op2, _ = Farmer.objects.update_or_create(
                phone_number="9876500002",
                defaults={
                    "full_name": "Suresh Verma (Panipat Mandi)",
                    "is_staff": True,
                    "district": "Panipat",
                    "state": "Haryana",
                },
            )
            op2.set_password("operatorpassword123")
            op2.save()
            CentreOperator.objects.update_or_create(
                user=op2,
                defaults={"centre": panipat_centre, "badge_number": "PNP-OP-02", "is_active": True},
            )

            # 5. Demo Farmers
            farmers_data = [
                {
                    "phone_number": "9876543210",
                    "full_name": "Ramesh Singh",
                    "village": "Kachhwa",
                    "district": "Karnal",
                    "state": "Haryana",
                    "crop_type": "Wheat",
                },
                {
                    "phone_number": "9812345678",
                    "full_name": "Balwinder Singh",
                    "village": "Samalkha",
                    "district": "Panipat",
                    "state": "Haryana",
                    "crop_type": "Paddy",
                },
                {
                    "phone_number": "9123456780",
                    "full_name": "Satish Kumar",
                    "village": "Naraingarh",
                    "district": "Ambala",
                    "state": "Haryana",
                    "crop_type": "Mustard",
                },
            ]

            demo_farmers = []
            for f_data in farmers_data:
                farmer, _ = Farmer.objects.update_or_create(
                    phone_number=f_data["phone_number"],
                    defaults=f_data,
                )
                demo_farmers.append(farmer)
                self.stdout.write(f"  Farmer: {farmer.full_name} ({farmer.phone_number})")

            # 6. Sample Bookings for today and tomorrow so live queues have data
            today_slots_karnal = Slot.objects.filter(centre=karnal_centre, date=today).order_by("start_time")
            if today_slots_karnal.exists():
                slot1 = today_slots_karnal[0]
                # Booking 1: Ramesh Singh - Checked In / Called
                b1, b1_created = Booking.objects.get_or_create(
                    farmer=demo_farmers[0],
                    slot=slot1,
                    defaults={
                        "status": "checked_in",
                        "quantity_kg": Decimal("1500.00"),
                        "qr_code_token": uuid.uuid4(),
                        "notes": "Grade-A Sharbati Wheat",
                    },
                )
                if b1_created:
                    slot1.booked_count += 1
                    slot1.save(update_fields=["booked_count"])
                    QueueToken.objects.get_or_create(
                        booking=b1,
                        centre=karnal_centre,
                        date=today,
                        token_number=1,
                        defaults={"status": "called", "estimated_wait_minutes": 10},
                    )

                if len(today_slots_karnal) > 1:
                    slot2 = today_slots_karnal[1]
                    # Booking 2: Balwinder Singh - In Queue
                    b2, b2_created = Booking.objects.get_or_create(
                        farmer=demo_farmers[1],
                        slot=slot2,
                        defaults={
                            "status": "in_queue",
                            "quantity_kg": Decimal("2200.00"),
                            "qr_code_token": uuid.uuid4(),
                            "notes": "Basmati 1121",
                        },
                    )
                    if b2_created:
                        slot2.booked_count += 1
                        slot2.save(update_fields=["booked_count"])
                        QueueToken.objects.get_or_create(
                            booking=b2,
                            centre=karnal_centre,
                            date=today,
                            token_number=2,
                            defaults={"status": "waiting", "estimated_wait_minutes": 35},
                        )

            # Booking 3 for tomorrow: Satish Kumar - Booked
            tomorrow = today + timedelta(days=1)
            tomorrow_slots = Slot.objects.filter(centre=karnal_centre, date=tomorrow).order_by("start_time")
            if tomorrow_slots.exists():
                s_tom = tomorrow_slots[0]
                b3, b3_created = Booking.objects.get_or_create(
                    farmer=demo_farmers[2],
                    slot=s_tom,
                    defaults={
                        "status": "booked",
                        "quantity_kg": Decimal("850.00"),
                        "qr_code_token": uuid.uuid4(),
                        "notes": "Yellow Mustard",
                    },
                )
                if b3_created:
                    s_tom.booked_count += 1
                    s_tom.save(update_fields=["booked_count"])

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully!"))
