from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from usuarios.models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Empresa", {"fields": ("rol", "tipo_directiva", "departamento", "is_online", "last_seen")}),
    )
    list_display = ("username", "email", "rol", "tipo_directiva", "departamento", "is_online", "is_staff")
    list_filter = ("rol", "tipo_directiva", "departamento", "is_online", "is_staff")
