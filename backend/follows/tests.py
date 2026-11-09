from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Profile

from .models import Follow


class FollowApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        user_model = get_user_model()
        self.alice = user_model.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='StrongPass!123',
        )
        self.bob = user_model.objects.create_user(
            username='bob',
            email='bob@example.com',
            password='StrongPass!123',
        )
        Profile.objects.get_or_create(user=self.alice)
        Profile.objects.get_or_create(user=self.bob)
        self.client.force_authenticate(self.alice)

    def test_follow_and_unfollow_updates_counts(self):
        response = self.client.post(f'/api/follows/{self.bob.pk}/')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Follow.objects.count(), 1)
        self.alice.profile.refresh_from_db()
        self.bob.profile.refresh_from_db()
        self.assertEqual(self.alice.profile.following_count, 1)
        self.assertEqual(self.bob.profile.followers_count, 1)

        response = self.client.delete(f'/api/follows/{self.bob.pk}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Follow.objects.count(), 0)
        self.alice.profile.refresh_from_db()
        self.bob.profile.refresh_from_db()
        self.assertEqual(self.alice.profile.following_count, 0)
        self.assertEqual(self.bob.profile.followers_count, 0)

    def test_follow_rejects_self_and_duplicates(self):
        response = self.client.post(f'/api/follows/{self.alice.pk}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.post(f'/api/follows/{self.bob.pk}/')
        response = self.client.post(f'/api/follows/{self.bob.pk}/')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_database_constraint_rejects_self_follow(self):
        with self.assertRaises(IntegrityError):
            Follow.objects.create(follower=self.alice, following=self.alice)

    def test_unfollow_missing_relationship_returns_not_found(self):
        response = self.client.delete(f'/api/follows/{self.bob.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_private_and_inactive_accounts_cannot_be_followed(self):
        self.bob.profile.is_private = True
        self.bob.profile.save(update_fields=['is_private'])
        response = self.client.post(f'/api/follows/{self.bob.pk}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.bob.is_active = False
        self.bob.save(update_fields=['is_active'])
        response = self.client.post(f'/api/follows/{self.bob.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_follow_lists_and_status_are_available(self):
        self.client.post(f'/api/follows/{self.bob.pk}/')

        response = self.client.get(f'/api/follows/followers/{self.bob.pk}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['id'], self.alice.pk)

        response = self.client.get(f'/api/follows/status/{self.bob.pk}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['following'])

    def test_people_search_returns_matching_active_people_and_follow_state(self):
        response = self.client.get('/api/follows/search/?q=bo')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['id'], self.bob.pk)
        self.assertFalse(response.data[0]['is_following'])
        self.assertFalse(response.data[0]['is_self'])

        response = self.client.get('/api/follows/search/?q=Bob')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['full_name'], 'bob')

        self.client.post(f'/api/follows/{self.bob.pk}/')
        response = self.client.get('/api/follows/search/?q=bob')
        self.assertTrue(response.data[0]['is_following'])
