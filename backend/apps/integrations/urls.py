from django.urls import path

from .views import (
    GoogleDriveAuthView,
    GoogleDriveCallbackView,
    GoogleDriveConfigView,
    GoogleDriveTestView,
    TelegramConfigView,
    TelegramPushView,
    TelegramTestView,
)

urlpatterns = [
    path("telegram/", TelegramConfigView.as_view(), name="telegram-config"),
    path("telegram/test/", TelegramTestView.as_view(), name="telegram-test"),
    path("telegram/push/<uuid:job_id>/", TelegramPushView.as_view(), name="telegram-push"),
    path("gdrive/", GoogleDriveConfigView.as_view(), name="gdrive-config"),
    path("gdrive/auth/", GoogleDriveAuthView.as_view(), name="gdrive-auth"),
    path("gdrive/callback/", GoogleDriveCallbackView.as_view(), name="gdrive-callback"),
    path("gdrive/test/", GoogleDriveTestView.as_view(), name="gdrive-test"),
]
