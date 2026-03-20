from django import forms


class ArchivoMensajeForm(forms.Form):
    archivo = forms.FileField(label="Archivo")
