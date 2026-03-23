from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.urls import reverse
from django.utils import timezone

from avisos.models import Aviso
from chat.models import Mensaje


def _file_metadata(field_file, open_url, download_url):
    if not field_file:
        return {
            "archivo_url": "",
            "archivo_nombre": "",
            "archivo_abrir_url": "",
            "archivo_descargar_url": "",
            "archivo_tipo": "",
            "archivo_es_imagen": False,
            "archivo_es_video": False,
        }

    name = field_file.name.split("/")[-1]
    lower_name = name.lower()
    image_exts = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".heic")
    video_exts = (".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv", ".3gp")
    is_image = lower_name.endswith(image_exts)
    is_video = lower_name.endswith(video_exts)
    file_type = "image" if is_image else "video" if is_video else "file"

    return {
        "archivo_url": field_file.url,
        "archivo_nombre": name,
        "archivo_abrir_url": open_url,
        "archivo_descargar_url": download_url,
        "archivo_tipo": file_type,
        "archivo_es_imagen": is_image,
        "archivo_es_video": is_video,
    }


def _autor_tipo_label(usuario):
    if not usuario:
        return "Sistema"
    if usuario.es_directiva:
        return usuario.get_tipo_directiva_display() or "Directiva"
    return "Departamento"


def serializar_mensaje(mensaje):
    fecha_local = timezone.localtime(mensaje.fecha)

    if mensaje.usuario:
        if mensaje.usuario.es_directiva:
            usuario_visible = mensaje.usuario.first_name or mensaje.usuario.username
        else:
            usuario_visible = mensaje.usuario.departamento.nombre if mensaje.usuario.departamento else mensaje.usuario.username
    else:
        usuario_visible = "Sistema"

    return {
        "kind": "message",
        "id": mensaje.id,
        "departamento_id": mensaje.departamento_id,
        "usuario_id": mensaje.usuario_id,
        "usuario": usuario_visible,
        "username": mensaje.usuario.username if mensaje.usuario else "sistema",
        "autor_label": mensaje.usuario.rol_label if mensaje.usuario else "Sistema",
        "autor_tipo_label": _autor_tipo_label(mensaje.usuario),
        "directiva_id": mensaje.directiva_id,
        "contenido": mensaje.contenido,
        "fecha": fecha_local.strftime("%I:%M %p"),
        "timestamp": int(fecha_local.timestamp() * 1000),
        **_file_metadata(
            mensaje.archivo,
            reverse("chat:abrir_archivo_mensaje", args=[mensaje.id]) if mensaje.archivo else "",
            reverse("chat:descargar_archivo_mensaje", args=[mensaje.id]) if mensaje.archivo else "",
        ),
        "es_sistema": mensaje.es_sistema,
    }


def serializar_aviso(aviso):
    fecha_local = timezone.localtime(aviso.fecha)

    if aviso.directiva:
        emisor_visible = aviso.directiva.first_name or aviso.directiva.username
    else:
        emisor_visible = aviso.departamento.nombre

    return {
        "kind": "notice",
        "id": aviso.id,
        "departamento_id": aviso.departamento_id,
        "directiva_id": aviso.directiva_id,
        "emisor": emisor_visible,
        "tipo": aviso.tipo,
        "tipo_label": aviso.get_tipo_display(),
        "titulo": aviso.titulo,
        "contenido": aviso.contenido,
        "fecha": fecha_local.strftime("%d/%m/%Y %I:%M %p"),
        "hora": fecha_local.strftime("%I:%M %p"),
        "timestamp": int(fecha_local.timestamp() * 1000),
        **_file_metadata(
            aviso.archivo,
            reverse("chat:abrir_archivo_aviso", args=[aviso.id]) if aviso.archivo else "",
            reverse("chat:descargar_archivo_aviso", args=[aviso.id]) if aviso.archivo else "",
        ),
    }


def emitir_mensaje_departamento(mensaje):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"departamento_{mensaje.departamento_id}",
        {
            "type": "chat.message",
            "message": serializar_mensaje(mensaje),
        },
    )


def emitir_aviso_departamento(aviso):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"departamento_{aviso.departamento_id}",
        {
            "type": "chat.notice",
            "notice": serializar_aviso(aviso),
        },
    )


def emitir_actualizacion_aviso(aviso):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"departamento_{aviso.departamento_id}",
        {
            "type": "chat.notice",
            "notice": {
                **serializar_aviso(aviso),
                "action": "updated",
            },
        },
    )


def emitir_eliminacion_aviso(aviso_id, departamento_id):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"departamento_{departamento_id}",
        {
            "type": "chat.notice",
            "notice": {
                "kind": "notice",
                "action": "deleted",
                "id": aviso_id,
                "departamento_id": departamento_id,
            },
        },
    )


def crear_aviso_y_mensaje(departamento, titulo, contenido, tipo=Aviso.TIPO_AVISO, directiva=None, archivo=None):
    aviso = Aviso.objects.create(
        titulo=titulo,
        contenido=contenido,
        archivo=archivo,
        tipo=tipo,
        departamento=departamento,
        directiva=directiva,
    )
    emitir_aviso_departamento(aviso)
    return aviso
