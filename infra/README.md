# Despliegue en AWS

> Esta opción necesita una cuenta de AWS que permita CloudFormation. Las cuentas del plan gratuito nuevo lo bloquean; en ese caso usa el [despliegue gratuito](../deploy/README.md).

Todo se crea con una sola plantilla de AWS SAM ([template.yaml](template.yaml)). Nada se despliega solo: tú ejecutas los comandos de esta guía desde Git Bash.

## Qué se crea

```
Navegador ──► API Gateway (HTTP API) ──► Lambda "API" (ASP.NET) ──► RDS MySQL 8.4
                                              │
                                              └──► S3 (fotos y guías; bucket privado)

EventBridge Scheduler (8:00, hora de Lima) ──► Lambda "Alertas" ──► API (/api/alerts/low-stock)
                                                       └──► Gmail (correo por SMTP)
```

| Recurso | Detalle |
|---|---|
| VPC propia | 2 subredes públicas, sin NAT Gateway. La Lambda de la API llega a S3 por un endpoint gratuito. |
| RDS MySQL 8.4 | `db.t4g.micro`, 20 GB gp3, cifrada, 1 día de backups. Acepta conexiones solo de la Lambda de la API y de tu IP. |
| S3 | Bucket privado y cifrado. Las fotos y guías se ven con URL firmadas que vencen en 60 minutos. |
| Lambda API | .NET 8 en ARM64 (Graviton), 1024 MB. Las fotos y guías pasan por la API (hasta 4 MB). |
| Lambda Alertas | Inicia sesión en la API con el usuario `alertas` (rol Supervisor), lee los productos bajo el mínimo y envía un correo desde tu Gmail. Si no hay ninguno, no envía nada. |
| Logs | CloudWatch, 14 días. |

## Costo aproximado

Lambda, API Gateway, S3 y EventBridge cuestan centavos con este uso. Lo que sí cuesta es RDS, si tu cuenta ya no tiene capa gratuita (precios de us-east-1, aproximados):

- Instancia `db.t4g.micro`: unos US$ 12 al mes.
- 20 GB de disco gp3: unos US$ 2.30 al mes.
- IP pública de la base (para conectarte desde tu PC): unos US$ 3.60 al mes.

Si no la vas a usar unos días, detén la base (paso 9). Te recomiendo crear un presupuesto con alerta en **Billing → Budgets** antes de desplegar.

## 1. Requisitos (una sola vez)

- Cuenta de AWS y [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configurada:

  ```bash
  aws configure          # Access key, secret, región (por ejemplo us-east-1), formato json
  aws sts get-caller-identity
  ```

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html):

  ```bash
  sam --version
  ```

- .NET 8 SDK (ya lo tienes) y la herramienta de empaquetado de Lambda:

  ```bash
  dotnet tool install -g Amazon.Lambda.Tools
  ```

## 2. Crea una contraseña de aplicación de Gmail

Las alertas salen desde tu Gmail. Amazon SES, el servicio de correo de AWS, no está disponible en las cuentas del plan gratuito.

1. Tu cuenta de Google necesita la verificación en dos pasos activada: [myaccount.google.com/security](https://myaccount.google.com/security).
2. Entra a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), escribe un nombre como `StockFlow` y pulsa **Crear**.
3. Copia la contraseña de 16 letras (sin espacios). Es la que va en `AlertsGmailAppPassword`; tu contraseña normal de Gmail no funciona aquí.

Si cambias tu contraseña de Google, esa contraseña de aplicación deja de valer: crea otra y vuelve a desplegar.

## 3. Anota tu IP pública

Solo esa IP podrá conectarse a MySQL desde fuera de AWS:

```bash
curl -s https://checkip.amazonaws.com
```

Si tu IP cambia, vuelve a desplegar con el nuevo valor de `MyIpCidr` (paso 8).

## 4. Construye y despliega

```bash
cd /d/Projects/stockflow/infra
sam build
sam deploy --guided
```

Respuestas para `--guided`:

| Pregunta | Qué poner |
|---|---|
| Stack Name | `stockflow` |
| AWS Region | la misma de `aws configure` (`us-east-1`) |
| DbUsername | Enter (`stockflow_admin`) |
| DbPassword | una contraseña de 12+ caracteres con letras, números y `! # % ^ * ( ) _ + . -` (sin `;`, `@`, `/` ni espacios) |
| DbInstanceClass | Enter (`db.t4g.micro`) |
| MyIpCidr | tu IP del paso 3 con `/32`, por ejemplo `190.12.34.56/32` |
| JwtKey | una clave nueva de 32+ caracteres (no la de desarrollo) |
| FrontendOrigins | Enter (`http://localhost:5173`). Cuando tengas la URL de Vercel, agrégala separada por coma (paso 7). |
| AlertsUsername | Enter (`alertas`) |
| AlertsUserPassword | contraseña para el usuario de alertas (anótala, la usas en el paso 5) |
| AlertsGmailUser | tu Gmail, el que envía las alertas |
| AlertsGmailAppPassword | la contraseña de aplicación del paso 2 |
| AlertsToEmails | quiénes reciben las alertas, separados por coma (puede ser tu mismo Gmail) |
| AlertsSchedule | Enter (`cron(0 8 * * ? *)`, todos los días a las 8:00) |
| Confirm changes before deploy | `y` |
| Allow SAM CLI IAM role creation | `y` |
| Disable rollback | `n` |
| ApiFunction has no authentication. Is this okay? | `y` (la API usa su propio JWT) |
| Save arguments to configuration file | `y` |

La base de datos tarda unos 10 a 15 minutos en crearse. Al final SAM muestra las salidas (`ApiUrl`, `DbEndpoint`, `FilesBucketName`, `AlertsFunctionName`). Para verlas de nuevo:

```bash
aws cloudformation describe-stacks --stack-name stockflow --query "Stacks[0].Outputs" --output table
```

`samconfig.toml` guarda tus respuestas, contraseñas incluidas. Ya está en `.gitignore`; no lo compartas.

## 5. Prepara la base de datos

Desde tu PC: aplica las migraciones y crea el usuario `admin` y el usuario `alertas` en RDS. No crea los usuarios de prueba.

```bash
cd /d/Projects/stockflow/backend
ConnectionStrings__DefaultConnection="Server=<DbEndpoint>;Port=3306;Database=stockflow;User=stockflow_admin;Password=<DbPassword>;SslMode=Required;" \
Seed__AdminPassword='<contraseña para admin en AWS>' \
Seed__AlertsPassword='<la misma AlertsUserPassword del paso 4>' \
dotnet run --project src/StockFlow.Api -- --setup-database
```

Debe terminar con `Base de datos lista.` Puedes repetirlo cuando agregues migraciones nuevas: solo aplica lo pendiente y no duplica usuarios.

## 6. Prueba la API

```bash
API=<ApiUrl>
curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<contraseña para admin en AWS>"}'
```

La primera petición después de un rato tarda unos segundos (la Lambda "despierta"); las siguientes son rápidas.

## 7. Frontend: local contra AWS o publicado en Vercel

**Local contra AWS.** En `frontend/stockflow-web/.env`:

```
VITE_API_URL=<ApiUrl>
```

```bash
cd /d/Projects/stockflow/frontend/stockflow-web
npm run dev
```

Entra con `admin` y prueba subir una foto de producto y una guía de remisión: quedan en el bucket de S3. Para volver a la API local, deja `VITE_API_URL=http://localhost:5000`.

**En Vercel.** El frontend es estático (Vite), así que Vercel solo lo construye y lo sirve; `vercel.json` ya hace que rutas como `/products` funcionen al recargar.

1. Instala la CLI e inicia sesión (una vez): `npm i -g vercel` y `vercel login`.
2. Publica:

   ```bash
   cd /d/Projects/stockflow/frontend/stockflow-web
   vercel                                   # la primera vez: crea el proyecto (acepta lo que detecta: Vite)
   vercel env add VITE_API_URL production   # pega el ApiUrl del paso 4
   vercel --prod
   ```

   Si prefieres subir el código a GitHub e importarlo en vercel.com, pon **Root Directory** = `frontend/stockflow-web` y la variable `VITE_API_URL` en **Settings → Environment Variables**. `VITE_API_URL` se lee al construir: si la cambias, vuelve a desplegar.
3. Permite la URL de Vercel en la API y vuelve a desplegar el backend. Ejecuta `sam deploy --guided` otra vez: recuerda tus respuestas anteriores, así que da Enter en todo y solo cambia **FrontendOrigins** a `http://localhost:5173,https://<tu-proyecto>.vercel.app` (sin barra final).

   ```bash
   cd /d/Projects/stockflow/infra
   sam deploy --guided
   ```

## 8. Prueba las alertas y revisa los logs

Ejecuta la Lambda de alertas sin esperar a las 8:00:

```bash
aws lambda invoke --function-name <AlertsFunctionName> --cli-binary-format raw-in-base64-out --payload '{}' salida.json
cat salida.json
```

Responde algo como `{"LowStockCount":2,"EmailSent":true,"Message":"StockFlow: 2 productos bajo el stock mínimo: correo enviado a ..."}`. Si no hay productos bajo el mínimo responde `EmailSent: false` y no envía nada.

Logs en vivo:

```bash
cd /d/Projects/stockflow/infra
sam logs --stack-name stockflow -n AlertsFunction --tail
sam logs --stack-name stockflow -n ApiFunction --tail
```

Para actualizar después de cambiar código o parámetros:

```bash
cd /d/Projects/stockflow/infra
sam build && sam deploy
```

## 9. Detener o borrar todo

Detener la base (deja de cobrar la instancia; AWS la vuelve a encender sola a los 7 días):

```bash
DB_ID=$(aws cloudformation describe-stack-resource --stack-name stockflow --logical-resource-id Database --query StackResourceDetail.PhysicalResourceId --output text)
aws rds stop-db-instance --db-instance-identifier $DB_ID
aws rds start-db-instance --db-instance-identifier $DB_ID   # para volver a usarla
```

Borrar todo:

```bash
cd /d/Projects/stockflow/infra
sam delete --stack-name stockflow
```

Dos cosas quedan a propósito para no perder datos: el bucket de S3 (fotos y guías) y una copia final (snapshot) de la base. Si ya no los quieres:

```bash
aws s3 rb s3://<FilesBucketName> --force
aws rds describe-db-snapshots --query "DBSnapshots[].DBSnapshotIdentifier"
aws rds delete-db-snapshot --db-snapshot-identifier <id del snapshot>
```

## Probar el microservicio de alertas en tu PC

Con la API local corriendo (`dotnet run --project src/StockFlow.Api`):

```bash
cd /d/Projects/stockflow/backend
dotnet run --project src/StockFlow.Alerts
```

No envía correo: guarda el correo en `backend/alerts-preview.html` para que lo abras en el navegador. Usa el usuario `alertas` / `Alertas123!` que la API crea en Development.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `sam deploy` falla en `Database` | La contraseña tiene un carácter no permitido o la clase de instancia no existe en tu región. |
| La API responde 500 o se demora 30 s | La base está detenida o todavía se está creando. |
| `--setup-database` no conecta | Tu IP cambió: vuelve a desplegar con el nuevo `MyIpCidr`. |
| La Lambda de alertas dice "No se pudo iniciar sesión" | `AlertsUserPassword` no es igual a `Seed__AlertsPassword` del paso 5, o no corriste el paso 5. |
| La Lambda de alertas dice `5.7.0 Authentication Required` o `Username and Password not accepted` | `AlertsGmailAppPassword` no es una contraseña de aplicación válida (paso 2). |
| El navegador muestra error de CORS | La URL del frontend no está en `FrontendOrigins`. |
