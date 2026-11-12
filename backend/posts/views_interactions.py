from django.db import IntegrityError, transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.models import Notification

from .models import Comment, CommentLike, Post, PostLike
from .permissions import can_view_post
from .serializers import CommentSerializer


def post_for_viewer(request, post_id):
    post = get_object_or_404(Post.objects.select_related('author'), pk=post_id)
    if post.deleted_at or post.suspended_at or not post.published_at or not can_view_post(post, request.user):
        return None
    return post


class PostLikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = post_for_viewer(request, post_id)
        if post is None:
            return Response({'detail': 'This post is unavailable.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            with transaction.atomic():
                like, created = PostLike.objects.get_or_create(post=post, user=request.user)
                if created:
                    Post.objects.filter(pk=post.pk).update(likes_count=F('likes_count') + 1)
                    if post.author_id != request.user.id:
                        Notification.objects.create(
                            recipient=post.author,
                            actor=request.user,
                            notification_type=Notification.LIKE,
                        )
        except IntegrityError:
            created = False
        post.refresh_from_db(fields=('likes_count',))
        return Response({'liked': True, 'likes_count': post.likes_count}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        with transaction.atomic():
            deleted, _ = PostLike.objects.filter(post=post, user=request.user).delete()
            if deleted:
                Post.objects.filter(pk=post.pk, likes_count__gt=0).update(likes_count=F('likes_count') - 1)
        post.refresh_from_db(fields=('likes_count',))
        return Response({'liked': False, 'likes_count': post.likes_count})


class CommentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, post_id):
        post = post_for_viewer(request, post_id)
        if post is None:
            return Response({'detail': 'This post is unavailable.'}, status=status.HTTP_404_NOT_FOUND)
        comments = Comment.objects.filter(post=post).select_related('author', 'author__profile').prefetch_related('likes')
        return Response(CommentSerializer(comments, many=True, context={'request': request}).data)

    def post(self, request, post_id):
        post = post_for_viewer(request, post_id)
        if post is None:
            return Response({'detail': 'This post is unavailable.'}, status=status.HTTP_404_NOT_FOUND)
        parent_id = request.data.get('parent_id')
        parent = None
        if parent_id:
            parent = get_object_or_404(Comment, pk=parent_id, post=post)
        serializer = CommentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            comment = serializer.save(post=post, author=request.user, parent=parent)
            Post.objects.filter(pk=post.pk).update(comments_count=F('comments_count') + 1)
            recipient = parent.author if parent else post.author
            if recipient.id != request.user.id:
                Notification.objects.create(
                    recipient=recipient,
                    actor=request.user,
                    notification_type=Notification.REPLY if parent else Notification.COMMENT,
                )
        return Response(CommentSerializer(comment, context={'request': request}).data, status=status.HTTP_201_CREATED)


class CommentLikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, comment_id):
        comment = get_object_or_404(Comment.objects.select_related('post', 'author'), pk=comment_id)
        if post_for_viewer(request, comment.post_id) is None:
            return Response({'detail': 'This comment is unavailable.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            with transaction.atomic():
                _, created = CommentLike.objects.get_or_create(comment=comment, user=request.user)
                if created:
                    Comment.objects.filter(pk=comment.pk).update(likes_count=F('likes_count') + 1)
                    if comment.author_id != request.user.id:
                        Notification.objects.create(
                            recipient=comment.author,
                            actor=request.user,
                            notification_type=Notification.COMMENT_LIKE,
                        )
        except IntegrityError:
            created = False
        comment.refresh_from_db(fields=('likes_count',))
        return Response({'liked': True, 'likes_count': comment.likes_count}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, comment_id):
        comment = get_object_or_404(Comment, pk=comment_id)
        with transaction.atomic():
            deleted, _ = CommentLike.objects.filter(comment=comment, user=request.user).delete()
            if deleted:
                Comment.objects.filter(pk=comment.pk, likes_count__gt=0).update(likes_count=F('likes_count') - 1)
        comment.refresh_from_db(fields=('likes_count',))
        return Response({'liked': False, 'likes_count': comment.likes_count})
