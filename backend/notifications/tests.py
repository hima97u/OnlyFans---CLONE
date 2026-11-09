from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Profile
from follows.models import Follow

from .models import Notification


class NotificationApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        user_model = get_user_model()
        self.follower = user_model.objects.create_user(
            username='follower',
            email='follower@example.com',
            password='StrongPass!123',
        )
        self.creator = user_model.objects.create_user(
            username='creator',
            email='creator@example.com',
            password='StrongPass!123',
        )
        Profile.objects.get_or_create(user=self.follower)
        Profile.objects.get_or_create(user=self.creator)

    def test_follow_creates_notification_for_target(self):
        self.client.force_authenticate(self.follower)
        response = self.client.post(f'/api/follows/{self.creator.pk}/')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        notification = Notification.objects.get(recipient=self.creator)
        self.assertEqual(notification.actor, self.follower)
        self.assertFalse(notification.is_read)

        self.client.force_authenticate(self.creator)
        response = self.client.get('/api/notifications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unread_count'], 1)
        self.assertEqual(response.data['results'][0]['actor_username'], 'follower')

    def test_notification_read_endpoints_are_recipient_scoped(self):
        notification = Notification.objects.create(
            recipient=self.creator,
            actor=self.follower,
            notification_type=Notification.FOLLOW,
        )
        self.client.force_authenticate(self.follower)
        response = self.client.post(f'/api/notifications/{notification.pk}/read/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(self.creator)
        response = self.client.post(f'/api/notifications/{notification.pk}/read/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)
