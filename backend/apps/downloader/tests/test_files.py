from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.downloader.models import DownloadJob, DownloadedFile, JobEvent

User = get_user_model()


class DownloadedFileViewSetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="files@test.example",
            email="files@test.example",
            password="secret12345",
        )
        self.other_user = User.objects.create_user(
            username="other@test.example",
            email="other@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_list_files_unauthenticated(self):
        client = APIClient()
        res = client.get("/api/downloads/files/")
        self.assertEqual(res.status_code, 401)

    def test_list_files_authenticated(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/video.mp4",
            title="Video",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/video.mp4",
            file_size_bytes=1024,
        )
        DownloadedFile.objects.create(
            user=self.user,
            job=job,
            file_path="http/video.mp4",
            file_size_bytes=1024,
            content_type="video/mp4",
        )
        res = self.client.get("/api/downloads/files/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 1)

    def test_list_only_own_files(self):
        my_job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/my.mp4",
            title="My Video",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/my.mp4",
            file_size_bytes=1024,
        )
        other_job = DownloadJob.objects.create(
            user=self.other_user,
            source_url="https://example.com/other.mp4",
            title="Other Video",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/other.mp4",
            file_size_bytes=2048,
        )
        DownloadedFile.objects.create(
            user=self.user,
            job=my_job,
            file_path="http/my.mp4",
            file_size_bytes=1024,
        )
        DownloadedFile.objects.create(
            user=self.other_user,
            job=other_job,
            file_path="http/other.mp4",
            file_size_bytes=2048,
        )
        res = self.client.get("/api/downloads/files/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 1)

    def test_get_file_detail(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Video",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/test.mp4",
            file_size=4096,
        )
        file = DownloadedFile.objects.create(
            user=self.user,
            job=job,
            file_path="http/test.mp4",
            file_size=4096,
            content_type="video/mp4",
        )
        res = self.client.get(f"/api/downloads/files/{file.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["file_size"], 4096)
        self.assertEqual(res.data["content_type"], "video/mp4")

    def test_file_related_to_job(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/video.mp4",
            title="Video",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/video.mp4",
            file_size_bytes=1024,
        )
        file = DownloadedFile.objects.create(
            user=self.user,
            job=job,
            file_path="http/video.mp4",
            file_size_bytes=1024,
        )
        res = self.client.get(f"/api/downloads/files/{file.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["job"]["id"], str(job.id))
        self.assertEqual(res.data["job"]["title"], "Video")

    def test_multiple_files_per_user(self):
        for i in range(5):
            job = DownloadJob.objects.create(
                user=self.user,
                source_url=f"https://example.com/{i}.mp4",
                title=f"Video {i}",
                platform="http",
                status=DownloadJob.Status.DONE,
                file_path=f"http/{i}.mp4",
                file_size=1024 * (i + 1),
            )
            DownloadedFile.objects.create(
                user=self.user,
                job=job,
                file_path=f"http/{i}.mp4",
                file_size=1024 * (i + 1),
            )
        res = self.client.get("/api/downloads/files/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 5)

    def test_cannot_access_other_user_file(self):
        job = DownloadJob.objects.create(
            user=self.other_user,
            source_url="https://example.com/other.mp4",
            title="Other",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/other.mp4",
            file_size_bytes=1024,
        )
        file = DownloadedFile.objects.create(
            user=self.other_user,
            job=job,
            file_path="http/other.mp4",
            file_size_bytes=1024,
        )
        res = self.client.get(f"/api/downloads/files/{file.id}/")
        self.assertEqual(res.status_code, 404)

    def test_file_fields_in_response(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test",
            platform="http",
            status=DownloadJob.Status.DONE,
            file_path="http/test.mp4",
            file_size_bytes=2048,
        )
        file = DownloadedFile.objects.create(
            user=self.user,
            job=job,
            file_path="http/test.mp4",
            file_size_bytes=2048,
            content_type="video/mp4",
        )
        res = self.client.get(f"/api/downloads/files/{file.id}/")
        self.assertEqual(res.status_code, 200)
        data = res.data
        self.assertIn("id", data)
        self.assertIn("file_path", data)
        self.assertIn("file_size", data)
        self.assertIn("content_type", data)
        self.assertIn("job", data)


class JobEventViewSetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="events@test.example",
            email="events@test.example",
            password="secret12345",
        )
        self.other_user = User.objects.create_user(
            username="other@test.example",
            email="other@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_list_events_unauthenticated(self):
        client = APIClient()
        res = client.get("/api/downloads/events/")
        self.assertEqual(res.status_code, 401)

    def test_list_events_authenticated(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test",
            platform="http",
            status=DownloadJob.Status.PENDING,
        )
        JobEvent.objects.create(
            user=self.user,
            job=job,
            event_type="created",
            message="Job created",
        )
        JobEvent.objects.create(
            user=self.user,
            job=job,
            event_type="started",
            message="Download started",
        )
        res = self.client.get("/api/downloads/events/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 2)

    def test_list_only_own_events(self):
        my_job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/my.mp4",
            title="My",
            platform="http",
            status=DownloadJob.Status.PENDING,
        )
        other_job = DownloadJob.objects.create(
            user=self.other_user,
            source_url="https://example.com/other.mp4",
            title="Other",
            platform="http",
            status=DownloadJob.Status.PENDING,
        )
        JobEvent.objects.create(user=self.user, job=my_job, event_type="created", message="My event")
        JobEvent.objects.create(user=self.other_user, job=other_job, event_type="created", message="Other event")
        res = self.client.get("/api/downloads/events/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 1)

    def test_events_for_specific_job(self):
        job1 = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/job1.mp4",
            title="Job 1",
            platform="http",
            status=DownloadJob.Status.PENDING,
        )
        job2 = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/job2.mp4",
            title="Job 2",
            platform="http",
            status=DownloadJob.Status.PENDING,
        )
        JobEvent.objects.create(user=self.user, job=job1, event_type="created", message="Created 1")
        JobEvent.objects.create(user=self.user, job=job2, event_type="created", message="Created 2")
        res = self.client.get(f"/api/downloads/events/?job={job1.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 1)
        self.assertEqual(res.data["results"][0]["job"]["id"], str(job1.id))

    def test_event_types(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test",
            platform="http",
            status=DownloadJob.Status.PENDING,
        )
        event_types = ["created", "started", "progress", "completed", "error", "cancelled"]
        for et in event_types:
            JobEvent.objects.create(user=self.user, job=job, event_type=et, message=f"Event {et}")
        res = self.client.get("/api/downloads/events/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 6)

    def test_event_includes_job_info(self):
        job = DownloadJob.objects.create(
            user=self.user,
            source_url="https://example.com/test.mp4",
            title="Test Job",
            platform="http",
            status=DownloadJob.Status.PENDING,
        )
        event = JobEvent.objects.create(
            user=self.user,
            job=job,
            event_type="progress",
            message="50% complete",
        )
        res = self.client.get(f"/api/downloads/events/{event.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["event_type"], "progress")
        self.assertEqual(res.data["message"], "50% complete")
        self.assertIn("job", res.data)
        self.assertEqual(res.data["job"]["title"], "Test Job")


class DownloadedFileDateFilterTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="filedate@test.example",
            email="filedate@test.example",
            password="secret12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _make_file(self, **kw):
        job_defaults = dict(
            user=self.user,
            source_url="https://example.com/v.mp4",
            title="Video",
            platform="http",
            status=DownloadJob.Status.DONE,
        )
        job_defaults.update({k: kw.pop(k) for k in list(kw) if k.startswith("job_")})
        job = DownloadJob.objects.create(**{k.removeprefix("job_"): v for k, v in list(job_defaults.items())})
        defaults = dict(
            user=self.user,
            job=job,
            file_path="http/v.mp4",
            file_size_bytes=1024,
        )
        defaults.update(kw)
        return DownloadedFile.objects.create(**defaults)

    def test_filter_files_by_date_from(self):
        now = timezone.now()
        old = now - timedelta(days=5)
        self._make_file(file_path="http/old.mp4")
        DownloadedFile.objects.filter(file_path="http/old.mp4").update(created_at=old)
        self._make_file(file_path="http/new.mp4")

        res = self.client.get(
            "/api/downloads/files/?date_from=" + (now - timedelta(days=1)).strftime("%Y-%m-%d")
        )
        self.assertEqual(res.status_code, 200)
        paths = [f["file_path"] for f in res.data["results"]]
        self.assertIn("http/new.mp4", paths)
        self.assertNotIn("http/old.mp4", paths)

    def test_filter_files_by_date_to(self):
        now = timezone.now()
        old = now - timedelta(days=5)
        self._make_file(file_path="http/old.mp4")
        DownloadedFile.objects.filter(file_path="http/old.mp4").update(created_at=old)
        self._make_file(file_path="http/new.mp4")

        res = self.client.get(
            "/api/downloads/files/?date_to=" + (now - timedelta(days=1)).strftime("%Y-%m-%d")
        )
        self.assertEqual(res.status_code, 200)
        paths = [f["file_path"] for f in res.data["results"]]
        self.assertIn("http/old.mp4", paths)
        self.assertNotIn("http/new.mp4", paths)