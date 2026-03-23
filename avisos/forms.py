from django import forms

from avisos.models import Aviso


class AvisoDirectivaForm(forms.ModelForm):
    class Meta:
        model = Aviso
        fields = ("tipo", "titulo", "contenido", "archivo")
        labels = {
            "tipo": "Tipo",
            "titulo": "Titulo",
            "contenido": "Mensaje o asignacion",
            "archivo": "Adjunto",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs["class"] = "form-control"

        self.fields["archivo"].required = False
        self.fields["archivo"].widget.attrs.update(
            {
                "accept": "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.csv",
            }
        )

    def clean(self):
        cleaned_data = super().clean()
        tipo = cleaned_data.get("tipo")
        contenido = (cleaned_data.get("contenido") or "").strip()
        archivo = cleaned_data.get("archivo")

        if tipo == Aviso.TIPO_ASIGNACION and not contenido and not archivo:
            raise forms.ValidationError("La asignacion debe incluir texto, imagen, video o archivo.")

        if tipo == Aviso.TIPO_AVISO and not contenido:
            raise forms.ValidationError("El aviso debe incluir contenido.")

        return cleaned_data
