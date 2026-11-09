from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from .serializers import AccountRegistrationSerializer, EmailLoginSerializer


class AccountValidationTests(APITestCase):
    def setUp(self):
        cache.clear()

    def registration_data(self, **overrides):
        data = {
            'email': 'new@example.com',
            'username': 'new_creator',
            'password': 'StrongPass!123',
            'confirm_password': 'StrongPass!123',
        }
        data.update(overrides)
        return data

    def test_registration_rejects_duplicate_email_case_insensitively(self):
        get_user_model().objects.create_user(
            username='existing_creator',
            email='Test@example.com',
            password='StrongPass!123',
        )
        serializer = AccountRegistrationSerializer(
            data=self.registration_data(email='test@EXAMPLE.com'),
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('email', serializer.errors)

    def test_registration_rejects_duplicate_username_case_insensitively(self):
        get_user_model().objects.create_user(
            username='Existing_Creator',
            email='existing@example.com',
            password='StrongPass!123',
        )
        serializer = AccountRegistrationSerializer(
            data=self.registration_data(username='existing_creator'),
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('username', serializer.errors)

    def test_registration_rejects_invalid_and_reserved_usernames(self):
        for username in ('ab', 'bad-name', 'admin'):
            serializer = AccountRegistrationSerializer(
                data=self.registration_data(username=username),
            )
            self.assertFalse(serializer.is_valid(), username)
            self.assertIn('username', serializer.errors)

    def test_registration_rejects_mismatched_passwords(self):
        serializer = AccountRegistrationSerializer(
            data=self.registration_data(confirm_password='DifferentPass!123'),
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('confirm_password', serializer.errors)

    def test_registration_rejects_weak_passwords(self):
        serializer = AccountRegistrationSerializer(
            data=self.registration_data(password='password', confirm_password='password'),
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)

    def test_registration_requires_all_fields(self):
        serializer = AccountRegistrationSerializer(data={})

        self.assertFalse(serializer.is_valid())
        self.assertTrue({'email', 'username', 'password', 'confirm_password'} <= set(serializer.errors))

    def test_login_accepts_email_with_different_case(self):
        user = get_user_model().objects.create_user(
            username='creator',
            email='Test@example.com',
            password='StrongPass!123',
        )
        serializer = EmailLoginSerializer(
            data={'email': 'test@EXAMPLE.COM', 'password': 'StrongPass!123'},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['user'], user)

    def test_registration_endpoint_creates_username_and_returns_tokens(self):
        response = self.client.post(
            '/api/auth/register/',
            self.registration_data(),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['username'], 'new_creator')
        self.assertIsNotNone(response.data['user']['created_at'])
        self.assertIsNotNone(response.data['user']['updated_at'])

    def test_profile_timestamps_are_created_and_updated(self):
        response = self.client.post(
            '/api/auth/register/',
            self.registration_data(),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        profile = get_user_model().objects.get(username='new_creator').profile
        original_created_at = profile.created_at
        original_updated_at = profile.updated_at

        profile.bio = 'Updated bio'
        profile.save()
        profile.refresh_from_db()

        self.assertEqual(profile.created_at, original_created_at)
        self.assertGreater(profile.updated_at, original_updated_at)

    def test_z_registration_is_rate_limited(self):
        for index in range(5):
            response = self.client.post(
                '/api/auth/register/',
                self.registration_data(
                    email=f'creator{index}@example.com',
                    username=f'creator_{index}',
                ),
                format='json',
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.post(
            '/api/auth/register/',
            self.registration_data(
                email='creator_limited@example.com',
                username='creator_limited',
            ),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
