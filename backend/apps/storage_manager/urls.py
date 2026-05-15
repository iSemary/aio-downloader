from django.urls import path

from .views import StorageDeleteView, StorageListView, StorageStatsView

urlpatterns = [
    path("", StorageListView.as_view(), name="storage-list"),
    path("stats/", StorageStatsView.as_view(), name="storage-stats"),
    path("<path:filename>/", StorageDeleteView.as_view(), name="storage-delete"),
]
