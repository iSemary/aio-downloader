import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()

DEFAULT_EMAIL = "test@example.com"
DEFAULT_PASSWORD = "testpassword123"


class Command(BaseCommand):
    help = "Create or update a local test user (for development only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default=os.environ.get("TEST_USER_EMAIL", DEFAULT_EMAIL),
            help=f"Email (default: {DEFAULT_EMAIL} or TEST_USER_EMAIL).",
        )
        parser.add_argument(
            "--password",
            default=os.environ.get("TEST_USER_PASSWORD", DEFAULT_PASSWORD),
            help="Password (default: TEST_USER_PASSWORD env or built-in test password).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="If the user exists, reset the password.",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        force = options["force"]

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            user = None

        if user is None:
            base = email.split("@")[0].replace(".", "_")[:100] or "user"
            username = base
            n = 0
            while User.objects.filter(username=username).exists():
                n += 1
                username = f"{base}_{n}"[:150]
            User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name="Test",
                last_name="User",
            )
            self.stdout.write(self.style.SUCCESS(f"Created test user: {email}"))
            return

        if not force:
            self.stdout.write(
                self.style.WARNING(
                    f"User already exists: {email}. Run with --force to reset password, or use --email with a different address.",
                )
            )
            return

        user.set_password(password)
        user.save(update_fields=["password"])
        self.stdout.write(self.style.SUCCESS(f"Reset password for test user: {email}"))
