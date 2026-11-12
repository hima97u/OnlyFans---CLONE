from follows.models import Follow


def can_view_post(post, user):
    if post.author_id == user.id or post.visibility == post.FREE:
        return True
    if post.visibility == post.FOLLOWERS:
        return Follow.objects.filter(follower=user, following_id=post.author_id).exists()
    return False
