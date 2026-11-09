from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    display_name = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True, validators=[MaxLengthValidator(500)])
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    is_private = models.BooleanField(default=False)
    followers_count = models.PositiveIntegerField(default=0)
    following_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f'{self.user.username} profile'
