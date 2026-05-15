from django.urls import path

from rest_framework_simplejwt.views import TokenRefreshView

from .views import EmailTokenObtainPairView, LogoutView, MeView, PasswordChangeView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", EmailTokenObtainPairView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("me/password/", PasswordChangeView.as_view(), name="auth-password"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
]
