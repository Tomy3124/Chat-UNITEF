from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render

from avisos.models import Aviso
from departamentos.models import Departamento


@login_required
def lista_avisos(request, departamento_id=None):
    avisos = Aviso.objects.select_related("departamento")
    departamento = None
    if departamento_id:
        departamento = get_object_or_404(Departamento, pk=departamento_id)
        avisos = avisos.filter(departamento=departamento)
    return render(
        request,
        "chat/avisos.html",
        {"avisos": avisos[:20], "departamento": departamento},
    )
