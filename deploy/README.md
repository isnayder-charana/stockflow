# Despliegue gratuito

Cómo publicar StockFlow sin pagar. Todo esto lo ejecutas tú; nada se despliega solo.

```
Navegador ──► Vercel (frontend React)
                 │
                 ▼
            Render (API ASP.NET en Docker) ──► TiDB Cloud (compatible con MySQL)

GitHub Actions (8:00, hora de Lima) ──► microservicio de alertas ──► API ──► correo por Gmail
```

| Pieza | Servicio | Plan gratuito |
|---|---|---|
| Código | GitHub (repositorio público o privado) | Gratis. Render, Vercel y GitHub Actions despliegan desde ahí. |
| API | Render, Web Service con Docker | Gratis. Se duerme tras 15 minutos sin uso; la primera petición después tarda cerca de un minuto. |
| Base de datos | TiDB Cloud Starter | Gratis y sin tarjeta (5 GiB). Compatible con MySQL; se ve con DBeaver. Se duerme sola y despierta con la primera consulta. |
| Alertas por correo | GitHub Actions + Gmail | Gratis. Corre una vez al día. |
| Frontend | Vercel | Gratis. |

Las fotos de productos y las guías de remisión quedan desactivadas en este despliegue: guardarlas necesita un bucket (Amazon S3 o Cloudflare R2) y ambos piden tarjeta. La API las rechaza (`Storage__Provider = None`) y el frontend publicado oculta esas columnas; en tu PC con `npm run dev` siguen funcionando. Si algún día quieres activarlas, en Render pon `Storage__Provider = S3`, `Storage__BucketName`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (y `Storage__ServiceUrl` si es R2), y en Vercel `VITE_ENABLE_FILES = true`.

La carpeta `infra/` (Lambda + RDS con SAM) queda como alternativa para una cuenta de AWS sin restricciones; tu cuenta del plan gratuito bloquea CloudFormation.

## 1. Sube el código a GitHub

1. En [github.com/new](https://github.com/new) crea un repositorio **público** (o privado) llamado `stockflow`, sin README ni .gitignore.
2. En Git Bash:

   ```bash
   cd /d/Projects/stockflow
   mkdir -p .github/workflows
   mv deploy/alertas-stock.yml .github/workflows/   # la acción de alertas diarias (paso 6)
   git init -b main
   git add .
   git status          # revisa que NO aparezcan appsettings.Development.json, .env, bin/ ni node_modules/
   git commit -m "StockFlow"
   git remote add origin https://github.com/<tu-usuario>/stockflow.git
   git push -u origin main
   ```

El repositorio puede ser público: `.gitignore` deja fuera `appsettings.Development.json` (tu contraseña de MySQL local y tu clave JWT) y `.env`. En su lugar se sube `appsettings.Development.example.json`, sin claves. Las claves de producción van como variables en Render y en GitHub, nunca en el código.

## 2. Crea la base de datos en TiDB Cloud

TiDB Cloud Starter es compatible con MySQL, gratis y sin tarjeta. Cuando nadie la usa se duerme sola y despierta con la primera consulta: no hay que encenderla a mano.

1. Regístrate en [tidbcloud.com](https://tidbcloud.com) (puedes entrar con Google o GitHub).
2. En **My TiDB** pulsa **Create Resource**, deja **Starter**, ponle de nombre `stockflow-db`, elige **AWS** y la región **N. Virginia (us-east-1)**, y pulsa **Create**.
3. Abre la instancia y pulsa **Connect** (arriba a la derecha). Pulsa **Generate Password** y guárdala: solo se muestra una vez.
4. Anota **Host** (algo como `gateway01.us-east-1.prod.aws.tidbcloud.com`), **Port** (`4000`) y **User** (algo como `3xYz12abc.root`, con el punto incluido).

Tu cadena de conexión queda así (una sola línea; la base `stockflow` la crea el paso 3):

```
Server=<Host>;Port=4000;Database=stockflow;User=<User>;Password=<Password>;SslMode=Required;ConnectionLifeTime=300;
```

`ConnectionLifeTime=300` renueva las conexiones cada 5 minutos, como recomienda TiDB Cloud.

### Ver la base gráficamente con DBeaver

Nueva conexión **MySQL** con Host, Port `4000`, Username (con el prefijo y `.root`) y Password. En la pestaña **SSL** marca *Use SSL*. Después de abrir la base `stockflow`, la pestaña **ER Diagram** te dibuja las tablas con sus relaciones.

## 3. Prepara las tablas y los usuarios

Desde tu PC: aplica las migraciones y crea la base `stockflow`, el usuario `admin` y el usuario `alertas` en TiDB Cloud.

```bash
cd /d/Projects/stockflow/backend
ConnectionStrings__DefaultConnection='<tu cadena de conexión de TiDB Cloud>' \
Seed__AdminPassword='<contraseña para admin en producción>' \
Seed__AlertsPassword='<contraseña para el usuario alertas>' \
dotnet run --project src/StockFlow.Api -- --setup-database
```

Copia y pega el bloque completo de una vez: si escribes solo la última línea, se aplica a tu MySQL local. Debe mostrar varias líneas `Applying migration ...` y terminar con `Base de datos lista.` Repítelo cuando agregues migraciones nuevas: solo aplica lo pendiente.

## 4. Publica la API en Render

1. Entra a [render.com](https://render.com) con tu cuenta de GitHub.
2. **New → Blueprint**, elige el repositorio `stockflow`. Render lee `render.yaml` y te pide estos valores:

| Variable | Valor |
|---|---|
| `ConnectionStrings__DefaultConnection` | la cadena de conexión de TiDB Cloud (paso 2) |
| `Cors__AllowedOrigins__0` | por ahora `http://localhost:5173`; en el paso 5 agregas la URL de Vercel |

`Jwt__Key` la genera Render solo. Pulsa **Apply**. La primera construcción tarda unos minutos; al terminar verás la URL, por ejemplo `https://stockflow-api.onrender.com`.

Prueba:

```bash
curl https://stockflow-api.onrender.com/health
curl -s -X POST https://stockflow-api.onrender.com/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<contraseña para admin en producción>"}'
```

Cada `git push` a `main` vuelve a desplegar la API.

## 5. Publica el frontend en Vercel

1. En [vercel.com](https://vercel.com) entra con GitHub → **Add New → Project** → importa `stockflow`.
2. **Root Directory**: `frontend/stockflow-web`. Vercel detecta Vite solo.
3. En **Environment Variables** agrega `VITE_API_URL` = la URL de Render, sin barra final.
4. **Deploy**. Te da una URL como `https://stockflow-xxxx.vercel.app`.
5. Vuelve a Render → tu servicio → **Environment** y cambia `Cors__AllowedOrigins__0` a `http://localhost:5173,https://stockflow-xxxx.vercel.app`. Render se reinicia solo.

Si cambias `VITE_API_URL`, vuelve a desplegar en Vercel (**Deployments → Redeploy**): Vite la lee al construir.

## 6. Activa las alertas diarias

El archivo `.github/workflows/alertas-stock.yml` ejecuta el microservicio de alertas todos los días a las 8:00 (hora de Lima). Necesita la contraseña de aplicación de Gmail (ver abajo).

En GitHub → tu repositorio → **Settings → Secrets and variables → Actions → New repository secret**, crea:

| Secreto | Valor |
|---|---|
| `STOCKFLOW_API_URL` | la URL de Render, sin barra final |
| `STOCKFLOW_API_PASSWORD` | la contraseña de `Seed__AlertsPassword` del paso 3 |
| `ALERTS_TO` | quién recibe las alertas, separados por coma |
| `ALERTS_GMAIL_USER` | el Gmail que envía |
| `ALERTS_GMAIL_APP_PASSWORD` | la contraseña de aplicación de ese Gmail (16 letras, sin espacios) |

Para probar sin esperar: pestaña **Actions → Alertas de stock mínimo → Run workflow**. En el registro verás algo como `StockFlow: 2 productos bajo el stock mínimo: correo enviado a ...`. Si no hay productos bajo el mínimo, no envía nada.

GitHub pausa las acciones programadas de un repositorio público tras 60 días sin commits. Si te llega ese aviso, vuelve a activarla desde la pestaña **Actions**.

### Contraseña de aplicación de Gmail

1. Activa la verificación en dos pasos: [myaccount.google.com/signinoptions/twosv](https://myaccount.google.com/signinoptions/twosv).
2. Entra a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), escribe `StockFlow` y pulsa **Crear**.
3. Copia las 16 letras sin espacios. Tu contraseña normal de Gmail no sirve aquí.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| La API tarda cerca de un minuto en responder | Estaba dormida (plan gratuito de Render). Es normal tras 15 minutos sin uso. |
| `Unknown database 'stockflow'` | No corriste el paso 3 con la cadena de TiDB Cloud (o lo corriste sin las variables, contra tu MySQL local). |
| `Access denied for user` | El usuario no lleva el prefijo (`xxxx.root`) o la contraseña no es la generada en el paso 2. |
| Render falla al arrancar con `Unable to connect to any of the specified MySQL hosts` | La cadena de conexión de TiDB Cloud está mal copiada (revisa Host, `Port=4000` y `SslMode=Required`). |
| El navegador muestra error de CORS | La URL de Vercel no está en `Cors__AllowedOrigins__0` (sin barra final). |
| La acción de alertas dice "No se pudo iniciar sesión" | `STOCKFLOW_API_PASSWORD` no es igual a `Seed__AlertsPassword` del paso 3. |
| La acción de alertas dice `Authentication Required` o `Username and Password not accepted` | `ALERTS_GMAIL_APP_PASSWORD` no es una contraseña de aplicación válida. |
