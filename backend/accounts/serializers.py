import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Profile

RESERVED_USERNAMES = {
    'admin', 'api', 'creator', 'discover', 'help', 'login', 'logout',
    'messages', 'onlyfans', 'profile', 'settings', 'support', 'system',
}
USERNAME_PATTERN = re.compile(r'^[A-Za-z0-9_]{3,30}$')


def validate_username_value(value):
    value = value.strip()
    normalized = value.casefold()
    if not value:
        raise serializers.ValidationError('Username cannot be empty.')
    if not USERNAME_PATTERN.fullmatch(value):
        raise serializers.ValidationError(
            'Username must be 3-30 characters and use only letters, numbers, or underscores.',
        )
    if normalized in RESERVED_USERNAMES:
        raise serializers.ValidationError('This username is reserved.')
    return value


class CredentialsSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=1, trim_whitespace=False)

    def validate_email(self, value):
        return value.strip().lower()


class EmailLoginSerializer(CredentialsSerializer):
    def validate(self, attrs):
        user_model = get_user_model()
        user = user_model.objects.filter(email__iexact=attrs['email']).first()
        if user is not None and not user.check_password(attrs['password']):
            user = None
        if user is None:
            raise serializers.ValidationError('Invalid email or password.')
        if not user.is_active:
            raise serializers.ValidationError('This account is inactive.')
        attrs['user'] = user
        return attrs


class AccountRegistrationSerializer(CredentialsSerializer):
    username = serializers.CharField(max_length=30)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def validate_username(self, value):
        value = validate_username_value(value)
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_password(self, value):
        user_model = get_user_model()
        validate_password(
            value,
            user_model(username=self.initial_data.get('username', ''), email=self.initial_data.get('email', '')),
        )
        return value

    def validate_email(self, value):
        value = super().validate_email(value)
        if get_user_model().objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = get_user_model().objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )
        Profile.objects.create(user=user)
        return user


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', max_length=150)
    email = serializers.EmailField(source='user.email', read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = (
            'username', 'email', 'display_name', 'bio', 'avatar_url',
            'created_at', 'updated_at',
            'followers_count', 'following_count',
        )
        read_only_fields = (
            'email', 'created_at', 'updated_at',
            'followers_count', 'following_count',
        )

    def get_avatar_url(self, profile):
        if not profile.avatar:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(profile.avatar.url) if request else profile.avatar.url

    def validate_display_name(self, value):
        return value.strip()

    def validate_username(self, value):
        value = validate_username_value(value)
        return value

    def validate_bio(self, value):
        return value.strip()

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        username = user_data.get('username')
        if username:
            username = username.strip()
            if get_user_model().objects.exclude(pk=instance.user_id).filter(username__iexact=username).exists():
                raise serializers.ValidationError({'username': 'This username is already taken.'})
            instance.user.username = username
            instance.user.save(update_fields=['username'])
        return super().update(instance, validated_data)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context['request'].user)
        return value


class AccountDeletionSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Password is incorrect.')
        return value
