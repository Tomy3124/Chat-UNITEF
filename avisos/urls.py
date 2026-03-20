from django.urls import path

from avisos.views import lista_avisos


app_name = "avisos"

urlpatterns = [
    path("", lista_avisos, name="lista"),
    path("departamento/<int:departamento_id>/", lista_avisos, name="por_departamento"),
]
