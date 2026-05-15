from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    GrabberCrawlTaskViewSet,
    GrabberDiscoveredFileViewSet,
    GrabberFilterViewSet,
    GrabberProjectFilesBulkDownloadView,
    GrabberProjectViewSet,
)

router = DefaultRouter()
router.register("projects", GrabberProjectViewSet, basename="grabber-project")
router.register(
    r"projects/(?P<project_id>[^/.]+)/tasks",
    GrabberCrawlTaskViewSet,
    basename="grabber-task",
)
router.register(
    r"projects/(?P<project_id>[^/.]+)/files",
    GrabberDiscoveredFileViewSet,
    basename="grabber-file",
)
router.register(
    r"projects/(?P<project_id>[^/.]+)/filters",
    GrabberFilterViewSet,
    basename="grabber-filter",
)

urlpatterns = [
    path(
        "projects/<uuid:project_id>/files/download-bulk/",
        GrabberProjectFilesBulkDownloadView.as_view(),
        name="grabber-files-bulk-download",
    ),
    path("", include(router.urls)),
]
