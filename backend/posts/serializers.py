from rest_framework import serializers

from .models import Comment, Post


class PostSerializer(serializers.ModelSerializer):
    author_id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(source='author.username', read_only=True)
    display_name = serializers.SerializerMethodField()
    media = serializers.FileField(write_only=True, required=False, allow_null=True)
    media_url = serializers.SerializerMethodField()
    locked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            'id', 'author_id', 'username', 'display_name', 'body', 'media', 'media_url',
            'media_type', 'visibility', 'category', 'hashtags', 'published_at',
            'likes_count', 'comments_count', 'locked',
        )
        read_only_fields = (
            'author_id', 'username', 'display_name', 'media_url', 'published_at',
            'likes_count', 'comments_count', 'locked',
        )

    def get_display_name(self, post):
        profile = getattr(post.author, 'profile', None)
        return (profile.display_name if profile and profile.display_name else post.author.username)

    def get_media_url(self, post):
        if not post.media:
            return ''
        request = self.context.get('request')
        return request.build_absolute_uri(post.media.url) if request else post.media.url

    def get_locked(self, post):
        return False

    def validate(self, attrs):
        body = attrs.get('body', '').strip()
        media = attrs.get('media')
        if not body and not media:
            raise serializers.ValidationError('Add text or an image/video before posting.')
        if media and media.size > 50 * 1024 * 1024:
            raise serializers.ValidationError('Media must be 50 MB or smaller.')
        if media:
            content_type = getattr(media, 'content_type', '')
            if content_type not in {'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'}:
                raise serializers.ValidationError('Only common image and video formats are supported.')
            attrs['media_type'] = 'video' if content_type.startswith('video/') else 'image'
        attrs['body'] = body
        attrs['hashtags'] = attrs.get('hashtags', '').strip()
        attrs['category'] = attrs.get('category', '').strip()
        return attrs


class CommentSerializer(serializers.ModelSerializer):
    post_id = serializers.IntegerField(read_only=True)
    parent_id = serializers.IntegerField(read_only=True)
    author_id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(source='author.username', read_only=True)
    display_name = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = (
            'id', 'post_id', 'parent_id', 'author_id', 'username', 'display_name',
            'body', 'created_at', 'likes_count', 'liked_by_me',
        )
        read_only_fields = (
            'id', 'post_id', 'parent_id', 'author_id', 'username', 'display_name',
            'created_at', 'likes_count', 'liked_by_me',
        )

    def get_display_name(self, comment):
        profile = getattr(comment.author, 'profile', None)
        return profile.display_name if profile and profile.display_name else comment.author.username

    def get_liked_by_me(self, comment):
        user = self.context['request'].user
        return comment.likes.filter(user=user).exists()

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Comment cannot be empty.')
        return value
