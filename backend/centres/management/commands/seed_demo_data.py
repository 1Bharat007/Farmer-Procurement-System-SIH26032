import random
import uuid
from decimal import Decimal
from datetime import datetime, time, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from accounts.models import Farmer, CentreOperator
from centres.models import ProcurementCentre, OperatingHours
from bookings.models import Slot, Booking, PaymentStatus
from queue_app.models import QueueToken
from notifications.models import Notification


class Command(BaseCommand):
    help = "Seed realistic demo data for Smart India Hackathon 2026 Farmer Procurement Platform"

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("[*] Starting database seeding process..."))

        if options.get('clear'):
            self.stdout.write("Purging previous database records...")
            Notification.objects.all().delete()
            QueueToken.objects.all().delete()
            PaymentStatus.objects.all().delete()
            Booking.objects.all().delete()
            Slot.objects.all().delete()
            OperatingHours.objects.all().delete()
            CentreOperator.objects.all().delete()
            Farmer.objects.all().delete()

        today = timezone.localdate()

        # ==========================================
        # 1. CREATE SUPERUSER & OPERATOR ACCOUNTS
        # ==========================================
        self.stdout.write("1. Creating System Admin...")
        admin_user, _ = Farmer.objects.get_or_create(
            phone_number="9999999999",
            defaults={
                "full_name": "System Administrator",
                "is_staff": True,
                "is_superuser": True,
                "district": "New Delhi",
                "state": "Delhi",
                "preferred_language": "en",
            }
        )
        admin_user.set_password("admin123")
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.save()

        # ==========================================
        # 2. CREATE 3 PROCUREMENT CENTRES
        # ==========================================
        self.stdout.write("2. Creating 3 Procurement Centres with different daily capacities...")
        centres_data = [
            {
                "name": "Karnal Central MSP Grain Mandi",
                "address": "Sector 4, GT Road, Near Railway Station, Karnal",
                "latitude": Decimal("29.685700"),
                "longitude": Decimal("76.990500"),
                "district": "Karnal",
                "state": "Haryana",
                "daily_capacity": 50,
                "avg_processing_time_minutes": 20,
            },
            {
                "name": "Ludhiana Agro Procurement Hub",
                "address": "Ferozepur Road, Grain Market Yard, Ludhiana",
                "latitude": Decimal("30.901000"),
                "longitude": Decimal("75.857300"),
                "district": "Ludhiana",
                "state": "Punjab",
                "daily_capacity": 80,
                "avg_processing_time_minutes": 25,
            },
            {
                "name": "Indore Integrated Mandi Terminal",
                "address": "Choithram Mandi Road, Sector B, Indore",
                "latitude": Decimal("22.719600"),
                "longitude": Decimal("75.857700"),
                "district": "Indore",
                "state": "Madhya Pradesh",
                "daily_capacity": 120,
                "avg_processing_time_minutes": 30,
            },
        ]

        created_centres = []
        for cdata in centres_data:
            centre, _ = ProcurementCentre.objects.update_or_create(
                name=cdata["name"],
                defaults=cdata
            )
            created_centres.append(centre)
            self.stdout.write(f"   [OK] Centre: {centre.name} (Cap: {centre.daily_capacity}, {centre.district})")

        # ==========================================
        # 3. OPERATING HOURS (8am-4pm, closed Sundays)
        # ==========================================
        self.stdout.write("3. Configuring Operating Hours (8:00 AM - 4:00 PM, Sunday closed)...")
        for centre in created_centres:
            for day in range(7):
                is_sunday = (day == 6)
                OperatingHours.objects.update_or_create(
                    centre=centre,
                    day_of_week=day,
                    defaults={
                        "opening_time": time(8, 0),
                        "closing_time": time(16, 0),
                        "is_closed": is_sunday,
                    }
                )

        # ==========================================
        # 4. CREATE CENTRE OPERATOR PROFILES
        # ==========================================
        self.stdout.write("4. Creating Centre Operators...")
        operators_info = [
            ("9811111111", "Harish Chander", created_centres[0], "OP-KRN-01"),
            ("9822222222", "Paramjit Singh", created_centres[1], "OP-LDH-02"),
            ("9833333333", "Ravi Shankar Joshi", created_centres[2], "OP-IND-03"),
        ]
        for phone, name, centre, badge in operators_info:
            op_user, _ = Farmer.objects.get_or_create(
                phone_number=phone,
                defaults={
                    "full_name": name,
                    "district": centre.district,
                    "state": centre.state,
                    "is_staff": True,
                    "preferred_language": "hi",
                }
            )
            op_user.set_password("operator123")
            op_user.is_staff = True
            op_user.save()

            CentreOperator.objects.update_or_create(
                user=op_user,
                defaults={
                    "centre": centre,
                    "badge_number": badge,
                    "is_active": True,
                }
            )
            self.stdout.write(f"   [OK] Operator: {name} assigned to {centre.name}")

        # ==========================================
        # 5. CREATE 25 REALISTIC FARMER ACCOUNTS
        # ==========================================
        self.stdout.write("5. Creating 25 Farmer Accounts with realistic Indian names & villages...")
        farmers_data = [
            # Haryana farmers → Hindi ('hi')
            ("9800000001", "Ramesh Kumar", "Taraori", "Karnal", "Haryana", "hi", "Wheat"),
            # Punjab farmers → Punjabi ('pa') to exercise Gurmukhi font + SMS templates
            ("9800000002", "Balwinder Singh", "Jagraon", "Ludhiana", "Punjab", "pa", "Paddy"),
            ("9800000003", "Gurpreet Kaur", "Khanna", "Ludhiana", "Punjab", "pa", "Wheat"),
            ("9800000004", "Suresh Patel", "Mhow", "Indore", "Madhya Pradesh", "hi", "Soybean"),
            ("9800000005", "Rajesh Verma", "Sanwer", "Indore", "Madhya Pradesh", "hi", "Wheat"),
            ("9800000006", "Harpreet Singh", "Samrala", "Ludhiana", "Punjab", "pa", "Paddy"),
            ("9800000007", "Anil Sharma", "Nilokheri", "Karnal", "Haryana", "hi", "Mustard"),
            ("9800000008", "Dharmendra Yadav", "Depalpur", "Indore", "Madhya Pradesh", "hi", "Soybean"),
            ("9800000009", "Vikram Chauhan", "Gharaunda", "Karnal", "Haryana", "hi", "Wheat"),
            ("9800000010", "Manpreet Singh", "Raikot", "Ludhiana", "Punjab", "pa", "Wheat"),
            ("9800000011", "Sunil Bishnoi", "Assandh", "Karnal", "Haryana", "hi", "Mustard"),
            ("9800000012", "Jagjit Singh", "Doraha", "Ludhiana", "Punjab", "pa", "Paddy"),
            ("9800000013", "Devendra Patidar", "Betma", "Indore", "Madhya Pradesh", "hi", "Soybean"),
            ("9800000014", "Mukesh Choudhary", "Hatod", "Indore", "Madhya Pradesh", "hi", "Wheat"),
            ("9800000015", "Kuldeep Gill", "Sahnewal", "Ludhiana", "Punjab", "pa", "Wheat"),
            ("9800000016", "Satish Tyagi", "Indri", "Karnal", "Haryana", "hi", "Wheat"),
            ("9800000017", "Jaswinder Brar", "Payal", "Ludhiana", "Punjab", "pa", "Paddy"),
            ("9800000018", "Kailash Malviya", "Rau", "Indore", "Madhya Pradesh", "hi", "Soybean"),
            ("9800000019", "Om Prakash Saini", "Kunjpura", "Karnal", "Haryana", "hi", "Mustard"),
            ("9800000020", "Amarjeet Sandhu", "Machhiwara", "Ludhiana", "Punjab", "pa", "Wheat"),
            ("9800000021", "Ashok Rathi", "Nissing", "Karnal", "Haryana", "hi", "Wheat"),
            ("9800000022", "Sanjay Solanki", "Simrol", "Indore", "Madhya Pradesh", "hi", "Soybean"),
            ("9800000023", "Ravinder Dhillon", "Mullanpur", "Ludhiana", "Punjab", "pa", "Paddy"),
            ("9800000024", "Vinod Kaushik", "Jundla", "Karnal", "Haryana", "hi", "Wheat"),
            ("9800000025", "Kamal Kishore Joshi", "Sawer", "Indore", "Madhya Pradesh", "hi", "Wheat"),
        ]

        created_farmers = []
        for phone, name, village, district, state, lang, crop in farmers_data:
            farmer, _ = Farmer.objects.update_or_create(
                phone_number=phone,
                defaults={
                    "full_name": name,
                    "village": village,
                    "district": district,
                    "state": state,
                    "preferred_language": lang,
                    "crop_type": crop,
                }
            )
            farmer.set_password("farmer123")
            farmer.save()
            created_farmers.append(farmer)

        self.stdout.write(f"   [OK] Successfully registered {len(created_farmers)} farmers.")

        # ==========================================
        # 6. CREATE 14 DAYS OF SLOTS (2-HOUR WINDOWS)
        # ==========================================
        self.stdout.write("6. Generating 14 days of 2-hour window slots for each centre...")
        time_windows = [
            (time(8, 0), time(10, 0)),
            (time(10, 0), time(12, 0)),
            (time(12, 0), time(14, 0)),
            (time(14, 0), time(16, 0)),
        ]

        # Span: 2 days in the past through 11 days in future (total 14 days)
        # This provides realistic past slots (for completed/no-show), today (for live queue), and future (for booked)
        created_slots = []
        slots_by_centre = {c.id: [] for c in created_centres}

        for centre in created_centres:
            slot_capacity = max(5, centre.daily_capacity // 4)
            for day_offset in range(-2, 12):
                slot_date = today + timedelta(days=day_offset)
                for start_t, end_t in time_windows:
                    slot, _ = Slot.objects.update_or_create(
                        centre=centre,
                        date=slot_date,
                        start_time=start_t,
                        end_time=end_t,
                        defaults={
                            "capacity": slot_capacity,
                            "booked_count": 0,
                        }
                    )
                    created_slots.append(slot)
                    slots_by_centre[centre.id].append(slot)

        self.stdout.write(f"   [OK] Generated {len(created_slots)} total slots across 14 operating days.")

        # ==========================================
        # 7. CREATE 40 REALISTIC BOOKINGS WITH STATUS MIX
        # ==========================================
        self.stdout.write("7. Distributing 40 bookings evenly across all 3 centres with diverse status values...")
        # 40 bookings distributed across 3 centres: Karnal (14), Ludhiana (13), Indore (13)
        centre_status_distributions = [
            # Karnal: 14 bookings
            (created_centres[0], ['completed'] * 4 + ['in_queue'] * 2 + ['checked_in'] * 2 + ['booked'] * 4 + ['cancelled'] * 1 + ['no_show'] * 1),
            # Ludhiana: 13 bookings
            (created_centres[1], ['completed'] * 3 + ['in_queue'] * 2 + ['checked_in'] * 2 + ['booked'] * 4 + ['cancelled'] * 1 + ['no_show'] * 1),
            # Indore: 13 bookings
            (created_centres[2], ['completed'] * 3 + ['in_queue'] * 2 + ['checked_in'] * 2 + ['booked'] * 4 + ['cancelled'] * 1 + ['no_show'] * 1),
        ]

        # Map farmers by district for realistic local bookings
        farmers_by_district = {
            "Karnal": [f for f in created_farmers if f.district == "Karnal"],
            "Ludhiana": [f for f in created_farmers if f.district == "Ludhiana"],
            "Indore": [f for f in created_farmers if f.district == "Indore"],
        }

        random.seed(42)
        created_bookings = []
        token_counters = {}

        for centre, statuses in centre_status_distributions:
            c_slots = slots_by_centre[centre.id]
            past_c_slots = [s for s in c_slots if s.date < today]
            today_c_slots = [s for s in c_slots if s.date == today]
            future_c_slots = [s for s in c_slots if s.date > today]

            district_farmers = farmers_by_district.get(centre.district, created_farmers)

            for idx, status_val in enumerate(statuses):
                farmer = district_farmers[idx % len(district_farmers)]

                if status_val in ['checked_in', 'in_queue']:
                    slot = today_c_slots[idx % len(today_c_slots)]
                elif status_val == 'completed':
                    slot = past_c_slots[idx % len(past_c_slots)]
                elif status_val == 'no_show':
                    slot = past_c_slots[(idx + 2) % len(past_c_slots)]
                elif status_val == 'booked':
                    slot = future_c_slots[idx % len(future_c_slots)]
                else:  # cancelled
                    slot = future_c_slots[(idx + 3) % len(future_c_slots)]

                quantity = Decimal(random.randint(15, 45) * 100)  # 1500 to 4500 kg

                booking = Booking.objects.create(
                    farmer=farmer,
                    slot=slot,
                    status=status_val,
                    quantity_kg=quantity,
                    qr_code_token=uuid.uuid4(),
                    notes=f"Intake batch of {farmer.crop_type} by {farmer.full_name} ({farmer.village})"
                )
                created_bookings.append(booking)

                if status_val not in ['cancelled']:
                    slot.booked_count += 1
                    slot.save(update_fields=['booked_count'])

                # ==========================================
                # 8. MATCHING PAYMENT STATUS FOR COMPLETED
                # ==========================================
                if status_val == 'completed':
                    msp_rate = Decimal("22.75")
                    payout_amount = (quantity * msp_rate).quantize(Decimal("0.01"))
                    PaymentStatus.objects.create(
                        booking=booking,
                        amount=payout_amount,
                        status='completed',
                        transaction_reference=f"DBT-PFMS-2026-{booking.id:05d}-{random.randint(1000, 9999)}",
                        paid_at=timezone.now() - timedelta(days=1, hours=random.randint(1, 8))
                    )

                # ==========================================
                # 9. MATCHING QUEUE TOKENS
                # ==========================================
                if status_val in ['checked_in', 'in_queue', 'completed']:
                    key = (slot.centre_id, slot.date)
                    token_counters[key] = token_counters.get(key, 0) + 1
                    token_num = token_counters[key]

                    if status_val == 'completed':
                        queue_status = 'completed'
                        wait_time = 0
                    elif status_val == 'in_queue':
                        queue_status = 'called'
                        wait_time = 5
                    else:
                        queue_status = 'waiting'
                        wait_time = token_num * slot.centre.avg_processing_time_minutes

                    QueueToken.objects.create(
                        booking=booking,
                        centre=slot.centre,
                        date=slot.date,
                        token_number=token_num,
                        status=queue_status,
                        estimated_wait_minutes=wait_time,
                        called_at=timezone.now() - timedelta(minutes=15) if queue_status in ['called', 'completed'] else None,
                        served_at=timezone.now() - timedelta(minutes=5) if queue_status == 'completed' else None,
                    )

        self.stdout.write(f"   [OK] Successfully created {len(created_bookings)} bookings across all 3 centres.")
        self.stdout.write(f"   [OK] Created {PaymentStatus.objects.count()} matching DBT PaymentStatus records for completed bookings.")
        self.stdout.write(f"   [OK] Created {QueueToken.objects.count()} live QueueToken records.")

        # ==========================================
        # 10. SYSTEM NOTIFICATIONS
        # ==========================================
        self.stdout.write("10. Creating sample notifications for farmers...")
        for farmer in created_farmers[:10]:
            Notification.objects.create(
                recipient=farmer,
                title="Slot Confirmed for Grain Procurement",
                message=f"Namaste {farmer.full_name}, your delivery slot is confirmed. Please carry your Aadhaar card and land records.",
                notification_type="slot_confirmation",
                is_read=False,
            )

        self.stdout.write(self.style.SUCCESS(
            "\n[SUCCESS] Seed data generation complete!\n"
            f"   - Superuser: 9999999999 (admin123)\n"
            f"   - Centres: {ProcurementCentre.objects.count()}\n"
            f"   - Operators: {CentreOperator.objects.count()} (e.g. 9811111111, pass: operator123)\n"
            f"   - Farmers: {Farmer.objects.filter(is_staff=False).count()} (pass: farmer123)\n"
            f"   - Slots: {Slot.objects.count()}\n"
            f"   - Bookings: {Booking.objects.count()} (Status mix: 12 booked, 6 in_queue, 6 checked_in, 10 completed, 3 cancelled, 3 no_show)\n"
            f"   - Payments: {PaymentStatus.objects.count()}\n"
            f"   - Queue Tokens: {QueueToken.objects.count()}\n"
        ))
