from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DownloadDashboardView,
    DownloadJobViewSet,
    DownloadStatsView,
    DownloadTimeseriesView,
    DownloadUrlAnalyzeView,
    DownloadedFileViewSet,
    JobEventViewSet,
    PlatformBreakdownView,
    PlaylistViewSet,
)

router = DefaultRouter()
router.register("playlists", PlaylistViewSet, basename="playlist")
router.register("files", DownloadedFileViewSet, basename="downloaded-file")
router.register("events", JobEventViewSet, basename="job-event")
router.register("", DownloadJobViewSet, basename="download")

urlpatterns = [
    path("analyze/", DownloadUrlAnalyzeView.as_view(), name="download-analyze"),
    path("dashboard/", DownloadDashboardView.as_view(), name="download-dashboard"),
    path("stats/", DownloadStatsView.as_view(), name="download-stats"),
    path("timeseries/", DownloadTimeseriesView.as_view(), name="download-timeseries"),
    path("platforms/", PlatformBreakdownView.as_view(), name="download-platforms"),
    path("", include(router.urls)),
]
