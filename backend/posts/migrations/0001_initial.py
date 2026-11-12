from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name='Post',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('body', models.TextField(blank=True, validators=[django.core.validators.MaxLengthValidator(5000)])),
                ('media', models.FileField(blank=True, null=True, upload_to='posts/')),
                ('media_type', models.CharField(blank=True, max_length=20)),
                ('visibility', models.CharField(choices=[('free', 'Free'), ('followers', 'Followers'), ('subscriber', 'Subscribers')], default='free', max_length=20)),
                ('category', models.CharField(blank=True, max_length=100)),
                ('hashtags', models.CharField(blank=True, max_length=500)),
                ('published_at', models.DateTimeField(blank=True, default=django.utils.timezone.now, null=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('suspended_at', models.DateTimeField(blank=True, null=True)),
                ('likes_count', models.PositiveIntegerField(default=0)),
                ('comments_count', models.PositiveIntegerField(default=0)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='posts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-published_at', '-id'),
                'indexes': [
                    models.Index(fields=['published_at', 'id'], name='post_published_id'),
                    models.Index(fields=['author', 'published_at'], name='post_author_published'),
                    models.Index(fields=['visibility', 'published_at'], name='post_visibility_published'),
                ],
            },
        ),
    ]
