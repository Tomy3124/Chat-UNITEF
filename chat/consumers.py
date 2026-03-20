import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from chat.models import Mensaje
from chat.services import serializar_mensaje
from departamentos.models import Departamento


class DepartamentoChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close()
            return

        self.departamento_id = self.scope["url_route"]["kwargs"]["departamento_id"]
        if not await self._usuario_puede_acceder():
            await self.close()
            return
        self.room_group_name = f"departamento_{self.departamento_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self._marcar_usuario(True)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        user = self.scope.get("user")
        if user and user.is_authenticated:
            await self._marcar_usuario(False)

    async def receive(self, text_data):
        payload = json.loads(text_data)
        contenido = payload.get("contenido", "").strip()
        if not contenido:
            return

        mensaje = await self._guardar_mensaje(contenido)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat.message",
                "message": mensaje,
            },
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["message"]))

    async def chat_notice(self, event):
        await self.send(text_data=json.dumps(event["notice"]))

    @database_sync_to_async
    def _guardar_mensaje(self, contenido):
        departamento = Departamento.objects.get(pk=self.departamento_id)
        mensaje = Mensaje.objects.create(
            usuario=self.scope["user"],
            departamento=departamento,
            directiva=self.scope["user"] if self.scope["user"].es_directiva else departamento.directiva,
            contenido=contenido,
        )
        return serializar_mensaje(mensaje)

    @database_sync_to_async
    def _usuario_puede_acceder(self):
        usuario = self.scope["user"]
        if usuario.es_directiva:
            return Departamento.objects.filter(pk=self.departamento_id, directiva=usuario).exists()
        return bool(usuario.departamento_id and str(usuario.departamento_id) == str(self.departamento_id))

    @database_sync_to_async
    def _marcar_usuario(self, en_linea):
        usuario = self.scope["user"]
        usuario.is_online = en_linea
        usuario.last_seen = timezone.now()
        usuario.save(update_fields=["is_online", "last_seen"])
