from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver
from django.utils import timezone


@receiver(user_logged_in)
def marcar_en_linea(sender, user, request, **kwargs):
    user.is_online = True
    user.last_seen = timezone.now()
    user.save(update_fields=["is_online", "last_seen"])


@receiver(user_logged_out)
def marcar_fuera_de_linea(sender, user, request, **kwargs):
    if user:
        user.is_online = False
        user.last_seen = timezone.now()
        user.save(update_fields=["is_online", "last_seen"])
