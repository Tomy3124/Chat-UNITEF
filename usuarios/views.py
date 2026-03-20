from django.contrib.auth import login, logout
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.cache import never_cache
import re
import unicodedata

from departamentos.models import Departamento
from usuarios.forms import LoginUsuarioForm
from usuarios.models import Usuario


def _crear_username_departamento(nombre_departamento):
    base = slugify(nombre_departamento) or "departamento"
    username = f"depto_{base}"
    contador = 1
    while Usuario.objects.filter(username=username).exclude(
        rol=Usuario.ROL_DEPARTAMENTO,
        departamento__nombre__iexact=nombre_departamento,
    ).exists():
        contador += 1
        username = f"depto_{base}_{contador}"
    return username


def _normalizar_departamento(valor):
    texto = unicodedata.normalize("NFKD", valor or "")
    texto = "".join(caracter for caracter in texto if not unicodedata.combining(caracter))
    texto = texto.lower().strip()
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


def _puntaje_coincidencia_departamento(busqueda, nombre_departamento):
    consulta = _normalizar_departamento(busqueda)
    nombre = _normalizar_departamento(nombre_departamento)
    if not consulta or not nombre:
        return -1

    if consulta == nombre:
        return 1000

    consulta_tokens = [token for token in consulta.split(" ") if token]
    nombre_tokens = [token for token in nombre.split(" ") if token]
    if not consulta_tokens or not nombre_tokens:
        return -1

    token_exactos = sum(1 for token in consulta_tokens if token in nombre_tokens)
    token_parciales = sum(
        1 for token in consulta_tokens if any(token in candidato or candidato in token for candidato in nombre_tokens)
    )

    if token_exactos == len(consulta_tokens):
        return 800 + token_exactos * 10
    if consulta in nombre:
        return 700 + len(consulta)
    if token_exactos:
        return 500 + token_exactos * 10
    if token_parciales:
        return 300 + token_parciales * 10
    return -1


def _resolver_usuario_directiva(username, tipo_directiva):
    usuario = Usuario.objects.filter(
        rol=Usuario.ROL_DIRECTIVA,
        username__iexact=username,
    ).first()

    if usuario:
        usuario.tipo_directiva = tipo_directiva
        usuario.first_name = username
        usuario.last_seen = timezone.now()
        usuario.save(update_fields=["tipo_directiva", "first_name", "last_seen"])
        return usuario

    usuario = Usuario.objects.create(
        username=username,
        first_name=username,
        rol=Usuario.ROL_DIRECTIVA,
        tipo_directiva=tipo_directiva,
        is_active=True,
        last_seen=timezone.now(),
    )
    usuario.set_unusable_password()
    usuario.save(update_fields=["password"])
    return usuario


def _resolver_usuario_departamento(nombre_departamento):
    departamento = None
    mejor_puntaje = -1

    for candidato in Departamento.objects.filter(directiva__isnull=False).select_related("directiva"):
        puntaje = _puntaje_coincidencia_departamento(nombre_departamento, candidato.nombre)
        if puntaje > mejor_puntaje:
            mejor_puntaje = puntaje
            departamento = candidato

    if not departamento or mejor_puntaje < 0:
        return None

    usuario = Usuario.objects.filter(
        rol=Usuario.ROL_DEPARTAMENTO,
        departamento=departamento,
    ).first()

    if usuario:
        usuario.first_name = departamento.nombre
        usuario.last_seen = timezone.now()
        usuario.save(update_fields=["first_name", "last_seen"])
        return usuario

    usuario = Usuario.objects.create(
        username=_crear_username_departamento(departamento.nombre),
        first_name=departamento.nombre,
        rol=Usuario.ROL_DEPARTAMENTO,
        departamento=departamento,
        is_active=True,
        last_seen=timezone.now(),
    )
    usuario.set_unusable_password()
    usuario.save(update_fields=["password"])
    return usuario


@never_cache
def login_unitef(request):
    if request.user.is_authenticated:
        return redirect("chat:home")

    form = LoginUsuarioForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        rol = form.cleaned_data["rol"]
        if rol == Usuario.ROL_DIRECTIVA:
            usuario = _resolver_usuario_directiva(
                username=form.cleaned_data["username"],
                tipo_directiva=form.cleaned_data["tipo_directiva"],
            )
        else:
            usuario = _resolver_usuario_departamento(
                nombre_departamento=form.cleaned_data["departamento_nombre"],
            )
            if usuario is None:
                form.add_error("departamento_nombre", "No encontramos ese departamento. Puedes escribirlo sin preocuparte por tildes, comas o espacios exactos.")
                return render(request, "registration/login.html", {"form": form}, status=400)

        login(request, usuario, backend="django.contrib.auth.backends.ModelBackend")
        request.session.set_expiry(0)
        return redirect("chat:home")

    return render(request, "registration/login.html", {"form": form})


def salir(request):
    if request.user.is_authenticated:
        request.user.is_online = False
        request.user.last_seen = timezone.now()
        request.user.save(update_fields=["is_online", "last_seen"])
    logout(request)
    return redirect(reverse_lazy("login"))
