"""
KisanSlot Demo Reset Management Command
Smart India Hackathon 2026 - Problem Statement 26032

Wipes transactional data (bookings, payment statuses, queue tokens, notifications)
and re-runs seed_demo_data so the platform can be cleanly reset to a known-good state
in a single command between demo rehearsals and live presentations.
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import transaction
from bookings.models import Booking, PaymentStatus, Slot
from queue_app.models import QueueToken
from notifications.models import Notification


class Command(BaseCommand):
    help = "Reset transactional demo data and reseed platform to a clean, known-good demo state."

    def add_arguments(self, parser):
        parser.add_argument(
            '--quiet',
            action='store_true',
            help='Run reset without verbose output',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        verbose = not options.get('quiet', False)

        if verbose:
            self.stdout.write(self.style.WARNING("=" * 70))
            self.stdout.write(self.style.WARNING("       KISANSLOT PLATFORM - DEMO ENVIRONMENT RESET"))
            self.stdout.write(self.style.WARNING("=" * 70))
            self.stdout.write("[1/3] Wiping all previous transactional data...")

        # Purge transactional records
        n_notifs = Notification.objects.count()
        Notification.objects.all().delete()

        n_tokens = QueueToken.objects.count()
        QueueToken.objects.all().delete()

        n_payments = PaymentStatus.objects.count()
        PaymentStatus.objects.all().delete()

        n_bookings = Booking.objects.count()
        Booking.objects.all().delete()

        # Reset slot booking counters
        Slot.objects.all().update(booked_count=0)

        if verbose:
            self.stdout.write(
                f"      Purged: {n_bookings} bookings, {n_payments} payments, "
                f"{n_tokens} queue tokens, {n_notifs} notifications."
            )
            self.stdout.write("[2/3] Executing seed_demo_data to establish known-good state...")

        # Re-run seeder to establish known-good state
        call_command('seed_demo_data')

        if verbose:
            self.stdout.write(self.style.SUCCESS("[3/3] Demo environment successfully reset!"))
            self.stdout.write(self.style.SUCCESS("-" * 70))
            self.stdout.write(self.style.SUCCESS("READY-TO-USE DEMO CREDENTIALS:"))
            self.stdout.write("  * System Admin:     username: admin (or 9999999999) / password: admin123")
            self.stdout.write("  * Karnal Operator:  username: 9811111111 / password: operator123")
            self.stdout.write("  * Ludhiana Operator: username: 9822222222 / password: operator123")
            self.stdout.write("  * Indore Operator:  username: 9833333333 / password: operator123")
            self.stdout.write("  * Test Farmer:      mobile: 9800000001 / OTP: 123456 (or console OTP)")
            self.stdout.write("  * Punjab Farmer:    mobile: 9800000002 / OTP: 123456 (Gurmukhi lang)")
            self.stdout.write(self.style.SUCCESS("=" * 70))
