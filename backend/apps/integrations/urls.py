from django.urls import path

from .views import TelegramConfigView, TelegramPushView, TelegramTestView

urlpatterns = [
    path("telegram/", TelegramConfigView.as_view(), name="telegram-config"),
    path("telegram/test/", TelegramTestView.as_view(), name="telegram-test"),
    path("telegram/push/<uuid:job_id>/", TelegramPushView.as_view(), name="telegram-push"),
]
