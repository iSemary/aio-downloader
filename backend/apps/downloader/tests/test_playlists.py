from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.downloader.models import DownloadJob, Playlist

User = get_user_model()


class PlaylistViewSetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="playlist@test.example",
            email="playlist@test.example",
            password="secret12345",
        )
        self.other_user = User.objects.create_user(
            username="other@test.example",
            email="other@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_list_playlists_unauthenticated(self):
        client = APIClient()
        res = client.get("/api/downloads/playlists/")
        self.assertEqual(res.status_code, 401)

    def test_list_playlists_authenticated(self):
        Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/playlist1",
            title="Playlist 1",
            platform="youtube",
            total_count=5,
        )
        Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/playlist2",
            title="Playlist 2",
            platform="youtube",
            total_count=3,
        )
        res = self.client.get("/api/downloads/playlists/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 2)

    def test_list_only_own_playlists(self):
        Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/my-playlist",
            title="My Playlist",
            platform="youtube",
            total_count=5,
        )
        Playlist.objects.create(
            user=self.other_user,
            source_url="https://youtube.com/other-playlist",
            title="Other Playlist",
            platform="youtube",
            total_count=3,
        )
        res = self.client.get("/api/downloads/playlists/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 1)
        self.assertEqual(res.data["results"][0]["title"], "My Playlist")

    def test_get_playlist_detail(self):
        playlist = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/watch?v=abc",
            title="Test Playlist",
            platform="youtube",
            total_count=10,
            completed_count=3,
            failed_count=1,
            status=Playlist.Status.PARTIAL,
        )
        res = self.client.get(f"/api/downloads/playlists/{playlist.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["title"], "Test Playlist")
        self.assertEqual(res.data["total_count"], 10)
        self.assertEqual(res.data["completed_count"], 3)
        self.assertEqual(res.data["failed_count"], 1)
        self.assertEqual(res.data["status"], "partial")

    def test_get_playlist_with_children(self):
        playlist = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/playlist",
            title="Parent Playlist",
            platform="youtube",
            total_count=2,
        )
        child1 = DownloadJob.objects.create(
            user=self.user,
            source_url="https://youtube.com/watch?v=1",
            title="Video 1",
            platform="youtube",
            status=DownloadJob.Status.DONE,
            playlist=playlist,
        )
        child2 = DownloadJob.objects.create(
            user=self.user,
            source_url="https://youtube.com/watch?v=2",
            title="Video 2",
            platform="youtube",
            status=DownloadJob.Status.PENDING,
            playlist=playlist,
        )
        res = self.client.get(f"/api/downloads/playlists/{playlist.id}/")
        self.assertEqual(res.status_code, 200)
        # Check job_count instead of jobs since serializer may not include nested jobs
        self.assertEqual(res.data.get("job_count", 0), 2)

    def test_get_nonexistent_playlist(self):
        res = self.client.get(
            "/api/downloads/playlists/00000000-0000-0000-0000-000000000000/"
        )
        self.assertEqual(res.status_code, 404)

    def test_playlist_status_values(self):
        pending_playlist = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/pending",
            title="Pending",
            platform="youtube",
            status=Playlist.Status.PENDING,
        )
        partial_playlist = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/partial",
            title="Partial",
            platform="youtube",
            status=Playlist.Status.PARTIAL,
        )
        done_playlist = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/done",
            title="Done",
            platform="youtube",
            status=Playlist.Status.DONE,
        )
        error_playlist = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/error",
            title="Error",
            platform="youtube",
            status=Playlist.Status.ERROR,
        )
        res = self.client.get("/api/downloads/playlists/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 4)
        statuses = [p["status"] for p in res.data["results"]]
        self.assertIn("pending", statuses)
        self.assertIn("partial", statuses)
        self.assertIn("done", statuses)
        self.assertIn("error", statuses)

    def test_playlist_ordering(self):
        old = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/old",
            title="Old Playlist",
            platform="youtube",
        )
        from django.utils import timezone
        from django.db import models
        from django.conf import settings
        import uuid
        old.created_at = timezone.now() - timezone.timedelta(days=1)
        old.save()

        new = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/new",
            title="New Playlist",
            platform="youtube",
        )
        res = self.client.get("/api/downloads/playlists/")
        self.assertEqual(res.data["results"][0]["title"], "New Playlist")
        self.assertEqual(res.data["results"][1]["title"], "Old Playlist")

    def test_playlist_with_no_jobs(self):
        playlist = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/empty",
            title="Empty Playlist",
            platform="youtube",
            total_count=0,
        )
        res = self.client.get(f"/api/downloads/playlists/{playlist.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data.get("jobs", [])), 0)

    def test_cannot_access_other_user_playlist(self):
        playlist = Playlist.objects.create(
            user=self.other_user,
            source_url="https://youtube.com/other",
            title="Other User Playlist",
            platform="youtube",
        )
        res = self.client.get(f"/api/downloads/playlists/{playlist.id}/")
        self.assertEqual(res.status_code, 404)

    def test_playlist_fields_in_response(self):
        playlist = Playlist.objects.create(
            user=self.user,
            source_url="https://youtube.com/playlist",
            title="Full Playlist",
            platform="youtube",
            total_count=10,
            completed_count=5,
            failed_count=2,
            status=Playlist.Status.PARTIAL,
        )
        res = self.client.get(f"/api/downloads/playlists/{playlist.id}/")
        self.assertEqual(res.status_code, 200)
        data = res.data
        self.assertIn("id", data)
        self.assertIn("source_url", data)
        self.assertIn("title", data)
        self.assertIn("platform", data)
        self.assertIn("total_count", data)
        self.assertIn("completed_count", data)
        self.assertIn("failed_count", data)
        self.assertIn("status", data)
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)