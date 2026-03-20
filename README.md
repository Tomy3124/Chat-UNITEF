# Chat UNITEF

Aplicacion web empresarial desarrollada con Django y Django Channels para la comunicacion interna entre usuarios de Directiva y Departamentos.

## Funciones principales

- Login y registro manual de usuarios.
- Dos roles:
  - `Directiva`: Director General, Administrativo o Tecnologico.
  - `Departamentos`: usuario asociado a un departamento.
- Chat en tiempo real por departamento con WebSockets.
- Historial persistente de mensajes.
- Envio de archivos.
- Avisos y asignaciones creados por la directiva.
- Panel responsivo para laptop y telefono.

## Instalacion

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Redis para Channels

Desarrollo local sin Redis:

```bash
set USE_REDIS=False
```

Produccion o multiinstancia con Redis:

```bash
set USE_REDIS=True
set REDIS_URL=redis://127.0.0.1:6379/1
```

## Migraciones

```bash
python manage.py makemigrations
python manage.py migrate
```

## Crear superusuario

```bash
python manage.py createsuperuser
```

## Ejecutar servidor

```bash
python manage.py runserver
```

Abrir `http://127.0.0.1:8000/`.

## Despliegue en Render

Este proyecto usa ASGI por Django Channels, asi que en Render debe iniciarse con un servidor ASGI, no con `runserver`.

Variables recomendadas:

- `DJANGO_SECRET_KEY`: clave secreta para produccion.
- `DJANGO_DEBUG=False`
- `USE_REDIS=False` si vas a usar una sola instancia.
- `REDIS_URL`: necesaria si luego activas `USE_REDIS=True`.
- `DATABASE_URL`: recomendada si conectas PostgreSQL de Render.
- `DJANGO_MEDIA_ROOT`: opcional si montas un disco persistente para archivos subidos.

Notas importantes:

- Si mantienes SQLite en Render, los datos pueden perderse al reiniciar o desplegar de nuevo si no usas disco persistente.
- Los archivos estaticos se sirven con WhiteNoise desde la misma app.
- Si los usuarios suben archivos, usa disco persistente en Render o almacenamiento externo; de lo contrario, esos archivos no duran entre despliegues.
- `RENDER_EXTERNAL_HOSTNAME` se detecta automaticamente para `ALLOWED_HOSTS` y CSRF.

Comandos:

```bash
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate
gunicorn intranet.asgi:application -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

## Flujo recomendado

1. Registra primero un usuario con rol `Directiva`.
2. Inicia sesion con ese usuario.
3. Crea los departamentos desde la interfaz.
4. Registra los usuarios de tipo `Departamentos`.
5. Usa las salas para enviar mensajes, archivos, avisos y asignaciones.
