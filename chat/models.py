from django.conf import settings
from django.db import models


class Mensaje(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mensajes",
        null=True,
        blank=True,
    )
    departamento = models.ForeignKey(
        "departamentos.Departamento",
        on_delete=models.CASCADE,
        related_name="mensajes",
    )
    directiva = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="mensajes_directiva",
        null=True,
        blank=True,
    )
    contenido = models.TextField(blank=True)
    archivo = models.FileField(upload_to="chat/archivos/", blank=True, null=True)
    responde_a = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="respuestas",
        null=True,
        blank=True,
    )
    fecha = models.DateTimeField(auto_now_add=True)
    visto_en = models.DateTimeField(null=True, blank=True)
    es_sistema = models.BooleanField(default=False)

    class Meta:
        ordering = ["fecha"]
        verbose_name = "mensaje"
        verbose_name_plural = "mensajes"

    def __str__(self):
        autor = self.usuario.username if self.usuario else "Sistema"
        return f"{autor}: {self.contenido[:40]}"


class MensajeEliminadoUsuario(models.Model):
    mensaje = models.ForeignKey(
        "chat.Mensaje",
        on_delete=models.CASCADE,
        related_name="eliminaciones",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mensajes_eliminados",
    )
    eliminado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("mensaje", "usuario")
        verbose_name = "mensaje eliminado para usuario"
        verbose_name_plural = "mensajes eliminados para usuario"


class DepartamentoLectura(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lecturas_departamento",
    )
    departamento = models.ForeignKey(
        "departamentos.Departamento",
        on_delete=models.CASCADE,
        related_name="lecturas_usuario",
    )
    ultimo_mensaje_id = models.PositiveBigIntegerField(default=0)
    ultimo_aviso_id = models.PositiveBigIntegerField(default=0)
    ultimo_asignacion_id = models.PositiveBigIntegerField(default=0)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("usuario", "departamento")
        verbose_name = "lectura de departamento"
        verbose_name_plural = "lecturas de departamento"

    def __str__(self):
        return f"{self.usuario} - {self.departamento} ({self.ultimo_mensaje_id})"
