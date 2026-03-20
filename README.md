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

## Flujo recomendado

1. Registra primero un usuario con rol `Directiva`.
2. Inicia sesion con ese usuario.
3. Crea los departamentos desde la interfaz.
4. Registra los usuarios de tipo `Departamentos`.
5. Usa las salas para enviar mensajes, archivos, avisos y asignaciones.
