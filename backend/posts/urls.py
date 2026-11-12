from django.urls import path

from .views import PostCreateView, PostListView
from .views_interactions import CommentLikeView, CommentListCreateView, PostLikeView

urlpatterns = [
    path('', PostListView.as_view(), name='post-list'),
    path('create/', PostCreateView.as_view(), name='post-create'),
    path('<int:post_id>/like/', PostLikeView.as_view(), name='post-like'),
    path('<int:post_id>/comments/', CommentListCreateView.as_view(), name='comment-list-create'),
    path('comments/<int:comment_id>/like/', CommentLikeView.as_view(), name='comment-like'),
]
