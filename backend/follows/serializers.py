from rest_framework import serializers

from accounts.models import Profile

from .models import Follow


class FollowUserSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user_id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField()
    display_name = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_self = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = (
            'id', 'username', 'full_name', 'display_name', 'avatar_url',
            'followers_count', 'following_count', 'is_private',
            'is_following', 'is_self',
        )
        read_only_fields = fields

    def get_avatar_url(self, profile):
        if not profile.avatar:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(profile.avatar.url) if request else profile.avatar.url

    def get_full_name(self, profile):
        return profile.user.get_full_name().strip() or profile.display_name or profile.user.username

    def get_is_following(self, profile):
        request = self.context.get('request')
        return bool(
            request
            and request.user.is_authenticated
            and request.user.following_relationships.filter(following_id=profile.user_id).exists()
        )

    def get_is_self(self, profile):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and request.user.pk == profile.user_id)


class FollowSerializer(serializers.ModelSerializer):
    follower = FollowUserSerializer(source='follower.profile', read_only=True)
    following = FollowUserSerializer(source='following.profile', read_only=True)

    class Meta:
        model = Follow
        fields = ('id', 'follower', 'following', 'created_at')
        read_only_fields = fields
