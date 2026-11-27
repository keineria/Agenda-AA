# Conectar Google (Calendar + Meet, Drive y Sheets)

Guía paso a paso para hacerla con Alexandra y Angela. Toma unos 20 minutos y se hace **una sola vez**.
Todo es gratis: no requiere Google Workspace ni tarjeta.

Qué hace la agenda con Google:

- **Calendar:** crea un evento por cita. Si la cita es virtual, el evento trae su enlace de **Google Meet**.
- **Drive:** crea la carpeta `AA Solutions · Agendamientos` y dentro una carpeta por cita con los documentos que subió el cliente.
- **Sheets:** crea la hoja `AA Solutions · Agendamientos` con una fila por cita (los datos sensibles van enmascarados, por ejemplo `•••• 1234`).

La app solo puede ver los archivos de Drive que ella misma crea (permiso `drive.file`), no el resto del Drive.

---

## Antes de empezar

- Inicia sesión en Chrome con **infoaasolutionservices@gmail.com** (y solo con esa cuenta, para no confundir).
- Ten a mano acceso al servidor para editar el archivo `.env` de la agenda (ver `DEPLOY.md`).
- Dirección de la agenda mientras usemos el subdominio temporal: `https://new.aasolutionsllc.com/agenda`

---

## 1. Crear el proyecto en Google Cloud

1. Entra a <https://console.cloud.google.com/>. Si es la primera vez, acepta los términos.
2. Arriba a la izquierda, junto al logo, abre el selector de proyectos y pulsa **Proyecto nuevo**.
3. Nombre: `AA Solutions Agenda`. Ubicación: *Sin organización*. Pulsa **Crear**.
4. Cuando termine, asegúrate de que el selector de arriba muestre `AA Solutions Agenda`.

## 2. Activar las 3 APIs

1. Menú ☰ › **APIs y servicios** › **Biblioteca**.
2. Busca y pulsa **Habilitar** en cada una:
   - **Google Calendar API**
   - **Google Drive API**
   - **Google Sheets API**

## 3. Pantalla de consentimiento (Google Auth Platform)

1. Menú ☰ › **APIs y servicios** › **Pantalla de consentimiento de OAuth** (Google la llama ahora *Google Auth Platform*). Pulsa **Comenzar**.
2. **Información de la app**
   - Nombre de la app: `AA Solutions Agenda`
   - Correo de asistencia: `infoaasolutionservices@gmail.com`
3. **Público:** elige **Externo**.
4. **Información de contacto:** `infoaasolutionservices@gmail.com`. Acepta la política y pulsa **Crear**.
5. En **Desarrollo de la marca** (Branding), opcional pero recomendado:
   - Página principal: `https://new.aasolutionsllc.com`
   - Dominios autorizados: `aasolutionsllc.com`
6. En **Acceso a los datos** (Data access) › **Agregar o quitar permisos**, marca estos y guarda:
   - `.../auth/calendar.events`
   - `.../auth/drive.file`
   - `.../auth/userinfo.email`
   - `openid`
7. **Muy importante:** ve a **Público** (Audience) y pulsa **Publicar app** › Confirmar. El estado debe quedar en **En producción**.
   Si se queda en *Prueba*, Google desconecta la agenda cada 7 días.

> No hace falta pedir la verificación de Google. Como la única cuenta que se conecta es la del negocio, basta con aceptar el aviso de "app no verificada" del paso 6.

## 4. Crear las credenciales (Client ID y Secret)

1. **Google Auth Platform** › **Clientes** › **Crear cliente**.
2. Tipo de aplicación: **Aplicación web**. Nombre: `Agenda web`.
3. **Orígenes autorizados de JavaScript:** `https://new.aasolutionsllc.com`
4. **URI de redireccionamiento autorizados:** copia exactamente esta, sin barra al final:

   ```
   https://new.aasolutionsllc.com/agenda/api/admin/google/callback
   ```

5. Pulsa **Crear**. Google muestra el **ID de cliente** y el **Secreto del cliente**. Cópialos ahora (el secreto solo se ve completo una vez; si se pierde se crea otro).

## 5. Ponerlos en el servidor

En el archivo `.env` de la agenda (ver `DEPLOY.md`):

```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
GOOGLE_CALENDAR_ID=primary
```

Reinicia la agenda para que lea los cambios:

```
cd /home/new.aasolutionsllc.com/agenda && pm2 startOrReload ecosystem.config.cjs --update-env
```

> **Opcional:** si prefieren que las citas vayan a un calendario aparte (por ejemplo "Citas AA Solutions"), créenlo en Google Calendar › Configuración › Agregar calendario › Crear calendario. Luego, en la configuración de ese calendario, copien el **ID del calendario** (termina en `@group.calendar.google.com`) y pónganlo en `GOOGLE_CALENDAR_ID`.

## 6. Conectar la cuenta desde el panel

1. Entra a `https://new.aasolutionsllc.com/agenda/admin` con un usuario **superadmin**.
2. Ve a **Horarios y ajustes** › tarjeta **Google (Calendar, Meet, Drive y Sheets)** › **Conectar cuenta de Google**.
3. Elige **infoaasolutionservices@gmail.com**.
4. Saldrá *"Google no verificó esta app"*: pulsa **Configuración avanzada** › **Ir a AA Solutions Agenda (no seguro)**. Es normal: es la propia app del negocio.
5. En la pantalla de permisos **marca todas las casillas** (Calendar y Drive). Si alguna queda sin marcar, esa parte no funcionará.
6. Pulsa **Continuar**. Vuelves al panel y la tarjeta muestra **Conectado** con el correo.

## 7. Probar

1. Abre `https://new.aasolutionsllc.com/agenda/es/agendar` y agenda una cita **virtual** de prueba subiendo un archivo.
2. Revisa en la cuenta de Google:
   - **Calendar:** el evento aparece con el botón *Unirse con Google Meet*.
   - **Drive:** carpeta `AA Solutions · Agendamientos` › carpeta de la cita con el archivo.
   - **Sheets:** hoja `AA Solutions · Agendamientos` con la fila de la cita.
3. En el panel, abre la cita: debe mostrar el enlace de Meet, la carpeta de Drive y el botón de la hoja.
4. Cancela la cita de prueba desde el panel: el evento se elimina del calendario y la fila cambia de estado.

---

## Si algo falla

| Mensaje | Qué hacer |
| --- | --- |
| `redirect_uri_mismatch` | La URI del paso 4 no coincide letra por letra. Revisa `https`, `/agenda` y que no tenga barra al final. Que `APP_URL` en `.env` sea `https://new.aasolutionsllc.com/agenda`. |
| "Google no devolvió refresh_token" | Entra a <https://myaccount.google.com/permissions>, quita el acceso de *AA Solutions Agenda* y vuelve a conectar. |
| "Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET" en el panel | El `.env` no tiene los valores o la agenda no se reinició (paso 5). |
| Se desconecta cada semana | La app quedó en modo *Prueba*. Publícala (paso 3.7) y vuelve a conectar. |
| Una cita muestra "Error con Google" en su historial | Abre la cita y pulsa **Sincronizar con Google**. Si se repite, revisa que la conexión siga activa en Horarios y ajustes. |

## Cuando el sitio pase al dominio final

Cuando la agenda se mueva a, por ejemplo, `https://www.aasolutionsllc.com/agenda`:

1. En el cliente OAuth (paso 4) **agrega** el nuevo origen y la nueva URI de redirección (deja las viejas hasta terminar).
2. Cambia `APP_URL` en `.env`, recompila (`bash scripts/deploy.sh`) y vuelve a conectar desde el panel.
