"""
End-to-end test for the Sites Manager feature.
Tests the full lifecycle: create, list, search, retrieve, update, delete,
auth isolation, data integrity, and edge cases.
"""
import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.grabber.models import SiteAccount

User = get_user_model()


class SitesManagerE2ETest(TestCase):
    """Full end-to-end lifecycle of the Sites Manager API."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = User.objects.create_user(
            username="sitese2e@test.example",
            email="sitese2e@test.example",
            password="testpass123",
        )
        cls.other_user = User.objects.create_user(
            username="other@test.example",
            email="other@test.example",
            password="testpass123",
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    # ===== SECTION 1: BASIC CRUD =====

    def test_1_full_create_with_all_fields(self):
        """Create a site account with all optional fields populated."""
        res = self.client.post("/api/grabber/sites/", {
            "name": "My Private Forum",
            "site_url": "https://forum.example.com",
            "username": "johndoe",
            "password_encrypted": "supersecret",
            "cookies": {"sessionid": "abc123", "csrftoken": "xyz789"},
            "headers": {"X-API-Key": "mykey123"},
            "login_url": "https://forum.example.com/login",
            "login_method": "form",
            "notes": "My personal forum account",
            "is_active": True,
        }, format="json")
        self.assertEqual(res.status_code, 201)
        data = res.data
        self.assertEqual(data["name"], "My Private Forum")
        self.assertEqual(data["site_url"], "https://forum.example.com")
        self.assertEqual(data["username"], "johndoe")
        self.assertEqual(data["cookies"]["sessionid"], "abc123")
        self.assertEqual(data["headers"]["X-API-Key"], "mykey123")
        self.assertEqual(data["login_url"], "https://forum.example.com/login")
        self.assertEqual(data["login_method"], "form")
        self.assertEqual(data["notes"], "My personal forum account")
        self.assertTrue(data["is_active"])
        self.assertIn("id", data)
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)
        # password must NOT be returned
        self.assertNotIn("password_encrypted", data)
        return data["id"]

    def test_2_create_minimal(self):
        """Create a site account with only required fields."""
        res = self.client.post("/api/grabber/sites/", {
            "name": "Minimal",
            "site_url": "https://minimal.com",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["name"], "Minimal")
        self.assertEqual(res.data["site_url"], "https://minimal.com")
        self.assertEqual(res.data["username"], "")
        self.assertEqual(res.data["cookies"], {})
        self.assertEqual(res.data["headers"], {})
        self.assertEqual(res.data["login_method"], "cookie")
        self.assertTrue(res.data["is_active"])

    def test_3_create_validation_failures(self):
        """Test all validation failure modes."""
        # Missing name
        res = self.client.post("/api/grabber/sites/", {"site_url": "https://x.com"}, format="json")
        self.assertEqual(res.status_code, 400)

        # Missing site_url
        res = self.client.post("/api/grabber/sites/", {"name": "No URL"}, format="json")
        self.assertEqual(res.status_code, 400)

        # Invalid site_url
        res = self.client.post("/api/grabber/sites/", {
            "name": "Bad URL",
            "site_url": "not-a-url",
        }, format="json")
        self.assertEqual(res.status_code, 400)

    def test_4_list_sites(self):
        """List sites returns only own sites with correct count."""
        SiteAccount.objects.create(user=self.user, name="Mine 1", site_url="https://a.com")
        SiteAccount.objects.create(user=self.user, name="Mine 2", site_url="https://b.com")
        SiteAccount.objects.create(user=self.other_user, name="Other", site_url="https://c.com")

        res = self.client.get("/api/grabber/sites/")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 2)
        names = {r["name"] for r in results}
        self.assertIn("Mine 1", names)
        self.assertIn("Mine 2", names)
        self.assertNotIn("Other", names)

    def test_5_empty_list(self):
        """List returns empty when no sites exist."""
        res = self.client.get("/api/grabber/sites/")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 0)

    def test_6_search(self):
        """Search by name and site_url."""
        SiteAccount.objects.create(user=self.user, name="Alpha Site", site_url="https://alpha.com")
        SiteAccount.objects.create(user=self.user, name="Beta Service", site_url="https://beta.com")
        SiteAccount.objects.create(user=self.user, name="Another Alpha", site_url="https://another.com")

        res = self.client.get("/api/grabber/sites/?search=alpha")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 2)

        res = self.client.get("/api/grabber/sites/?search=beta")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Beta Service")

    def test_7_retrieve(self):
        """Get a single site account detail."""
        acc = SiteAccount.objects.create(
            user=self.user,
            name="My Site",
            site_url="https://mysite.com",
            cookies={"key": "val"},
        )
        res = self.client.get(f"/api/grabber/sites/{acc.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "My Site")
        self.assertEqual(res.data["cookies"]["key"], "val")

    def test_8_update(self):
        """Update site account fields."""
        acc = SiteAccount.objects.create(
            user=self.user,
            name="Original Name",
            site_url="https://original.com",
        )
        res = self.client.patch(f"/api/grabber/sites/{acc.id}/", {
            "name": "Updated Name",
            "cookies": {"session": "new_session"},
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Updated Name")
        self.assertEqual(res.data["cookies"]["session"], "new_session")
        # site_url should remain unchanged
        self.assertEqual(res.data["site_url"], "https://original.com")

    def test_9_delete(self):
        """Delete a site account."""
        acc = SiteAccount.objects.create(
            user=self.user,
            name="Delete Me",
            site_url="https://delete.com",
        )
        res = self.client.delete(f"/api/grabber/sites/{acc.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(SiteAccount.objects.filter(id=acc.id).exists())

    # ===== SECTION 2: AUTH & ACCESS CONTROL =====

    def test_10_requires_authentication(self):
        """All endpoints require JWT auth."""
        anon = APIClient()
        res = anon.get("/api/grabber/sites/")
        self.assertEqual(res.status_code, 401)
        res = anon.post("/api/grabber/sites/", {"name": "X"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_11_other_user_cannot_access(self):
        """User cannot access another user's site accounts."""
        acc = SiteAccount.objects.create(
            user=self.other_user,
            name="Secret",
            site_url="https://secret.com",
        )
        # Should not find it (404 via get_object_or_404)
        res = self.client.get(f"/api/grabber/sites/{acc.id}/")
        self.assertEqual(res.status_code, 404)

        res = self.client.patch(f"/api/grabber/sites/{acc.id}/", {"name": "Hacked"}, format="json")
        self.assertEqual(res.status_code, 404)

        res = self.client.delete(f"/api/grabber/sites/{acc.id}/")
        self.assertEqual(res.status_code, 404)

    def test_12_other_user_list_exclusion(self):
        """Own sites are isolated from other users' sites."""
        SiteAccount.objects.create(user=self.user, name="Mine", site_url="https://mine.com")
        SiteAccount.objects.create(user=self.other_user, name="Theirs", site_url="https://theirs.com")

        res = self.client.get("/api/grabber/sites/")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Mine")

    def test_13_nonexistent_returns_404(self):
        """Requesting a non-existent UUID returns 404."""
        res = self.client.get("/api/grabber/sites/00000000-0000-0000-0000-000000000000/")
        self.assertEqual(res.status_code, 404)

    # ===== SECTION 3: DATA INTEGRITY =====

    def test_14_cookies_and_headers_stored_as_json(self):
        """Cookies and headers persist correctly as JSON."""
        acc = SiteAccount.objects.create(
            user=self.user,
            name="JSON Test",
            site_url="https://json.com",
            cookies={"session": "abc", "token": "xyz"},
            headers={"Authorization": "Bearer mytoken123"},
        )
        acc.refresh_from_db()
        self.assertEqual(acc.cookies["session"], "abc")
        self.assertEqual(acc.cookies["token"], "xyz")
        self.assertEqual(acc.headers["Authorization"], "Bearer mytoken123")

    def test_15_active_toggle(self):
        """Can toggle is_active flag."""
        acc = SiteAccount.objects.create(
            user=self.user,
            name="Toggle Test",
            site_url="https://toggle.com",
            is_active=True,
        )
        res = self.client.patch(f"/api/grabber/sites/{acc.id}/", {"is_active": False}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["is_active"])

        res = self.client.patch(f"/api/grabber/sites/{acc.id}/", {"is_active": True}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_active"])

    def test_16_audit_timestamps(self):
        """created_at and updated_at are set correctly."""
        acc = SiteAccount.objects.create(
            user=self.user,
            name="Timestamp Test",
            site_url="https://ts.com",
        )
        self.assertIsNotNone(acc.created_at)
        self.assertIsNotNone(acc.updated_at)

        original_updated = acc.updated_at
        acc.name = "Updated"
        acc.save()
        acc.refresh_from_db()
        self.assertGreaterEqual(acc.updated_at, original_updated)

    def test_17_password_write_only(self):
        """Password is write-only and never returned in API responses."""
        res = self.client.post("/api/grabber/sites/", {
            "name": "Password Test",
            "site_url": "https://pass.com",
            "password_encrypted": "supersecretpassword123",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertNotIn("password_encrypted", res.data)

        # Retrieve also doesn't show it
        res = self.client.get(f"/api/grabber/sites/{res.data['id']}/")
        self.assertNotIn("password_encrypted", res.data)

    # ===== SECTION 4: LOGIN METHOD SPECIFICS =====

    def test_18_all_login_methods(self):
        """All four login methods can be created and retrieved."""
        methods = ["cookie", "header", "basic", "form"]
        ids = []
        for method in methods:
            res = self.client.post("/api/grabber/sites/", {
                "name": f"Method {method}",
                "site_url": f"https://{method}.com",
                "login_method": method,
            }, format="json")
            self.assertEqual(res.status_code, 201)
            self.assertEqual(res.data["login_method"], method)
            ids.append(res.data["id"])

        # Verify all 4 exist
        res = self.client.get("/api/grabber/sites/")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 4)

    def test_19_form_login_with_url(self):
        """Form login method accepts login_url."""
        res = self.client.post("/api/grabber/sites/", {
            "name": "Form Login",
            "site_url": "https://form.com",
            "login_method": "form",
            "login_url": "https://form.com/login",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["login_method"], "form")
        self.assertEqual(res.data["login_url"], "https://form.com/login")

    def test_20_header_auth_with_custom_headers(self):
        """Header auth method stores custom headers."""
        res = self.client.post("/api/grabber/sites/", {
            "name": "API Auth",
            "site_url": "https://api.com",
            "login_method": "header",
            "headers": {"Authorization": "Bearer mytoken", "X-Custom": "value"},
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["headers"]["Authorization"], "Bearer mytoken")
        self.assertEqual(res.data["headers"]["X-Custom"], "value")

    # ===== SECTION 5: RESPONSE SCHEMA =====

    def test_21_response_schema(self):
        """API response includes all required fields with correct types."""
        res = self.client.post("/api/grabber/sites/", {
            "name": "Schema Test",
            "site_url": "https://schema.com",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        d = res.data
        self.assertIsInstance(d["id"], str)
        self.assertIsInstance(d["name"], str)
        self.assertIsInstance(d["site_url"], str)
        self.assertIsInstance(d["username"], str)
        self.assertIsInstance(d["cookies"], dict)
        self.assertIsInstance(d["headers"], dict)
        self.assertIsInstance(d["login_method"], str)
        self.assertIsInstance(d["notes"], str)
        self.assertIsInstance(d["is_active"], bool)
        self.assertIsInstance(d["created_at"], str)
        self.assertIsInstance(d["updated_at"], str)
