from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import Profile


class Command(BaseCommand):
    help = 'Create 40 local test users without creating related app data.'

    password = 'test123123'
    names = (
        ('Aarav', 'Sharma'),
        ('Anaya', 'Patel'),
        ('Liam', 'Bennett'),
        ('Emma', 'Wilson'),
        ('Noah', 'Carter'),
        ('Olivia', 'Brooks'),
        ('Ethan', 'Hayes'),
        ('Mia', 'Collins'),
        ('Lucas', 'Morgan'),
        ('Sophia', 'Reed'),
        ('Mateo', 'Rivera'),
        ('Ava', 'Mitchell'),
        ('Arjun', 'Kapoor'),
        ('Isabella', 'Turner'),
        ('Henry', 'Cooper'),
        ('Amelia', 'Ward'),
        ('Kabir', 'Mehta'),
        ('Charlotte', 'Baker'),
        ('Daniel', 'Foster'),
        ('Harper', 'Murphy'),
        ('Rohan', 'Iyer'),
        ('Ella', 'Richardson'),
        ('James', 'Parker'),
        ('Grace', 'Evans'),
        ('Vihaan', 'Nair'),
        ('Chloe', 'Stewart'),
        ('Oliver', 'Sullivan'),
        ('Saanvi', 'Rao'),
        ('Benjamin', 'Price'),
        ('Lily', 'Jenkins'),
        ('Aditya', 'Joshi'),
        ('Emily', 'Sanders'),
        ('William', 'Bell'),
        ('Zoe', 'Hughes'),
        ('Karan', 'Malhotra'),
        ('Sophie', 'Powell'),
        ('Michael', 'Long'),
        ('Nisha', 'Desai'),
        ('Alexander', 'Perry'),
        ('Ruby', 'Dixon'),
    )

    def handle(self, *args, **options):
        user_model = get_user_model()
        created_count = 0

        for number, (first_name, last_name) in enumerate(self.names, start=1):
            username = f'test_user_{number:02d}'
            email = f'{username}@example.com'
            user, created = user_model.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'is_active': True,
                },
            )
            if created:
                created_count += 1
            user.email = email
            user.first_name = first_name
            user.last_name = last_name
            user.is_active = True
            user.set_password(self.password)
            user.save(update_fields=['email', 'first_name', 'last_name', 'is_active', 'password'])
            Profile.objects.get_or_create(user=user)

        self.stdout.write(self.style.SUCCESS(
            f'Users ready: 40 test users ({created_count} created). '
            f'Password: {self.password}',
        ))
