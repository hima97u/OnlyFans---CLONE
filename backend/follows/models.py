from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='following_relationships',
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='follower_relationships',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=('follower', 'following'),
                name='unique_follower_following',
            ),
            models.CheckConstraint(
                condition=~Q(follower=F('following')),
                name='follow_cannot_follow_self',
            ),
        ]
        indexes = [
            models.Index(fields=('follower', 'created_at'), name='follow_follower_created'),
            models.Index(fields=('following', 'created_at'), name='follow_following_created'),
        ]
        ordering = ('-created_at',)

    def clean(self):
        if self.follower_id == self.following_id:
            raise ValidationError('You cannot follow yourself.')

    def __str__(self):
        return f'{self.follower} follows {self.following}'
