from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.auth_app.urls")),
    path("api/downloads/", include("apps.downloader.urls")),
    path("api/storage/", include("apps.storage_manager.urls")),
    path("api/integrations/", include("apps.integrations.urls")),
]
