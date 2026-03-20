from django.contrib import admin

from departamentos.models import Departamento


@admin.register(Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "directiva", "creado_en")
    search_fields = ("nombre", "directiva__username", "directiva__first_name")
