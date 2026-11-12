from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from notifications.models import Notification

from .models import Comment, Post, PostLike


class PostInteractionApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.author = user_model.objects.create_user(
            username='author',
            email='author@example.com',
            password='Pass12345!',
        )
        self.viewer = user_model.objects.create_user(
            username='viewer',
            email='viewer@example.com',
            password='Pass12345!',
        )
        self.post = Post.objects.create(author=self.author, body='Hello')
        self.client.force_authenticate(self.viewer)

    def test_like_is_idempotent_and_notifies_author(self):
        url = f'/api/posts/{self.post.id}/like/'
        self.assertEqual(self.client.post(url).status_code, 201)
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertEqual(PostLike.objects.filter(post=self.post, user=self.viewer).count(), 1)
        self.assertEqual(Notification.objects.filter(
            recipient=self.author,
            notification_type=Notification.LIKE,
        ).count(), 1)

    def test_comment_reply_and_comment_like_notify_correct_users(self):
        response = self.client.post(
            f'/api/posts/{self.post.id}/comments/',
            {'body': 'First comment'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        comment = Comment.objects.get(pk=response.data['id'])
        self.client.force_authenticate(self.author)
        response = self.client.post(
            f'/api/posts/{self.post.id}/comments/',
            {'body': 'Reply', 'parent_id': comment.id},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.client.force_authenticate(self.viewer)
        self.assertEqual(
            self.client.post(f'/api/posts/comments/{comment.id}/like/').status_code,
            201,
        )
        self.assertTrue(Notification.objects.filter(
            recipient=self.author,
            notification_type=Notification.COMMENT,
        ).exists())
        self.assertTrue(Notification.objects.filter(
            recipient=self.viewer,
            notification_type=Notification.REPLY,
        ).exists())
