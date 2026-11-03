from django.urls import path

from .views import (
    AccountDeletionView,
    AccountRegistrationView,
    CurrentUserView,
    EmailLoginView,
    PasswordChangeView,
    ProfileView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('login/', EmailLoginView.as_view(), name='email-login'),
    path('register/', AccountRegistrationView.as_view(), name='account-register'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('password/', PasswordChangeView.as_view(), name='password-change'),
    path('delete/', AccountDeletionView.as_view(), name='account-delete'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
]
