import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import F, Q


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Follow',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('follower', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='following_relationships',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('following', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='follower_relationships',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ('-created_at',),
                'indexes': [
                    models.Index(fields=('follower', 'created_at'), name='follow_follower_created'),
                    models.Index(fields=('following', 'created_at'), name='follow_following_created'),
                ],
                'constraints': [
                    models.UniqueConstraint(fields=('follower', 'following'), name='unique_follower_following'),
                    models.CheckConstraint(condition=~Q(follower=F('following')), name='follow_cannot_follow_self'),
                ],
            },
        ),
    ]
