from django.urls import re_path

from chat.consumers import DepartamentoChatConsumer


websocket_urlpatterns = [
    re_path(r"ws/chat/departamento/(?P<departamento_id>\d+)/$", DepartamentoChatConsumer.as_asgi()),
]
