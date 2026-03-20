from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Usuario(AbstractUser):
    ROL_DIRECTIVA = "directiva"
    ROL_DEPARTAMENTO = "departamento"
    ROL_CHOICES = [
        (ROL_DIRECTIVA, "Directiva"),
        (ROL_DEPARTAMENTO, "Departamentos"),
    ]

    DIRECTOR_GENERAL = "general"
    DIRECTOR_ADMINISTRATIVO = "administrativo"
    DIRECTOR_TECNOLOGICO = "tecnologico"
    TIPO_DIRECTIVA_CHOICES = [
        (DIRECTOR_GENERAL, "Director General"),
        (DIRECTOR_ADMINISTRATIVO, "Director Administrativo"),
        (DIRECTOR_TECNOLOGICO, "Director Tecnologico"),
    ]

    rol = models.CharField(max_length=20, choices=ROL_CHOICES, default=ROL_DEPARTAMENTO)
    tipo_directiva = models.CharField(max_length=20, choices=TIPO_DIRECTIVA_CHOICES, blank=True)
    departamento = models.ForeignKey(
        "departamentos.Departamento",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="usuarios",
    )
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self):
        return self.get_full_name() or self.username

    def clean(self):
        super().clean()
        if self.rol == self.ROL_DIRECTIVA and not self.tipo_directiva:
            raise ValidationError({"tipo_directiva": "La directiva requiere un tipo de director."})
        if self.rol == self.ROL_DEPARTAMENTO and not self.departamento:
            raise ValidationError({"departamento": "El usuario de departamento debe tener un departamento."})

    def save(self, *args, **kwargs):
        if self.rol == self.ROL_DIRECTIVA:
            self.departamento = None
        if self.rol == self.ROL_DEPARTAMENTO:
            self.tipo_directiva = ""
        super().save(*args, **kwargs)

    @property
    def es_directiva(self):
        return self.rol == self.ROL_DIRECTIVA

    @property
    def es_departamento(self):
        return self.rol == self.ROL_DEPARTAMENTO

    @property
    def rol_label(self):
        if self.es_directiva:
            return self.get_tipo_directiva_display() or "Directiva"
        return self.departamento.nombre if self.departamento else "Departamento"
