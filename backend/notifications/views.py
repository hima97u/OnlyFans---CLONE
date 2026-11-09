from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(
            recipient=request.user,
        ).select_related('actor', 'actor__profile')[:50]
        unread_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).count()
        return Response({
            'results': NotificationSerializer(
                notifications,
                many=True,
                context={'request': request},
            ).data,
            'unread_count': unread_count,
        })


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        updated = Notification.objects.filter(
            pk=notification_id,
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)
        if not updated:
            return Response(
                {'detail': 'Notification not found or already read.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({'detail': 'Notification marked as read.'})


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)
        return Response({'detail': 'Notifications marked as read.'})
