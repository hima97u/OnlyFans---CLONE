from django.db import migrations, models
from django.db.models.functions import Now


def populate_profile_timestamps(apps, schema_editor):
    profile_model = apps.get_model('accounts', 'Profile')
    profile_model.objects.update(created_at=Now(), updated_at=Now())


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_unique_user_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='profile',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.RunPython(
            code=populate_profile_timestamps,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name='profile',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AlterField(
            model_name='profile',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
