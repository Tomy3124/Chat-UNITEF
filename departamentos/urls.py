from django.urls import path

from departamentos.views import detalle_departamento, lista_departamentos


app_name = "departamentos"

urlpatterns = [
    path("", lista_departamentos, name="lista"),
    path("<int:pk>/", detalle_departamento, name="detalle"),
]
