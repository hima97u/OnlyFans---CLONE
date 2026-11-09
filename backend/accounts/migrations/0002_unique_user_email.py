from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql='CREATE UNIQUE INDEX accounts_user_email_ci_unique ON auth_user (LOWER(email));',
            reverse_sql='DROP INDEX accounts_user_email_ci_unique;',
        ),
    ]
