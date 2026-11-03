from django.urls import path

from .views import AccountRegistrationView, CurrentUserView, EmailLoginView

urlpatterns = [
    path('login/', EmailLoginView.as_view(), name='email-login'),
    path('register/', AccountRegistrationView.as_view(), name='account-register'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
]
