from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.grabber.models import SiteAccount

User = get_user_model()


class SiteAccountModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="sites@test.example",
            email="sites@test.example",
            password="secret12345",
        )

    def test_create_site_account(self):
        acc = SiteAccount.objects.create(
            user=self.user,
            name="Example Site",
            site_url="https://example.com",
            username="user@example.com",
            login_method="cookie",
        )
        self.assertEqual(acc.name, "Example Site")
        self.assertEqual(acc.site_url, "https://example.com")
        self.assertEqual(acc.username, "user@example.com")
        self.assertTrue(acc.is_active)
        self.assertEqual(acc.login_method, "cookie")

    def test_site_account_str(self):
        acc = SiteAccount.objects.create(
            user=self.user,
            name="My Site",
            site_url="https://mysite.com",
        )
        self.assertIn("My Site", str(acc))
        self.assertIn("mysite.com", str(acc))

    def test_site_account_defaults(self):
        acc = SiteAccount.objects.create(
            user=self.user,
            name="Defaults",
            site_url="https://example.com",
        )
        self.assertEqual(acc.login_method, "cookie")
        self.assertTrue(acc.is_active)
        self.assertEqual(acc.cookies, {})
        self.assertEqual(acc.headers, {})
        self.assertEqual(acc.notes, "")

    def test_cookies_and_headers(self):
        acc = SiteAccount.objects.create(
            user=self.user,
            name="Auth Site",
            site_url="https://auth.example.com",
            cookies={"sessionid": "abc123"},
            headers={"Authorization": "Bearer token123"},
            login_method="header",
        )
        self.assertEqual(acc.cookies["sessionid"], "abc123")
        self.assertEqual(acc.headers["Authorization"], "Bearer token123")

    def test_login_method_choices(self):
        for code, _ in SiteAccount.LoginMethod.choices:
            acc = SiteAccount.objects.create(
                user=self.user,
                name=f"Method {code}",
                site_url="https://example.com",
                login_method=code,
            )
            self.assertEqual(acc.login_method, code)


class SiteAccountViewSetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="sitesview@test.example",
            email="sitesview@test.example",
            password="secret12345",
        )
        self.other_user = User.objects.create_user(
            username="other@test.example",
            email="other@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_create_site_account(self):
        res = self.client.post("/api/grabber/sites/", {
            "name": "My Site",
            "site_url": "https://example.com",
            "username": "user@example.com",
            "login_method": "cookie",
            "cookies": {"sessionid": "abc"},
            "notes": "Test account",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["name"], "My Site")
        self.assertEqual(res.data["site_url"], "https://example.com")
        self.assertEqual(res.data["login_method"], "cookie")
        self.assertEqual(res.data["notes"], "Test account")
        self.assertIn("id", res.data)
        # password should not be returned in responses
        self.assertNotIn("password_encrypted", res.data)

    def test_list_site_accounts(self):
        SiteAccount.objects.create(user=self.user, name="A", site_url="https://a.com")
        SiteAccount.objects.create(user=self.user, name="B", site_url="https://b.com")
        SiteAccount.objects.create(user=self.other_user, name="C", site_url="https://c.com")

        res = self.client.get("/api/grabber/sites/")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 2)

    def test_retrieve_site_account(self):
        acc = SiteAccount.objects.create(user=self.user, name="Test", site_url="https://example.com")
        res = self.client.get(f"/api/grabber/sites/{acc.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Test")

    def test_update_site_account(self):
        acc = SiteAccount.objects.create(user=self.user, name="Old", site_url="https://example.com")
        res = self.client.patch(f"/api/grabber/sites/{acc.id}/", {"name": "Updated"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Updated")

    def test_delete_site_account(self):
        acc = SiteAccount.objects.create(user=self.user, name="Delete", site_url="https://example.com")
        res = self.client.delete(f"/api/grabber/sites/{acc.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(SiteAccount.objects.count(), 0)

    def test_other_user_cannot_access(self):
        acc = SiteAccount.objects.create(user=self.other_user, name="Other", site_url="https://example.com")
        res = self.client.get(f"/api/grabber/sites/{acc.id}/")
        self.assertEqual(res.status_code, 404)

    def test_requires_auth(self):
        anon = APIClient()
        res = anon.get("/api/grabber/sites/")
        self.assertEqual(res.status_code, 401)

    def test_search(self):
        SiteAccount.objects.create(user=self.user, name="Alpha Site", site_url="https://alpha.com")
        SiteAccount.objects.create(user=self.user, name="Beta Site", site_url="https://beta.com")

        res = self.client.get("/api/grabber/sites/?search=alpha")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Alpha Site")

    def test_create_with_cookies(self):
        res = self.client.post("/api/grabber/sites/", {
            "name": "Cookie Auth",
            "site_url": "https://auth.example.com",
            "cookies": {"sessionid": "abc123", "csrftoken": "xyz"},
            "login_method": "cookie",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["cookies"]["sessionid"], "abc123")

    def test_create_with_headers(self):
        res = self.client.post("/api/grabber/sites/", {
            "name": "API Auth",
            "site_url": "https://api.example.com",
            "headers": {"Authorization": "Bearer mytoken"},
            "login_method": "header",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["headers"]["Authorization"], "Bearer mytoken")

    def test_create_requires_name(self):
        res = self.client.post("/api/grabber/sites/", {"site_url": "https://example.com"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_empty_list(self):
        res = self.client.get("/api/grabber/sites/")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 0)
