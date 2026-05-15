from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.downloader.tasks import enqueue_download

from .filters import FilterEngine
from .models import GrabberCrawlTask, GrabberDiscoveredFile, GrabberFilter, GrabberProject
from .serializers import (
    FileDownloadSerializer,
    GrabberCrawlTaskSerializer,
    GrabberDiscoveredFileSerializer,
    GrabberFilterSerializer,
    GrabberProjectDetailSerializer,
    GrabberProjectListSerializer,
)
from .tasks import (
    crawl_project_task,
    pause_crawl_project_task,
    queue_bulk_download_task,
    queue_file_download_task,
    stop_crawl_project_task,
)


class GrabberProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = GrabberProjectListSerializer

    def get_queryset(self):
        return GrabberProject.objects.filter(user=self.request.user).prefetch_related("filters")

    def get_serializer_class(self):
        if self.action in ("retrieve", "update", "partial_update"):
            return GrabberProjectDetailSerializer
        return GrabberProjectListSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        project = self.get_object()
        if project.status == GrabberProject.Status.CRAWLING:
            return Response({"detail": "Project is already crawling."}, status=status.HTTP_400_BAD_REQUEST)
        if project.status == GrabberProject.Status.DONE:
            project.pages_crawled = 0
            project.files_discovered = 0
            project.files_downloaded = 0
            project.bytes_downloaded = 0
            project.crawl_tasks.all().delete()
            project.discovered_files.all().delete()

        project.status = GrabberProject.Status.CRAWLING
        project.save(update_fields=["status", "pages_crawled", "files_discovered", "files_downloaded", "bytes_downloaded"])
        crawl_project_task.delay(str(project.id))
        return Response({"detail": "Crawl started.", "status": project.status})

    @action(detail=True, methods=["post"])
    def stop(self, request, pk=None):
        project = self.get_object()
        if project.status != GrabberProject.Status.CRAWLING:
            return Response({"detail": "Project is not currently crawling."}, status=status.HTTP_400_BAD_REQUEST)
        project.status = GrabberProject.Status.IDLE
        project.completed_at = timezone.now()
        project.save(update_fields=["status", "completed_at"])
        stop_crawl_project_task.delay(str(project.id))
        return Response({"detail": "Crawl stopped.", "status": project.status})

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        project = self.get_object()
        if project.status != GrabberProject.Status.CRAWLING:
            return Response({"detail": "Project is not currently crawling."}, status=status.HTTP_400_BAD_REQUEST)
        project.status = GrabberProject.Status.PAUSED
        project.save(update_fields=["status"])
        pause_crawl_project_task.delay(str(project.id))
        return Response({"detail": "Crawl paused.", "status": project.status})

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        project = self.get_object()
        if project.status != GrabberProject.Status.PAUSED:
            return Response({"detail": "Project is not paused."}, status=status.HTTP_400_BAD_REQUEST)
        project.status = GrabberProject.Status.CRAWLING
        project.save(update_fields=["status"])
        crawl_project_task.delay(str(project.id))
        return Response({"detail": "Crawl resumed.", "status": project.status})

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        project = self.get_object()
        file_type_counts = {}
        for ft in GrabberDiscoveredFile.FileType.values:
            file_type_counts[ft] = project.discovered_files.filter(file_type=ft).count()

        status_counts = {}
        for st in GrabberDiscoveredFile.Status.values:
            status_counts[st] = project.discovered_files.filter(status=st).count()

        return Response({
            "pages_crawled": project.pages_crawled,
            "files_discovered": project.files_discovered,
            "files_downloaded": project.files_downloaded,
            "bytes_downloaded": project.bytes_downloaded,
            "file_type_breakdown": file_type_counts,
            "file_status_breakdown": status_counts,
            "crawl_task_counts": {
                "pending": project.crawl_tasks.filter(status="pending").count(),
                "crawling": project.crawl_tasks.filter(status="crawling").count(),
                "done": project.crawl_tasks.filter(status="done").count(),
                "error": project.crawl_tasks.filter(status="error").count(),
                "skipped": project.crawl_tasks.filter(status="skipped").count(),
            },
        })


class GrabberCrawlTaskViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = GrabberCrawlTaskSerializer

    def get_queryset(self):
        return GrabberCrawlTask.objects.filter(
            project_id=self.kwargs["project_id"],
            project__user=self.request.user,
        ).select_related("parent")


class GrabberDiscoveredFileViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = GrabberDiscoveredFileSerializer

    def get_queryset(self):
        qs = GrabberDiscoveredFile.objects.filter(
            project_id=self.kwargs["project_id"],
            project__user=self.request.user,
        ).select_related("download_job")

        file_type = self.request.query_params.get("file_type")
        if file_type:
            qs = qs.filter(file_type=file_type)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        search = self.request.query_params.get("search", "")
        if search:
            qs = qs.filter(file_name__icontains=search)

        return qs

    def perform_destroy(self, instance):
        if instance.download_job:
            instance.download_job.status = "cancelled"
            instance.download_job.save(update_fields=["status"])
        instance.delete()

    @action(detail=True, methods=["post"])
    def download(self, request, project_id=None, pk=None):
        discovered_file = self.get_object()
        if discovered_file.download_job_id:
            return Response({"detail": "Download already queued.", "download_job_id": str(discovered_file.download_job_id)})
        queue_file_download_task.delay(str(discovered_file.id), str(project_id))
        return Response({"detail": "Download queued."})


class GrabberFilterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = GrabberFilterSerializer

    def get_queryset(self):
        return GrabberFilter.objects.filter(project_id=self.kwargs["project_id"], project__user=self.request.user)

    def perform_create(self, serializer):
        project = GrabberProject.objects.get(id=self.kwargs["project_id"], user=self.request.user)
        serializer.save(project=project)


class GrabberProjectFilesBulkDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        serializer = FileDownloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file_ids = serializer.validated_data["file_ids"]
        project = GrabberProject.objects.get(id=project_id, user=request.user)
        files = GrabberDiscoveredFile.objects.filter(
            id__in=file_ids, project=project, download_job__isnull=True
        )

        queued_count = 0
        for f in files:
            queue_file_download_task.delay(str(f.id), str(project_id))
            queued_count += 1

        return Response({
            "detail": f"Queued {queued_count} file(s) for download.",
            "queued_count": queued_count,
            "skipped_count": len(file_ids) - queued_count,
        })
