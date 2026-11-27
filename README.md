# Agenda AA Solutions Services

Sistema de agendamiento de citas de **AA Solutions Services** (impuestos, ITIN, registraciones, compañías y más),
con panel administrativo. Bilingüe (español / inglés), pensado primero para celular.

- Público: `https://new.aasolutionsllc.com/agenda/es/agendar` (o `/en/agendar`)
- Panel: `https://new.aasolutionsllc.com/agenda/admin`

## Qué hace

**Para el cliente**

- Elige el servicio: Consulta general, Tax (personal, negocio, ITIN) o Registration (vehículos, compañías).
- Elige presencial (Linden, NJ) o virtual, día y hora según la disponibilidad real.
- Llena el formulario del servicio agrupado por pasos, sube documentos y acepta los términos.
  En Tax se le recuerda que debe haber hablado antes con una gestora (no se verifica).
- Recibe correo de confirmación con el enlace de Google Meet (si es virtual), botón para Google Calendar y archivo `.ics`.
- Recibe recordatorios **1 día antes** y **1 hora antes**.
- Puede cancelar o cambiar su cita desde el enlace del correo (hasta 24 horas antes, ajustable).

**Para el equipo**

- Dashboard, calendario (mes y semana) y lista con filtros y exportación a CSV.
- Ver, editar, reprogramar, cancelar, asignar gestora, reenviar avisos y dejar notas. Historial de cada cita.
- Horarios por tramos (hora de almuerzo), bloqueos y festivos, reglas de anticipación y capacidad.
- Roles: **superadmin** (todo, usuarios, Google, reglas), **admin** (gestiona citas y horarios),
  **gestor** (ve las citas y deja notas, no las mueve).
- Google: evento por cita con Meet, carpeta de Drive por cita con sus documentos y hoja de Sheets con todas las citas.
- Datos sensibles (SSN/ITIN, cuentas bancarias, IP PIN) cifrados con AES-256-GCM; para verlos hay que pulsar
  "Mostrar" y queda registrado quién los vio.

## Tecnología

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · SQLite (better-sqlite3) · Nodemailer (SMTP) ·
APIs de Google (Calendar, Drive, Sheets) por OAuth. Sin servicios de pago mensual.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # para desarrollo bastan APP_URL, NEXT_PUBLIC_BASE_PATH y ADMIN_*
npm run dev                  # http://localhost:3000/agenda
npm test                     # pruebas (vitest)
npm run typecheck
```

Sin `SMTP_HOST` los correos no se envían: se muestran en la consola como `[mail:dev]`.
Sin credenciales de Google la cita se guarda igual y los archivos quedan en `data/uploads/`.

## Documentación

- [DEPLOY.md](DEPLOY.md): instalación en el VPS (AlmaLinux 9 + CyberPanel), proxy `/agenda`, correo, copias de seguridad.
- [GOOGLE_SETUP.md](GOOGLE_SETUP.md): paso a paso para conectar Google Calendar, Meet, Drive y Sheets.
- [.env.example](.env.example): todas las variables de entorno.

## Integración con el sitio web

El sitio (Astro) enlaza o incrusta la agenda:

```html
<iframe src="/agenda/es/agendar?embed=1&service=tax_personal&bg=none&theme=aa" style="width:100%;border:0"></iframe>
```

| Parámetro | Valores |
| --- | --- |
| `service` | `consulta`, `tax`, `registration` (categorías) o `tax_personal`, `tax_business`, `itin`, `reg_vehicle`, `reg_company` |
| `topic` | tema de la consulta: `taxes`, `bookkeeping`, `company`, `compliance`, `vehicles`, `usdot`, `itin`, `home_improvement`, `notary`, `wedding`, `audit`, `translation`, `other` |
| `embed=1` | quita encabezado y pie; envía `postMessage` al sitio |
| `bg=none` | fondo transparente |
| `theme=aa` | color de acento de la marca (#0801FF) |

Eventos `postMessage` (`event.data.type`): `aa-booking:height` (`{ height }`), `aa-booking:step` (`{ step }`),
`aa-booking:done` (`{ code }`).

Endpoints públicos (JSON, con campo trampa `website` vacío):

- `POST /agenda/api/public/contact`: `{ name, email, phone, service, message, lang }`
- `POST /agenda/api/public/subscribe`: `{ email, lang }`

## Estructura

```
src/app/[locale]/agendar     flujo público de agendamiento
src/app/[locale]/cita/[token] página del cliente para cambiar o cancelar
src/app/admin                panel (login y (panel)/*)
src/app/api                  disponibilidad, citas, cron, contacto, Google, exportación
src/lib                      lógica: catálogo, disponibilidad, citas, Google, correo, cifrado, sesiones
src/components               componentes del flujo público y del panel
tests/                       pruebas de disponibilidad, citas, recordatorios y cifrado
```

Los campos de cada servicio están en `src/lib/catalog.ts` (tomados del Google Sheet de especificación).
