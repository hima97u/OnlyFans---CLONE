from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import F
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Profile
from notifications.models import Notification

from .models import Follow
from .serializers import FollowSerializer, FollowUserSerializer


User = get_user_model()


def active_user(user_id):
    return User.objects.filter(pk=user_id, is_active=True).select_related('profile').first()


class FollowActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        target = active_user(user_id)
        if target is None:
            return Response({'detail': 'This account is unavailable.'}, status=status.HTTP_404_NOT_FOUND)
        if target.pk == request.user.pk:
            return Response({'detail': 'You cannot follow yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        target_profile, _ = Profile.objects.get_or_create(user=target)
        Profile.objects.get_or_create(user=request.user)
        if target_profile.is_private:
            return Response(
                {'detail': 'This account is private and requires a follow request.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            with transaction.atomic():
                follow, created = Follow.objects.get_or_create(
                    follower=request.user,
                    following=target,
                )
                if not created:
                    return Response(
                        {'detail': 'You already follow this account.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                Profile.objects.filter(user=request.user).update(following_count=F('following_count') + 1)
                Profile.objects.filter(user=target).update(followers_count=F('followers_count') + 1)
                Notification.objects.create(
                    recipient=target,
                    actor=request.user,
                    notification_type=Notification.FOLLOW,
                )
        except IntegrityError:
            return Response(
                {'detail': 'You already follow this account.'},
                status=status.HTTP_409_CONFLICT,
            )

        follow.refresh_from_db()
        current_profile, _ = Profile.objects.get_or_create(user=request.user)
        current_profile.refresh_from_db()
        target_profile.refresh_from_db()
        return Response(
            {
                'detail': 'Followed successfully.',
                'following': True,
                'follower_counts': {
                    'followers': target_profile.followers_count,
                    'following': target_profile.following_count,
                },
                'current_user_counts': {
                    'followers': current_profile.followers_count,
                    'following': current_profile.following_count,
                },
                'follow': FollowSerializer(follow, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, user_id):
        target = active_user(user_id)
        if target is None:
            return Response({'detail': 'This account is unavailable.'}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            follow = Follow.objects.filter(follower=request.user, following=target).first()
            if follow is None:
                return Response(
                    {'detail': 'You do not follow this account.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            follow.delete()
            Profile.objects.filter(user=request.user).update(
                following_count=F('following_count') - 1,
            )
            Profile.objects.filter(user=target).update(
                followers_count=F('followers_count') - 1,
            )
        current_profile, _ = Profile.objects.get_or_create(user=request.user)
        current_profile.refresh_from_db()
        target_profile, _ = Profile.objects.get_or_create(user=target)
        target_profile.refresh_from_db()
        return Response({
            'detail': 'Unfollowed successfully.',
            'following': False,
            'follower_counts': {
                'followers': target_profile.followers_count,
                'following': target_profile.following_count,
            },
            'current_user_counts': {
                'followers': current_profile.followers_count,
                'following': current_profile.following_count,
            },
        })


class FollowListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id, direction):
        target = active_user(user_id)
        if target is None:
            return Response({'detail': 'This account is unavailable.'}, status=status.HTTP_404_NOT_FOUND)
        relation_field = 'following' if direction == 'followers' else 'follower'
        users = Profile.objects.filter(
            user__is_active=True,
            **{f'user__{relation_field}_relationships__{"following" if direction == "followers" else "follower"}': target},
        ).select_related('user').distinct()
        return Response(FollowUserSerializer(users, many=True, context={'request': request}).data)


class FollowStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        target = active_user(user_id)
        if target is None:
            return Response({'detail': 'This account is unavailable.'}, status=status.HTTP_404_NOT_FOUND)
        follow = Follow.objects.filter(follower=request.user, following=target).exists()
        profile, _ = Profile.objects.get_or_create(user=target)
        return Response({
            'user_id': target.pk,
            'following': follow,
            'is_private': profile.is_private,
            'followers_count': profile.followers_count,
            'following_count': profile.following_count,
        })


class PeopleSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response([])
        profiles = Profile.objects.filter(
            user__is_active=True,
        ).filter(
            Q(user__username__icontains=query)
            | Q(user__first_name__icontains=query)
            | Q(user__last_name__icontains=query)
            | Q(display_name__icontains=query),
        ).exclude(user=request.user).select_related('user')[:20]
        return Response(FollowUserSerializer(
            profiles,
            many=True,
            context={'request': request},
        ).data)
