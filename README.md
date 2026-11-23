# WhatsApp Gateway API 🚀

Una API REST profesional, modular y escalable construida con **NestJS** y **TypeScript** para automatizar el envío de mensajería y contenido multimedia a través de WhatsApp. Utiliza **Baileys** para la conexión nativa por sockets y está completamente blindada con validaciones estructurales en sus DTOs.

---

## 🛠️ Tecnologías y Librerías Principales

- **Framework:** [NestJS (v10+)](https://nestjs.com/) - Arquitectura limpia y modular.
- **Protocolo WhatsApp:** `@whiskeysockets/baileys` - Conexión nativa de bajo impacto mediante WebSockets.
- **Documentación:** `@nestjs/swagger` - Interfaz interactiva para pruebas en el navegador.
- **Validación de Datos:** `class-validator` & `class-transformer` - Pipes globales para sanitización de inputs.
- **Procesamiento de Imágenes:** `jimp` - Motor de renderizado en JavaScript puro para compresión de miniaturas.

---

## 📦 Requisitos Previos

Asegúrate de tener instalado el siguiente entorno en tu servidor o máquina de desarrollo:

- **Sistema Operativo:** Linux (Recomendado Debian 12+) o compatible.
- **Node.js:** Versión 18 LTS o superior.
- **Administrador de Paquetes:** `npm` o `yarn`.

---

## 🚀 Instalación y Configuración

1. **Clonar el repositorio e instalar las dependencias:**
   ```bash
   npm install
   ```

## 2. Variables de Entorno (Opcional)

Crea un archivo `.env` en la raíz del proyecto si deseas parametrizar los puertos de escucha (por defecto corre en el puerto 3000).

## 3. Ejecutar en entorno de desarrollo (Modo Watch)

Para compilar y observar cambios en tiempo real en tu sistema Linux:

```bash
npm run start:dev
```

## 📘 Documentación Interactiva (Swagger API)

La API cuenta con una interfaz gráfica interactiva y auto-documentada mediante Swagger. Una vez que el servidor se encuentre corriendo, abre tu navegador web e ingresa a la siguiente ruta para realizar pruebas de consumo en caliente:

👉 [http://localhost:3000/docs](http://localhost:3000/docs)

## 🛣️ Endpoints Disponibles

Todos los endpoints se encuentran agrupados bajo el prefijo global `/whatsapp`.

### 1. Conectar / Obtener QR

- **Método:** `GET`
- **Ruta:** `/whatsapp/connect`
- **Descripción:** Inicializa el socket de Baileys de fondo. Si el cliente no está vinculado, genera y expone la cadena o estructura base de la sesión QR para su escaneo desde la aplicación móvil.

### 2. Enviar Mensaje de Texto

- **Método:** `POST`
- **Ruta:** `/whatsapp/send`
- **Content-Type:** `application/json`
- **Estructura del Payload (JSON):**

```json
{
  "phone": "59171234567",
  "message": "¡Hola! Este es un mensaje automatizado y validado desde NestJS. 🚀"
}
```

### 3. Enviar Imagen con Previsualización Directa

- **Método:** `POST`
- **Ruta:** `/whatsapp/send-image`
- **Content-Type:** `multipart/form-data`
- **Estructura del Formulario:**
  - `phone` (Texto - Obligatorio): Número de destino con código de país (Ej: 59171234567, sin símbolos `+` ni espacios).
  - `caption` (Texto - Opcional): Texto o pie de foto que acompañará al archivo multimedia.
  - `file` (Archivo Binario - Obligatorio): Archivo de imagen real (`.jpg`, `.jpeg`, `.png`).
- **Restricciones de Seguridad:** El endpoint cuenta con un interceptor perimetral que deniega automáticamente cualquier archivo que supere los 5 MB, respondiendo con un código `400 Bad Request` para salvaguardar la integridad de la memoria del servidor.

## 🔔 Webhook de GitLab -> WhatsApp

Notificaciones automáticas de Push Hooks y creación de ramas usando el servicio de Baileys ya existente.

- **Ruta completa:** `POST http://localhost:3000/api/webhooks/gitlab` (en producción, `https://<tu-dominio>/api/webhooks/gitlab`).
- **Seguridad:** header `x-gitlab-token`, comparado con `GITLAB_WEBHOOK_SECRET` mediante `timingSafeEqual`. Si no hay 401, se descartan eventos que no sean `push` y las eliminaciones de rama (`after` en ceros).
- **Configuración en GitLab:** *Settings > Webhooks* → URL del endpoint, Trigger: **Push events**, y en *Secret token* el mismo valor de `GITLAB_WEBHOOK_SECRET`. Se recomienda subir el timeout del webhook a 30s porque el servicio de envío incluye pausas anti-ban.

Variables nuevas (ver `.env.example`):

| Variable | Descripción |
| --- | --- |
| `GITLAB_WEBHOOK_SECRET` | Token secreto esperado en `x-gitlab-token`. Si se omite, el endpoint queda sin verificación. |
| `GITLAB_NOTIFY_TO` | JID de grupo (`...@g.us`), JID individual (`...@s.whatsapp.net`) o número con código de país. |

Ejemplo local:

```bash
curl -X POST http://localhost:3000/api/webhooks/gitlab \
  -H 'Content-Type: application/json' \
  -H 'x-gitlab-token: cambia-este-token-secreto' \
  -d '{
    "object_kind": "push",
    "ref": "refs/heads/feature/nueva-funcion",
    "before": "0000000000000000000000000000000000000000",
    "after": "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    "user_name": "Juan Perez",
    "project": {
      "name": "mi-proyecto",
      "path_with_namespace": "mi-grupo/mi-proyecto",
      "web_url": "https://gitlab.com/mi-grupo/mi-proyecto"
    },
    "commits": [{ "message": "Agrega nueva funcionalidad" }],
    "total_commits_count": 1
  }'
```

La respuesta siempre es `200` con `{ "recibido": true, "notificado": true|false, ... }`. Si Baileys está desconectado o falta `GITLAB_NOTIFY_TO`, el error se registra con el `Logger` de Nest y `notificado` es `false`, sin derribar la aplicación.

## 📜 Licencia

Desarrollado bajo los estándares de ingeniería de software para uso libre y comercial. Construido por **eledev**. 💻🔥
