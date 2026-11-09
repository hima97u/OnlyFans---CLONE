from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    actor_id = serializers.IntegerField(read_only=True)
    actor_username = serializers.SerializerMethodField()
    actor_display_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            'id', 'notification_type', 'is_read', 'created_at',
            'actor_id', 'actor_username', 'actor_display_name',
        )
        read_only_fields = fields

    def get_actor_username(self, notification):
        return notification.actor.username if notification.actor else None

    def get_actor_display_name(self, notification):
        if not notification.actor:
            return None
        profile = getattr(notification.actor, 'profile', None)
        return profile.display_name if profile else None
