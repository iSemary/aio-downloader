from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class AuthRegisterViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_user_success(self):
        res = self.client.post(
            "/api/auth/register/",
            {
                "email": "newuser@test.example",
                "password": "securepassword123",
                "password_confirm": "securepassword123",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertIn("email", res.data)
        self.assertEqual(res.data["email"], "newuser@test.example")

    def test_register_duplicate_email(self):
        User.objects.create_user(username="existing@test.com", email="existing@test.com", password="password123")
        res = self.client.post(
            "/api/auth/register/",
            {
                "email": "existing@test.com",
                "password": "securepassword123",
                "password_confirm": "securepassword123",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_register_passwords_mismatch(self):
        res = self.client.post(
            "/api/auth/register/",
            {
                "email": "test@test.com",
                "password": "password1",
                "password_confirm": "password2",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_register_short_password(self):
        res = self.client.post(
            "/api/auth/register/",
            {
                "email": "test@test.com",
                "password": "short",
                "password_confirm": "short",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_register_missing_email(self):
        res = self.client.post(
            "/api/auth/register/",
            {"password": "password123", "password_confirm": "password123"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)


class AuthLoginViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="login@test.example",
            email="login@test.example",
            password="secret12345",
        )
        self.client = APIClient()

    def test_login_success(self):
        res = self.client.post(
            "/api/auth/login/",
            {
                "email": "login@test.example",
                "password": "secret12345",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)

    def test_login_wrong_password(self):
        res = self.client.post(
            "/api/auth/login/",
            {
                "email": "login@test.example",
                "password": "wrongpassword",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 401)

    def test_login_nonexistent_user(self):
        res = self.client.post(
            "/api/auth/login/",
            {
                "email": "nonexistent@test.com",
                "password": "password123",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 401)

    def test_login_missing_fields(self):
        res = self.client.post("/api/auth/login/", {}, format="json")
        self.assertEqual(res.status_code, 400)


class AuthMeViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="me@test.example",
            email="me@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_me_returns_user_info(self):
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["email"], "me@test.example")

    def test_me_unauthenticated(self):
        client = APIClient()
        res = client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 401)

    def test_me_update_profile(self):
        res = self.client.patch(
            "/api/auth/me/",
            {"first_name": "John", "last_name": "Doe"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "John")
        self.assertEqual(self.user.last_name, "Doe")

    def test_me_cannot_change_email(self):
        res = self.client.patch(
            "/api/auth/me/",
            {"email": "newemail@test.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "me@test.example")


class UserPreferencesViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="pref@test.example",
            email="pref@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_get_preferences(self):
        res = self.client.get("/api/auth/preferences/")
        self.assertEqual(res.status_code, 200)

    def test_update_preferences(self):
        res = self.client.patch(
            "/api/auth/preferences/",
            {"default_format": "mp3", "default_quality": "128k"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_preferences_unauthenticated(self):
        client = APIClient()
        res = client.get("/api/auth/preferences/")
        self.assertEqual(res.status_code, 401)


class PasswordChangeViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="pass@test.example",
            email="pass@test.example",
            password="oldpassword123",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_change_password_success(self):
        res = self.client.post(
            "/api/auth/me/password/",
            {
                "old_password": "oldpassword123",
                "new_password": "newpassword123",
                "new_password_confirm": "newpassword123",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpassword123"))

    def test_change_password_wrong_current(self):
        res = self.client.post(
            "/api/auth/me/password/",
            {
                "old_password": "wrongpassword",
                "new_password": "newpassword123",
                "new_password_confirm": "newpassword123",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_change_password_mismatch(self):
        res = self.client.post(
            "/api/auth/me/password/",
            {
                "old_password": "oldpassword123",
                "new_password": "newpassword1",
                "new_password_confirm": "newpassword2",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_change_password_too_short(self):
        res = self.client.post(
            "/api/auth/me/password/",
            {
                "old_password": "oldpassword123",
                "new_password": "short",
                "new_password_confirm": "short",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_change_password_unauthenticated(self):
        client = APIClient()
        res = client.post(
            "/api/auth/me/password/",
            {
                "old_password": "oldpassword123",
                "new_password": "newpassword123",
                "new_password_confirm": "newpassword123",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 401)


class LogoutViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="logout@test.example",
            email="logout@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_logout_endpoint_exists(self):
        # LogoutView inherits from TokenBlacklistView which requires refresh token
        # This test just verifies the endpoint exists
        res = self.client.post("/api/auth/logout/", {"refresh": "test"}, format="json")
        # Any response means endpoint exists and works
        self.assertIn(res.status_code, [200, 400, 401])