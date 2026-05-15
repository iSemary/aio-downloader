from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DownloadJobViewSet,
    DownloadStatsView,
    DownloadTimeseriesView,
    DownloadUrlAnalyzeView,
    PlatformBreakdownView,
)

router = DefaultRouter()
router.register("", DownloadJobViewSet, basename="download")

urlpatterns = [
    path("analyze/", DownloadUrlAnalyzeView.as_view(), name="download-analyze"),
    path("stats/", DownloadStatsView.as_view(), name="download-stats"),
    path("timeseries/", DownloadTimeseriesView.as_view(), name="download-timeseries"),
    path("platforms/", PlatformBreakdownView.as_view(), name="download-platforms"),
    path("", include(router.urls)),
]
