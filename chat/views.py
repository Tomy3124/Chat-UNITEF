import mimetypes

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from avisos.forms import AvisoDirectivaForm
from avisos.models import Aviso
from chat.forms import ArchivoMensajeForm
from chat.models import DepartamentoLectura, Mensaje, MensajeEliminadoUsuario
from chat.services import (
    crear_aviso_y_mensaje,
    emitir_actualizacion_aviso,
    emitir_eliminacion_aviso,
    emitir_mensaje_departamento,
    serializar_mensaje,
)
from departamentos.forms import DepartamentoForm
from departamentos.models import Departamento
from usuarios.models import Usuario


def _requiere_directiva(user):
    if not user.es_directiva:
        raise PermissionDenied("Solo la directiva puede realizar esta accion.")


def _departamentos_visibles(usuario):
    if usuario.es_directiva:
        return Departamento.objects.filter(directiva=usuario).order_by("nombre")
    if usuario.es_departamento and usuario.departamento_id:
        return Departamento.objects.filter(pk=usuario.departamento_id)
    return Departamento.objects.none()


def _obtener_departamento_visible(usuario, departamento_id):
    return get_object_or_404(_departamentos_visibles(usuario), pk=departamento_id)


def _obtener_mensaje_visible(usuario, mensaje_id):
    mensaje = get_object_or_404(
        Mensaje.objects.select_related("departamento", "usuario", "directiva")
        .exclude(eliminaciones__usuario=usuario),
        pk=mensaje_id,
        es_sistema=False,
    )
    _obtener_departamento_visible(usuario, mensaje.departamento_id)

    if usuario.es_directiva:
        if mensaje.directiva_id != usuario.id:
            raise PermissionDenied("No puedes acceder a este archivo.")
        return mensaje

    directiva_esperada = _resolver_directiva_destino(
        usuario,
        mensaje.departamento,
        directiva_id=mensaje.directiva_id,
    )
    if directiva_esperada:
        if mensaje.directiva_id != directiva_esperada.id:
            raise PermissionDenied("No puedes acceder a este archivo.")
    elif mensaje.directiva_id is not None:
        raise PermissionDenied("No puedes acceder a este archivo.")
    return mensaje


def _filtro_directiva(usuario):
    if usuario.es_directiva:
        return Q(directiva=usuario)
    return Q()


def _filtro_conversacion(usuario, departamento, directiva_id=None):
    if usuario.es_directiva:
        return Q(directiva=usuario)

    directiva = _resolver_directiva_destino(usuario, departamento, directiva_id=directiva_id)
    if directiva:
        return Q(directiva=directiva)
    return Q(directiva__isnull=True)


def _resolver_directiva_destino(usuario, departamento, directiva_id=None):
    if usuario.es_directiva:
        return usuario

    if departamento.directiva_id:
        return departamento.directiva

    if directiva_id:
        directiva = Usuario.objects.filter(pk=directiva_id, rol=Usuario.ROL_DIRECTIVA).first()
        if directiva:
            return directiva

    directiva_pk = (
        Mensaje.objects.filter(
            departamento=departamento,
            usuario__rol=Usuario.ROL_DIRECTIVA,
            directiva__isnull=False,
        )
        .order_by("-id")
        .values_list("directiva", flat=True)
        .first()
    )
    if directiva_pk:
        return Usuario.objects.filter(pk=directiva_pk).first()

    return Usuario.objects.filter(rol=Usuario.ROL_DIRECTIVA).order_by("id").first()


def _obtener_conversaciones(usuario, departamentos):
    lecturas = {
        lectura.departamento_id: {
            "ultimo_mensaje_id": lectura.ultimo_mensaje_id,
            "ultimo_aviso_id": lectura.ultimo_aviso_id,
            "ultimo_asignacion_id": lectura.ultimo_asignacion_id,
        }
        for lectura in DepartamentoLectura.objects.filter(usuario=usuario, departamento__in=departamentos)
    }

    conversaciones = []
    for departamento in departamentos:
        directiva_objetivo = _resolver_directiva_destino(usuario, departamento)
        filtro_directiva = _filtro_conversacion(usuario, departamento)
        ultimo_mensaje = (
            Mensaje.objects.filter(departamento=departamento, es_sistema=False)
            .filter(filtro_directiva)
            .exclude(eliminaciones__usuario=usuario)
            .select_related("usuario")
            .order_by("-id")
            .first()
        )
        lectura = lecturas.get(
            departamento.id,
            {
                "ultimo_mensaje_id": 0,
                "ultimo_aviso_id": 0,
                "ultimo_asignacion_id": 0,
            },
        )
        no_leidos_mensajes = (
            Mensaje.objects.filter(
                departamento=departamento,
                es_sistema=False,
                id__gt=lectura["ultimo_mensaje_id"],
            )
            .filter(filtro_directiva)
            .exclude(eliminaciones__usuario=usuario)
            .exclude(usuario=usuario)
            .count()
        )
        no_leidos_avisos = Aviso.objects.filter(
            departamento=departamento,
            tipo=Aviso.TIPO_AVISO,
            id__gt=lectura["ultimo_aviso_id"],
        ).filter(
            filtro_directiva
        ).count()
        no_leidos_asignaciones = Aviso.objects.filter(
            departamento=departamento,
            tipo=Aviso.TIPO_ASIGNACION,
            id__gt=lectura["ultimo_asignacion_id"],
        ).filter(
            filtro_directiva
        ).count()
        no_leidos_total = no_leidos_mensajes + no_leidos_avisos + no_leidos_asignaciones

        cuerpo_ultimo = ""
        autor_ultimo = ""
        titulo_contacto = departamento.nombre
        if ultimo_mensaje:
            cuerpo_ultimo = ultimo_mensaje.contenido or "Archivo adjunto"
            if ultimo_mensaje.usuario:
                autor_ultimo = (
                    ultimo_mensaje.usuario.first_name or ultimo_mensaje.usuario.username
                    if ultimo_mensaje.usuario.es_directiva
                    else (ultimo_mensaje.usuario.departamento.nombre if ultimo_mensaje.usuario.departamento else "Departamento")
                )
            else:
                autor_ultimo = "Sistema"

        if usuario.es_departamento and directiva_objetivo:
            titulo_contacto = directiva_objetivo.get_tipo_directiva_display() or "Directiva"

        conversaciones.append(
            {
                "departamento": departamento,
                "ultimo_mensaje": ultimo_mensaje,
                "ultimo_cuerpo": cuerpo_ultimo,
                "ultimo_autor": autor_ultimo,
                "titulo_contacto": titulo_contacto,
                "no_leidos": no_leidos_total,
                "no_leidos_mensajes": no_leidos_mensajes,
                "no_leidos_avisos": no_leidos_avisos,
                "no_leidos_asignaciones": no_leidos_asignaciones,
            }
        )
    return conversaciones


def _obtener_estado_paneles(usuario, departamento):
    filtro_directiva = _filtro_conversacion(usuario, departamento)
    ultimo_aviso_id = (
        Aviso.objects.filter(departamento=departamento, tipo=Aviso.TIPO_AVISO)
        .filter(filtro_directiva)
        .order_by("-id")
        .values_list("id", flat=True)
        .first()
    ) or 0
    ultimo_asignacion_id = (
        Aviso.objects.filter(departamento=departamento, tipo=Aviso.TIPO_ASIGNACION)
        .filter(filtro_directiva)
        .order_by("-id")
        .values_list("id", flat=True)
        .first()
    ) or 0

    lectura = DepartamentoLectura.objects.filter(usuario=usuario, departamento=departamento).first()
    ultimo_aviso_leido = lectura.ultimo_aviso_id if lectura else 0
    ultimo_asignacion_leida = lectura.ultimo_asignacion_id if lectura else 0

    return {
        "ultimo_aviso_id": ultimo_aviso_id,
        "ultimo_asignacion_id": ultimo_asignacion_id,
        "no_leidos_avisos": Aviso.objects.filter(
            departamento=departamento,
            tipo=Aviso.TIPO_AVISO,
            id__gt=ultimo_aviso_leido,
        )
        .filter(filtro_directiva)
        .count(),
        "no_leidos_asignaciones": Aviso.objects.filter(
            departamento=departamento,
            tipo=Aviso.TIPO_ASIGNACION,
            id__gt=ultimo_asignacion_leida,
        )
        .filter(filtro_directiva)
        .count(),
    }


def _marcar_mensajes_como_leidos(usuario, departamento):
    filtro_directiva = _filtro_conversacion(usuario, departamento)
    ultimo_id_ajeno = (
        Mensaje.objects.filter(departamento=departamento, es_sistema=False)
        .filter(filtro_directiva)
        .exclude(eliminaciones__usuario=usuario)
        .exclude(usuario=usuario)
        .order_by("-id")
        .values_list("id", flat=True)
        .first()
    ) or 0

    lectura, _ = DepartamentoLectura.objects.get_or_create(
        usuario=usuario,
        departamento=departamento,
        defaults={
            "ultimo_mensaje_id": ultimo_id_ajeno,
            "ultimo_aviso_id": 0,
            "ultimo_asignacion_id": 0,
        },
    )
    campos_a_actualizar = []
    if ultimo_id_ajeno > lectura.ultimo_mensaje_id:
        lectura.ultimo_mensaje_id = ultimo_id_ajeno
        campos_a_actualizar.append("ultimo_mensaje_id")
    if campos_a_actualizar:
        lectura.save(update_fields=[*campos_a_actualizar, "actualizado_en"])


@login_required
def home(request):
    departamentos = _departamentos_visibles(request.user)

    conversaciones = _obtener_conversaciones(request.user, departamentos)
    return render(
        request,
        "chat/inicio.html",
        {
            "conversaciones": conversaciones,
            "departamentos": departamentos,
            "departamento_form": DepartamentoForm(),
            "aviso_form": AvisoDirectivaForm(),
        },
    )


@login_required
def sala_chat(request, departamento_id):
    departamento_actual = _obtener_departamento_visible(request.user, departamento_id)
    departamentos = _departamentos_visibles(request.user)
    filtro_directiva = _filtro_conversacion(request.user, departamento_actual)
    _marcar_mensajes_como_leidos(request.user, departamento_actual)
    mensajes = (
        Mensaje.objects.filter(departamento=departamento_actual, es_sistema=False)
        .filter(filtro_directiva)
        .exclude(eliminaciones__usuario=request.user)
        .select_related("usuario", "departamento")
        .order_by("fecha")
    )
    avisos = Aviso.objects.filter(
        departamento=departamento_actual,
        tipo=Aviso.TIPO_AVISO,
    ).filter(filtro_directiva).order_by("-fecha")[:6]
    asignaciones = Aviso.objects.filter(
        departamento=departamento_actual,
        tipo=Aviso.TIPO_ASIGNACION,
    ).filter(filtro_directiva).order_by("-fecha")[:6]
    usuarios = Usuario.objects.select_related("departamento").order_by("-is_online", "rol", "first_name", "username")
    conversaciones = _obtener_conversaciones(request.user, departamentos)
    conversacion_actual = next(
        (item for item in conversaciones if item["departamento"].id == departamento_actual.id),
        None,
    )
    estado_paneles = _obtener_estado_paneles(request.user, departamento_actual)
    directiva_activa = _resolver_directiva_destino(request.user, departamento_actual)

    header_title = departamento_actual.nombre
    header_subtitle = departamento_actual.descripcion or "Canal activo"
    if request.user.es_departamento and directiva_activa:
        header_title = directiva_activa.first_name or directiva_activa.username
        header_subtitle = directiva_activa.get_tipo_directiva_display() or "Directiva"

    contexto = {
        "conversaciones": conversaciones,
        "departamento_actual": departamento_actual,
        "directiva_activa_id": request.user.id if request.user.es_directiva else (directiva_activa.id if directiva_activa else ""),
        "directiva_activa": directiva_activa,
        "header_title": header_title,
        "header_subtitle": header_subtitle,
        "mensajes": mensajes,
        "avisos": avisos,
        "asignaciones": asignaciones,
        "usuarios": usuarios,
        "directivas": usuarios.filter(rol=Usuario.ROL_DIRECTIVA),
        "usuarios_departamentos": usuarios.filter(rol=Usuario.ROL_DEPARTAMENTO),
        "archivo_form": ArchivoMensajeForm(),
        "departamento_form": DepartamentoForm(),
        "aviso_form": AvisoDirectivaForm(),
        "panel_no_leidos_avisos": (conversacion_actual or {}).get("no_leidos_avisos", estado_paneles["no_leidos_avisos"]),
        "panel_no_leidos_asignaciones": (conversacion_actual or {}).get("no_leidos_asignaciones", estado_paneles["no_leidos_asignaciones"]),
    }
    return render(request, "chat/chat.html", contexto)


@login_required
@require_POST
def marcar_panel_como_leido(request, departamento_id):
    departamento = _obtener_departamento_visible(request.user, departamento_id)
    panel = request.POST.get("panel")
    if panel not in {"notices", "assignments"}:
        return JsonResponse({"ok": False, "error": "Panel no valido."}, status=400)

    estado_paneles = _obtener_estado_paneles(request.user, departamento)
    lectura, _ = DepartamentoLectura.objects.get_or_create(
        usuario=request.user,
        departamento=departamento,
        defaults={
            "ultimo_mensaje_id": 0,
            "ultimo_aviso_id": 0,
            "ultimo_asignacion_id": 0,
        },
    )

    campos_a_actualizar = []
    if panel == "notices" and estado_paneles["ultimo_aviso_id"] > lectura.ultimo_aviso_id:
        lectura.ultimo_aviso_id = estado_paneles["ultimo_aviso_id"]
        campos_a_actualizar.append("ultimo_aviso_id")
    if panel == "assignments" and estado_paneles["ultimo_asignacion_id"] > lectura.ultimo_asignacion_id:
        lectura.ultimo_asignacion_id = estado_paneles["ultimo_asignacion_id"]
        campos_a_actualizar.append("ultimo_asignacion_id")

    if campos_a_actualizar:
        lectura.save(update_fields=[*campos_a_actualizar, "actualizado_en"])

    estado_actualizado = _obtener_estado_paneles(request.user, departamento)
    return JsonResponse(
        {
            "ok": True,
            "panel": panel,
            "no_leidos_avisos": estado_actualizado["no_leidos_avisos"],
            "no_leidos_asignaciones": estado_actualizado["no_leidos_asignaciones"],
        }
    )


@login_required
@require_POST
def publicar_aviso_global(request):
    _requiere_directiva(request.user)
    departamento = _obtener_departamento_visible(request.user, request.POST.get("departamento_id"))
    form = AvisoDirectivaForm(request.POST)
    if not form.is_valid():
        return redirect("chat:home")

    crear_aviso_y_mensaje(
        departamento=departamento,
        directiva=request.user,
        titulo=form.cleaned_data["titulo"],
        contenido=form.cleaned_data["contenido"],
        tipo=form.cleaned_data["tipo"],
    )
    return redirect("chat:sala", departamento_id=departamento.id)


@login_required
@require_POST
def subir_archivo(request, departamento_id):
    departamento = _obtener_departamento_visible(request.user, departamento_id)
    form = ArchivoMensajeForm(request.POST, request.FILES)
    if not form.is_valid():
        return JsonResponse({"ok": False, "error": "Selecciona un archivo valido."}, status=400)

    directiva = _resolver_directiva_destino(
        request.user,
        departamento,
        directiva_id=request.POST.get("directiva_id"),
    )
    mensaje = Mensaje.objects.create(
        usuario=request.user,
        departamento=departamento,
        directiva=directiva,
        archivo=form.cleaned_data["archivo"],
        contenido=request.POST.get("contenido", "").strip(),
    )
    emitir_mensaje_departamento(mensaje)
    return JsonResponse({"ok": True})


@login_required
@require_POST
def enviar_mensaje(request, departamento_id):
    departamento = _obtener_departamento_visible(request.user, departamento_id)
    contenido = request.POST.get("contenido", "").strip()
    archivo = request.FILES.get("archivo")

    if not contenido and not archivo:
        return JsonResponse({"ok": False, "error": "Escribe un mensaje o adjunta un archivo."}, status=400)

    directiva = _resolver_directiva_destino(
        request.user,
        departamento,
        directiva_id=request.POST.get("directiva_id"),
    )

    mensaje = Mensaje.objects.create(
        usuario=request.user,
        departamento=departamento,
        directiva=directiva,
        contenido=contenido,
        archivo=archivo,
    )
    emitir_mensaje_departamento(mensaje)
    return JsonResponse({"ok": True, "message": serializar_mensaje(mensaje)})


@login_required
def abrir_archivo_mensaje(request, mensaje_id):
    mensaje = _obtener_mensaje_visible(request.user, mensaje_id)
    if not mensaje.archivo:
        raise Http404("Archivo no disponible.")

    mensaje.archivo.open("rb")
    content_type = mimetypes.guess_type(mensaje.archivo.name)[0] or "application/octet-stream"
    return FileResponse(
        mensaje.archivo,
        as_attachment=False,
        filename=mensaje.archivo.name.split("/")[-1],
        content_type=content_type,
    )


@login_required
def descargar_archivo_mensaje(request, mensaje_id):
    mensaje = _obtener_mensaje_visible(request.user, mensaje_id)
    if not mensaje.archivo:
        raise Http404("Archivo no disponible.")

    mensaje.archivo.open("rb")
    content_type = mimetypes.guess_type(mensaje.archivo.name)[0] or "application/octet-stream"
    return FileResponse(
        mensaje.archivo,
        as_attachment=True,
        filename=mensaje.archivo.name.split("/")[-1],
        content_type=content_type,
    )


@login_required
@require_POST
def crear_departamento(request):
    _requiere_directiva(request.user)
    form = DepartamentoForm(request.POST)
    if form.is_valid():
        departamento = form.save(commit=False)
        departamento.directiva = request.user
        departamento.save()
        return redirect("chat:sala", departamento_id=departamento.id)
    return render(
        request,
        "chat/inicio.html",
        {
            "conversaciones": _obtener_conversaciones(request.user, _departamentos_visibles(request.user)),
            "departamentos": _departamentos_visibles(request.user),
            "departamento_form": form,
            "aviso_form": AvisoDirectivaForm(),
        },
        status=400,
    )


@login_required
@require_POST
def eliminar_departamentos(request):
    _requiere_directiva(request.user)
    ids = request.POST.getlist("departamento_ids[]") or request.POST.getlist("departamento_ids")
    if not ids:
        return JsonResponse({"ok": False, "error": "Selecciona al menos un departamento."}, status=400)

    departamentos = Departamento.objects.filter(id__in=ids, directiva=request.user)
    total = departamentos.count()
    departamentos.delete()
    return JsonResponse({"ok": True, "deleted": total})


@login_required
@require_POST
def editar_mensaje(request, mensaje_id):
    mensaje = get_object_or_404(Mensaje, pk=mensaje_id)
    if mensaje.usuario_id != request.user.id:
        raise PermissionDenied("Solo puedes editar tus propios mensajes.")

    contenido = request.POST.get("contenido", "").strip()
    if not contenido and not mensaje.archivo:
        return JsonResponse({"ok": False, "error": "El mensaje no puede quedar vacio."}, status=400)

    mensaje.contenido = contenido
    mensaje.save(update_fields=["contenido"])
    return JsonResponse({"ok": True, "contenido": mensaje.contenido})


@login_required
@require_POST
def eliminar_mensaje(request, mensaje_id):
    mensaje = get_object_or_404(Mensaje, pk=mensaje_id)
    alcance = request.POST.get("scope", "me")

    if alcance == "all":
        if mensaje.usuario_id != request.user.id:
            raise PermissionDenied("Solo puedes eliminar para todos tus propios mensajes.")
        mensaje.delete()
        return JsonResponse({"ok": True, "scope": "all"})

    MensajeEliminadoUsuario.objects.get_or_create(mensaje=mensaje, usuario=request.user)
    return JsonResponse({"ok": True, "scope": "me"})


@login_required
@require_POST
def reenviar_mensaje(request, mensaje_id):
    mensaje_origen = get_object_or_404(Mensaje, pk=mensaje_id)
    destino_id = request.POST.get("departamento_id")
    if not destino_id:
        return JsonResponse({"ok": False, "error": "Selecciona un departamento destino."}, status=400)

    departamento_destino = _obtener_departamento_visible(request.user, destino_id)
    contenido_base = (mensaje_origen.contenido or "").strip()
    contenido = f"↪️ {contenido_base}" if contenido_base else "↪️ Archivo reenviado"
    mensaje_reenviado = Mensaje.objects.create(
        usuario=request.user,
        departamento=departamento_destino,
        directiva=request.user if request.user.es_directiva else mensaje_origen.directiva,
        contenido=contenido,
        archivo=mensaje_origen.archivo,
    )
    emitir_mensaje_departamento(mensaje_reenviado)
    return JsonResponse({"ok": True})


@login_required
@require_POST
def limpiar_chat(request, departamento_id):
    departamento = _obtener_departamento_visible(request.user, departamento_id)
    filtro = _filtro_conversacion(request.user, departamento, directiva_id=request.POST.get("directiva_id"))
    mensajes = Mensaje.objects.filter(departamento=departamento, es_sistema=False).filter(filtro)
    eliminaciones = [
        MensajeEliminadoUsuario(mensaje=mensaje, usuario=request.user)
        for mensaje in mensajes.exclude(eliminaciones__usuario=request.user)
    ]
    MensajeEliminadoUsuario.objects.bulk_create(eliminaciones, ignore_conflicts=True)
    return JsonResponse({"ok": True, "deleted": len(eliminaciones)})


@login_required
@require_POST
def editar_aviso(request, aviso_id):
    _requiere_directiva(request.user)
    aviso = get_object_or_404(Aviso, pk=aviso_id, directiva=request.user)
    form = AvisoDirectivaForm(request.POST, instance=aviso)
    if not form.is_valid():
        return JsonResponse({"ok": False, "error": "No se pudo editar el aviso."}, status=400)
    aviso = form.save()
    emitir_actualizacion_aviso(aviso)
    return JsonResponse(
        {
            "ok": True,
            "titulo": aviso.titulo,
            "contenido": aviso.contenido,
            "tipo": aviso.tipo,
            "fecha": aviso.fecha.strftime("%d/%m/%Y %I:%M %p"),
        }
    )


@login_required
@require_POST
def eliminar_aviso(request, aviso_id):
    _requiere_directiva(request.user)
    aviso = get_object_or_404(Aviso, pk=aviso_id, directiva=request.user)
    departamento_id = aviso.departamento_id
    aviso_id_actual = aviso.id
    aviso.delete()
    emitir_eliminacion_aviso(aviso_id_actual, departamento_id)
    return JsonResponse({"ok": True})


@login_required
@require_POST
def publicar_aviso(request, departamento_id):
    _requiere_directiva(request.user)
    departamento = _obtener_departamento_visible(request.user, departamento_id)
    form = AvisoDirectivaForm(request.POST)
    if not form.is_valid():
        return redirect("chat:sala", departamento_id=departamento.id)

    crear_aviso_y_mensaje(
        departamento=departamento,
        directiva=request.user,
        titulo=form.cleaned_data["titulo"],
        contenido=form.cleaned_data["contenido"],
        tipo=form.cleaned_data["tipo"],
    )
    return redirect("chat:sala", departamento_id=departamento.id)
