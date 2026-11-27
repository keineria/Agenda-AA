# Despliegue en el VPS (Hostinger · AlmaLinux 9 · CyberPanel)

La agenda es una app Node (Next.js) que corre en el propio VPS en `127.0.0.1:3000` y OpenLiteSpeed la publica en
`https://new.aasolutionsllc.com/agenda`. El sitio principal (Astro) sigue sirviéndose desde la raíz del mismo dominio.

```
Navegador ──https──> OpenLiteSpeed (CyberPanel)
                       ├─ /          → sitio web (public_html)
                       └─ /agenda/*  → proxy → Node 127.0.0.1:3000 (PM2: agenda-aa)
                                                └─ data/agenda.db (SQLite) + data/uploads/
```

No hay servicios de pago: base de datos SQLite en un archivo, correo por SMTP del propio servidor y Google por OAuth gratuito.

Los comandos se ejecutan por SSH como `root` (`ssh root@187.77.14.181`).

---

## 1. Preparar el servidor (una vez)

```bash
# Node 22 y herramientas para compilar better-sqlite3 si no hay binario precompilado
dnf module reset -y nodejs
dnf module install -y nodejs:22
dnf install -y git gcc-c++ make python3 sqlite
node -v    # debe decir v22.x

npm install -g pm2
pm2 startup systemd -u root --hp /root   # PM2 arranca solo al reiniciar el VPS
```

Comprueba que el puerto 3000 esté libre: `ss -ltnp | grep :3000` no debe mostrar nada. Si está ocupado, usa otro
(por ejemplo 3010) en `ecosystem.config.cjs` y en el paso 3.

## 2. Descargar el código y configurar

El sitio `new.aasolutionsllc.com` ya existe en CyberPanel, así que su carpeta es `/home/new.aasolutionsllc.com/`.
La agenda va al lado de `public_html`, **no dentro** (así sus archivos nunca son públicos).

```bash
cd /home/new.aasolutionsllc.com
git clone -b claude/project-thread-deot8f https://github.com/keineria/Agenda-AA.git agenda
cd agenda
cp .env.example .env
chmod 600 .env
```

> El repositorio es privado: para `git clone` usa una *deploy key* de solo lectura
> (GitHub › repo › Settings › Deploy keys) o un token personal de solo lectura.

Edita `.env` (`nano .env`) y completa como mínimo:

| Variable | Valor |
| --- | --- |
| `APP_URL` | `https://new.aasolutionsllc.com/agenda` |
| `NEXT_PUBLIC_BASE_PATH` | `/agenda` |
| `ENCRYPTION_KEY` | resultado de `openssl rand -base64 32` |
| `SESSION_SECRET` | otro `openssl rand -base64 32` distinto |
| `CRON_SECRET` | otro `openssl rand -base64 24` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | primer superadmin (contraseña de 8+ caracteres) |
| `ADMIN_NOTIFY_EMAILS` | correos que reciben aviso de cada cita |
| `SMTP_*`, `MAIL_FROM` | ver el paso 5 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ver `GOOGLE_SETUP.md` (se puede dejar para después) |

> **Guarda una copia de `ENCRYPTION_KEY` fuera del servidor** (por ejemplo en el gestor de contraseñas).
> Sin ella no se pueden leer los SSN/ITIN ni los datos bancarios guardados.

Compila y arranca:

```bash
bash scripts/deploy.sh
pm2 logs agenda-aa --lines 30     # debe decir "Ready"
curl -sI http://127.0.0.1:3000/agenda/es/agendar | head -1   # HTTP/1.1 200 OK
```

## 3. Publicar `/agenda` en OpenLiteSpeed

CyberPanel › **Websites** › **List Websites** › `new.aasolutionsllc.com` › **Manage** › **vHost Conf**.
Agrega al final del archivo y guarda:

```
extprocessor agenda_node {
  type                    proxy
  address                 http://127.0.0.1:3000
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context /agenda {
  type                    proxy
  handler                 agenda_node
  addDefaultCharset       off
}
```

Reinicia OpenLiteSpeed: `systemctl restart lsws` (o CyberPanel › Server Status › LiteSpeed Status › Reboot).

Comprueba:

- `https://new.aasolutionsllc.com/agenda/es/agendar` → formulario de agendamiento.
- `https://new.aasolutionsllc.com/agenda/admin` → pantalla de inicio de sesión.

Si el SSL del subdominio no está activo: CyberPanel › SSL › Manage SSL › `new.aasolutionsllc.com` › Issue SSL.

> Los archivos de los clientes pueden pesar hasta 30 MB por envío. Si OpenLiteSpeed corta subidas grandes, sube
> *Max Request Body Size* en vHost › General o en Server Configuration › Tuning.

## 4. Primer ingreso

1. Entra a `https://new.aasolutionsllc.com/agenda/admin` con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
2. **Usuarios:** cambia tu contraseña y crea las cuentas de Alexandra y Angela con su rol.
3. **Horarios y ajustes:** revisa el horario (lun a vie 9:00 a 12:00 y 13:00 a 20:00), agrega los **festivos** como bloqueos
   y pon el correo de cada gestora.
4. Conecta Google siguiendo `GOOGLE_SETUP.md`.
5. Ya con el primer usuario creado, puedes borrar `ADMIN_PASSWORD` del `.env`.

## 5. Correo `info@aasolutionsllc.com`

La agenda envía los avisos por SMTP. Las respuestas de los clientes llegan a `MAIL_REPLY_TO` (infoaasolutionservices@gmail.com).

1. CyberPanel › **Email** › **Create Email**: dominio `aasolutionsllc.com`, usuario `info`, contraseña fuerte.
   (Si `aasolutionsllc.com` no aparece, primero agrégalo en Websites › Create Website o como dominio de correo.)
2. CyberPanel › **Email** › **DKIM Manager**: genera la llave DKIM de `aasolutionsllc.com`.
3. En el DNS de `aasolutionsllc.com` (donde esté hoy el dominio) agrega, **sin tocar los MX** si ya reciben correo en otro lado:
   - **SPF** (TXT en `@`): `v=spf1 ip4:187.77.14.181 include:<lo que ya tengan> ~all`. Si ya existe un SPF, solo añade `ip4:187.77.14.181`.
   - **DKIM** (TXT en `default._domainkey`): el valor que muestra el DKIM Manager.
   - **DMARC** (TXT en `_dmarc`): `v=DMARC1; p=none; rua=mailto:infoaasolutionservices@gmail.com`
4. En `.env`:

   ```
   SMTP_HOST=mail.aasolutionsllc.com     # o localhost si el certificado no coincide
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=info@aasolutionsllc.com
   SMTP_PASS=<contraseña del buzón>
   MAIL_FROM="AA Solutions Services <info@aasolutionsllc.com>"
   ```

5. Reinicia (`pm2 startOrReload ecosystem.config.cjs --update-env`), agenda una cita de prueba y revisa que el correo llegue
   a la bandeja de entrada y no a spam. En el panel, cada cita muestra en su historial si el correo salió bien.

> Plan B sin DNS: usar el Gmail del negocio con una contraseña de aplicación
> (`SMTP_HOST=smtp.gmail.com`, `SMTP_USER=infoaasolutionservices@gmail.com`). En ese caso el remitente será el Gmail.

## 6. Recordatorios

El propio servidor revisa cada 5 minutos y envía los recordatorios de **1 día antes** y **1 hora antes**
(cada uno sale una sola vez, aunque se reinicie). No hace falta configurar nada.

Si prefieres un cron externo, pon `INTERNAL_CRON=false` y agrega en `crontab -e`:

```
*/5 * * * * curl -fsS "http://127.0.0.1:3000/agenda/api/cron/reminders?key=<CRON_SECRET>" > /dev/null
```

## 7. Copias de seguridad

Todo lo importante está en `data/` (base de datos y archivos que aún no subieron a Drive) y en `.env`.

```bash
mkdir -p /root/backups/agenda
crontab -e
# Copia diaria a las 3:15 a. m. y conserva 30 días
15 3 * * * sqlite3 /home/new.aasolutionsllc.com/agenda/data/agenda.db ".backup '/root/backups/agenda/agenda-$(date +\%F).db'" && find /root/backups/agenda -name 'agenda-*.db' -mtime +30 -delete
```

Restaurar: `pm2 stop agenda-aa`, copia el respaldo sobre `data/agenda.db`, borra `agenda.db-wal` y `agenda.db-shm`, y `pm2 start agenda-aa`.

## 8. Actualizar a una nueva versión

```bash
cd /home/new.aasolutionsllc.com/agenda
bash scripts/deploy.sh
```

El script hace `git pull`, instala dependencias, compila, copia los archivos estáticos y reinicia sin perder datos.
Las migraciones de la base de datos se aplican solas al arrancar.

## 9. Comandos útiles

| Para | Comando |
| --- | --- |
| Ver estado | `pm2 status` |
| Ver registros | `pm2 logs agenda-aa` |
| Reiniciar | `pm2 restart agenda-aa` |
| Aplicar cambios del `.env` | `pm2 startOrReload ecosystem.config.cjs --update-env` |
| Probar recordatorios a mano | `curl "http://127.0.0.1:3000/agenda/api/cron/reminders?key=<CRON_SECRET>"` |

## 10. Cambio al dominio final

Cuando el sitio pase de `new.aasolutionsllc.com` a `www.aasolutionsllc.com`:

1. Mueve la configuración del paso 3 al vHost del dominio final (o crea el sitio y repite el paso 3).
2. Cambia `APP_URL` en `.env` y ejecuta `bash scripts/deploy.sh`.
3. Agrega la nueva URI en Google y reconecta (ver el final de `GOOGLE_SETUP.md`).
4. Los enlaces de citas ya enviados con la URL vieja seguirán funcionando mientras `new.` siga apuntando al VPS.
