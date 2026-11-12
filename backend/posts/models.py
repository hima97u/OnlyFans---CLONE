from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models
from django.utils import timezone


class Post(models.Model):
    FREE = 'free'
    FOLLOWERS = 'followers'
    SUBSCRIBER = 'subscriber'
    VISIBILITY_CHOICES = (
        (FREE, 'Free'),
        (FOLLOWERS, 'Followers'),
        (SUBSCRIBER, 'Subscribers'),
    )

    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    body = models.TextField(blank=True, validators=[MaxLengthValidator(5000)])
    media = models.FileField(upload_to='posts/', blank=True, null=True)
    media_type = models.CharField(max_length=20, blank=True)
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default=FREE)
    category = models.CharField(max_length=100, blank=True)
    hashtags = models.CharField(max_length=500, blank=True)
    published_at = models.DateTimeField(default=timezone.now, null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    likes_count = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ('-published_at', '-id')
        indexes = [
            models.Index(fields=('published_at', 'id'), name='post_published_id'),
            models.Index(fields=('author', 'published_at'), name='post_author_published'),
            models.Index(fields=('visibility', 'published_at'), name='post_visibility_published'),
        ]

    @property
    def media_url(self):
        return self.media.url if self.media else ''


class PostLike(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='post_likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('post', 'user'), name='unique_post_like'),
        ]
        indexes = [
            models.Index(fields=('post', 'created_at'), name='post_like_post_created'),
        ]


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments')
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
    )
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    likes_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ('created_at', 'id')
        indexes = [
            models.Index(fields=('post', 'created_at'), name='comment_post_created'),
            models.Index(fields=('parent', 'created_at'), name='comment_parent_created'),
        ]


class CommentLike(models.Model):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comment_likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('comment', 'user'), name='unique_comment_like'),
        ]
        indexes = [
            models.Index(fields=('comment', 'created_at'), name='comment_like_created'),
        ]
