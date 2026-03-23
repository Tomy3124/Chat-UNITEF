from django.db import models


class Aviso(models.Model):
    TIPO_AVISO = "aviso"
    TIPO_ASIGNACION = "asignacion"
    TIPO_CHOICES = [
        (TIPO_AVISO, "Aviso"),
        (TIPO_ASIGNACION, "Asignacion"),
    ]

    titulo = models.CharField(max_length=180)
    contenido = models.TextField()
    archivo = models.FileField(upload_to="avisos/adjuntos/", blank=True, null=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default=TIPO_AVISO)
    departamento = models.ForeignKey(
        "departamentos.Departamento",
        on_delete=models.CASCADE,
        related_name="avisos",
    )
    directiva = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.SET_NULL,
        related_name="avisos_directiva",
        null=True,
        blank=True,
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "aviso"
        verbose_name_plural = "avisos"

    def __str__(self):
        return f"{self.titulo} - {self.departamento.nombre}"
