from django import forms

from departamentos.models import Departamento


class DepartamentoForm(forms.ModelForm):
    class Meta:
        model = Departamento
        fields = ("nombre", "descripcion")
        labels = {
            "nombre": "Nombre del departamento",
            "descripcion": "Descripcion",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs["class"] = "form-control"
