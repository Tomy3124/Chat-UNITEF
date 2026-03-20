from django import forms

from usuarios.models import Usuario


class LoginUsuarioForm(forms.Form):
    rol = forms.ChoiceField(
        label="Rol de acceso",
        choices=Usuario.ROL_CHOICES,
    )
    username = forms.CharField(label="Usuario", required=False)
    tipo_directiva = forms.ChoiceField(
        label="Tipo de directiva",
        choices=[("", "Selecciona una opcion"), *Usuario.TIPO_DIRECTIVA_CHOICES],
        required=False,
    )
    departamento_nombre = forms.CharField(label="Departamento", required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs["class"] = "form-control"
        self.fields["rol"].widget.attrs["id"] = "id_rol"
        self.fields["username"].widget.attrs["data-role-group"] = "directiva"
        self.fields["tipo_directiva"].widget.attrs["data-role-group"] = "directiva"
        self.fields["departamento_nombre"].widget.attrs["data-role-group"] = "departamento"
        self.fields["departamento_nombre"].widget.attrs["placeholder"] = "Ej. Finanzas"
        self.fields["departamento_nombre"].help_text = "Puedes escribir el nombre sin tildes, comas o espacios exactos."

    def clean(self):
        cleaned_data = super().clean()
        rol = cleaned_data.get("rol")
        username = (cleaned_data.get("username") or "").strip()
        tipo_directiva = cleaned_data.get("tipo_directiva")
        departamento_nombre = (cleaned_data.get("departamento_nombre") or "").strip()

        if rol == Usuario.ROL_DIRECTIVA:
            if not username:
                self.add_error("username", "Escribe el usuario de directiva.")
            if not tipo_directiva:
                self.add_error("tipo_directiva", "Selecciona el tipo de directiva.")

        if rol == Usuario.ROL_DEPARTAMENTO and not departamento_nombre:
            self.add_error("departamento_nombre", "Escribe el nombre del departamento.")

        cleaned_data["username"] = username
        cleaned_data["departamento_nombre"] = departamento_nombre
        return cleaned_data
