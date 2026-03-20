from django.urls import path

from chat.views import (
    abrir_archivo_mensaje,
    crear_departamento,
    descargar_archivo_mensaje,
    editar_aviso,
    editar_mensaje,
    eliminar_aviso,
    eliminar_departamentos,
    eliminar_mensaje,
    enviar_mensaje,
    home,
    limpiar_chat,
    marcar_panel_como_leido,
    obtener_actualizaciones,
    publicar_aviso,
    publicar_aviso_global,
    reenviar_mensaje,
    sala_chat,
    subir_archivo,
)


app_name = "chat"

urlpatterns = [
    path("inicio/", home, name="home"),
    path("chat/departamento/<int:departamento_id>/", sala_chat, name="sala"),
    path("chat/departamento/<int:departamento_id>/actualizaciones/", obtener_actualizaciones, name="obtener_actualizaciones"),
    path("chat/departamento/<int:departamento_id>/mensaje/", enviar_mensaje, name="enviar_mensaje"),
    path("chat/departamento/<int:departamento_id>/archivo/", subir_archivo, name="subir_archivo"),
    path("chat/departamento/<int:departamento_id>/panel-leido/", marcar_panel_como_leido, name="marcar_panel_como_leido"),
    path("chat/mensaje/<int:mensaje_id>/archivo/abrir/", abrir_archivo_mensaje, name="abrir_archivo_mensaje"),
    path("chat/mensaje/<int:mensaje_id>/archivo/descargar/", descargar_archivo_mensaje, name="descargar_archivo_mensaje"),
    path("chat/departamento/<int:departamento_id>/avisos/", publicar_aviso, name="publicar_aviso"),
    path("chat/departamento/<int:departamento_id>/limpiar/", limpiar_chat, name="limpiar_chat"),
    path("chat/mensaje/<int:mensaje_id>/editar/", editar_mensaje, name="editar_mensaje"),
    path("chat/mensaje/<int:mensaje_id>/eliminar/", eliminar_mensaje, name="eliminar_mensaje"),
    path("chat/mensaje/<int:mensaje_id>/reenviar/", reenviar_mensaje, name="reenviar_mensaje"),
    path("chat/aviso/<int:aviso_id>/editar/", editar_aviso, name="editar_aviso"),
    path("chat/aviso/<int:aviso_id>/eliminar/", eliminar_aviso, name="eliminar_aviso"),
    path("chat/departamentos/crear/", crear_departamento, name="crear_departamento"),
    path("chat/departamentos/eliminar/", eliminar_departamentos, name="eliminar_departamentos"),
    path("chat/avisos/publicar/", publicar_aviso_global, name="publicar_aviso_global"),
]
