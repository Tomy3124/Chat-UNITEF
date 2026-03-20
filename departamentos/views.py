from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import get_object_or_404, render

from departamentos.models import Departamento


@login_required
def lista_departamentos(request):
    if request.user.es_directiva:
        departamentos = Departamento.objects.filter(directiva=request.user)
    elif request.user.departamento_id:
        departamentos = Departamento.objects.filter(pk=request.user.departamento_id)
    else:
        departamentos = Departamento.objects.none()
    return render(request, "chat/departamentos.html", {"departamentos": departamentos})


@login_required
def detalle_departamento(request, pk):
    if request.user.es_directiva:
        departamento = get_object_or_404(Departamento, pk=pk, directiva=request.user)
    else:
        departamento = get_object_or_404(Departamento, pk=pk)
        if request.user.departamento_id != departamento.id:
            raise Http404()
    return render(request, "chat/departamento_detalle.html", {"departamento": departamento})
