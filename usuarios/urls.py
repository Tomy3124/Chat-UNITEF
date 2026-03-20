from django.urls import path

from usuarios.views import login_unitef, salir


urlpatterns = [
    path("", login_unitef, name="login"),
    path("salir/", salir, name="logout"),
]
