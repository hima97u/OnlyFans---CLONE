from django.urls import path

from .views import FollowActionView, FollowListView, FollowStatusView, PeopleSearchView

urlpatterns = [
    path('search/', PeopleSearchView.as_view(), name='people-search'),
    path('<int:user_id>/', FollowActionView.as_view(), name='follow-action'),
    path('followers/<int:user_id>/', FollowListView.as_view(), {'direction': 'followers'}, name='followers-list'),
    path('following/<int:user_id>/', FollowListView.as_view(), {'direction': 'following'}, name='following-list'),
    path('status/<int:user_id>/', FollowStatusView.as_view(), name='follow-status'),
]
