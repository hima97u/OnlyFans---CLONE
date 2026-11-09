from django.conf import settings
from django.db import models


class Notification(models.Model):
    FOLLOW = 'follow'
    TYPE_CHOICES = ((FOLLOW, 'Follow'),)

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_notifications',
    )
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('recipient', 'is_read', 'created_at'), name='notification_recipient_read'),
        ]

    def __str__(self):
        return f'{self.notification_type} notification for {self.recipient}'
