from django.contrib import admin

from avisos.models import Aviso


@admin.register(Aviso)
class AvisoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "departamento", "fecha")
    search_fields = ("titulo", "contenido")
    list_filter = ("departamento",)
