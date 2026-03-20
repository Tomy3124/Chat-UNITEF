from django.contrib import admin

from chat.models import DepartamentoLectura, Mensaje


@admin.register(Mensaje)
class MensajeAdmin(admin.ModelAdmin):
    list_display = ("usuario", "departamento", "fecha", "es_sistema")
    list_filter = ("departamento", "es_sistema")
    search_fields = ("contenido", "usuario__username", "usuario__first_name")


@admin.register(DepartamentoLectura)
class DepartamentoLecturaAdmin(admin.ModelAdmin):
    list_display = ("usuario", "departamento", "ultimo_mensaje_id", "actualizado_en")
    list_filter = ("departamento",)
    search_fields = ("usuario__username", "usuario__first_name", "departamento__nombre")
