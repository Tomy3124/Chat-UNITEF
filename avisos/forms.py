from django import forms

from avisos.models import Aviso


class AvisoDirectivaForm(forms.ModelForm):
    class Meta:
        model = Aviso
        fields = ("tipo", "titulo", "contenido")
        labels = {
            "tipo": "Tipo",
            "titulo": "Titulo",
            "contenido": "Mensaje o asignacion",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs["class"] = "form-control"
