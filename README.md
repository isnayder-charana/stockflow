# StockFlow

Sistema de inventario y almacén industrial: productos, almacenes, entradas y salidas de stock, proveedores y alertas de stock mínimo.

## Estructura

```
stockflow/
├── backend/
│   ├── StockFlow.sln
│   ├── src/StockFlow.Api/            ASP.NET Web API (.NET 8, EF Core + MySQL, JWT); corre local o en Lambda
│   ├── src/StockFlow.Alerts/         Microservicio de alertas de stock mínimo por correo (Lambda + Gmail)
│   ├── tests/StockFlow.Api.Tests/    Pruebas xUnit (EF Core InMemory)
│   └── tests/StockFlow.Alerts.Tests/ Pruebas del microservicio de alertas
├── frontend/
│   └── stockflow-web/                React + Vite + Bootstrap + DevExtreme
├── deploy/                           Guía de despliegue gratuito (Render + TiDB Cloud + Vercel + GitHub Actions)
├── infra/                            Alternativa en AWS: plantilla SAM (Lambda + RDS + S3)
├── render.yaml                       Blueprint de Render para la API
└── .github/workflows/                Alertas diarias de stock mínimo
```

## Requisitos

- .NET 8 SDK
- MySQL 8
- Node.js 20 o superior
- Herramienta de EF Core: `dotnet tool install --global dotnet-ef`

## Backend

1. Copia `backend/src/StockFlow.Api/appsettings.Development.example.json` como `appsettings.Development.json` (este no se sube a GitHub) y edítalo:
   - `ConnectionStrings:DefaultConnection`: tu usuario y contraseña de MySQL.
   - `Jwt:Key`: una clave aleatoria de al menos 32 caracteres.
   - `Seed:AdminPassword`: contraseña del usuario `admin` que se crea la primera vez.
2. Restaura, crea la migración inicial y levanta la API:

```bash
cd backend
dotnet restore
dotnet ef migrations add Initial --project src/StockFlow.Api
dotnet run --project src/StockFlow.Api
```

En Development la API aplica las migraciones al arrancar y crea el usuario administrador si no hay usuarios. Swagger queda en http://localhost:5000/swagger.

Pruebas:

```bash
cd backend
dotnet test
```

## Frontend

```bash
cd frontend/stockflow-web
cp .env.example .env      # en Windows: copy .env.example .env
npm install
npm run dev
```

Abre http://localhost:5173 e ingresa con `admin` y la contraseña de `Seed:AdminPassword`.

En Development también se crea el usuario `alertas` (contraseña `Seed:AlertsPassword`) que usa el microservicio de alertas, y dos usuarios de prueba con la contraseña de `Seed:DemoPassword` (si la dejas vacía, no se crean):

| Usuario | Rol |
|---|---|
| `almacenero` | Almacenero |
| `supervisor` | Supervisor |

DevExtreme muestra un aviso de licencia mientras no configures una clave; para uso personal o de evaluación funciona igual.

## Modelo de datos

| Entidad | Relaciones |
|---|---|
| `Product` | pertenece a una `Category` y opcionalmente a un `Supplier` |
| `WarehouseStock` | stock de un `Product` en un `Warehouse` (clave compuesta) |
| `StockMovement` | entrada (`In`) o salida (`Out`) de un `Product` en un `Warehouse`, registrada por un `User` |
| `Warehouse` | `IsActive`: un almacén con historial no se borra, se desactiva |
| `Supplier` | RUC único de 11 dígitos; `IsActive`: un proveedor con productos no se borra, se desactiva |
| `User` | rol `Admin`, `Almacenero` o `Supervisor` |

## Endpoints y permisos

| Método | Ruta | Roles |
|---|---|---|
| POST | `/api/auth/login` | público |
| GET | `/api/products`, `/api/products/{id}` | cualquier usuario autenticado |
| POST, PUT | `/api/products` | Admin, Almacenero |
| DELETE | `/api/products/{id}` | Admin (si tiene movimientos, se desactiva en lugar de borrarse) |
| GET | `/api/lookups/categories`, `/suppliers` (todos, con `isActive`), `/warehouses` (solo activos) | cualquier usuario autenticado |
| GET | `/api/warehouses`, `/api/warehouses/{id}`, `/api/warehouses/{id}/stock` | cualquier usuario autenticado |
| POST, PUT | `/api/warehouses` | Admin (no se puede desactivar si tiene stock) |
| DELETE | `/api/warehouses/{id}` | Admin (si tiene stock da 409; si tiene movimientos, se desactiva) |
| GET | `/api/suppliers`, `/api/suppliers/{id}`, `/api/suppliers/{id}/products` | cualquier usuario autenticado |
| POST, PUT | `/api/suppliers` | Admin (RUC duplicado da 409) |
| DELETE | `/api/suppliers/{id}` | Admin (si tiene productos, se desactiva en lugar de borrarse) |
| GET | `/api/movements?from=&to=&warehouseId=&productId=` | cualquier usuario autenticado (`to` es exclusivo, fechas ISO) |
| POST | `/api/movements` | Admin, Almacenero |
| PUT, DELETE | `/api/products/{id}/photo` | Admin, Almacenero (JPG, PNG o WebP, hasta 4 MB) |
| POST | `/api/movements/{id}/document` | Admin, Almacenero (guía de remisión: PDF, JPG o PNG, hasta 4 MB; una sola vez) |
| GET | `/api/alerts/low-stock`, `/api/alerts/low-stock/count` | cualquier usuario autenticado |

## Reglas de stock

- Cada movimiento actualiza `WarehouseStocks` en el mismo `SaveChanges`: o se guardan los dos o ninguno.
- Una salida mayor al stock del almacén devuelve 409 con el disponible; el stock nunca queda negativo.
- Si dos usuarios mueven el mismo stock a la vez, el segundo reintenta con el valor nuevo (concurrencia optimista sobre `Quantity`). MySQL además tiene `CHECK (Quantity >= 0)`.
- Los movimientos no se editan ni se borran: para corregir uno, registra el movimiento contrario.

## Fotos y guías de remisión

En la base solo se guarda la clave del archivo (`Product.PhotoUrl`, `StockMovement.DocumentUrl`); la API devuelve una URL lista para abrir.

- En desarrollo (`Storage:Provider = Local`) los archivos van a `backend/src/StockFlow.Api/uploads/` y la API los sirve en `/files/...`.
- En AWS (`Storage:Provider = S3`) van a un bucket privado y la API devuelve URL firmadas que vencen en 60 minutos.
- En el despliegue gratuito están desactivadas (`Storage:Provider = None`): los endpoints de subida responden 404 y el frontend publicado oculta la columna de fotos, la de guías y el campo de guía. En `npm run dev` siguen visibles; `VITE_ENABLE_FILES=true|false` lo fuerza.

## Microservicio de alertas

`StockFlow.Alerts` inicia sesión en la API con el usuario `alertas` (rol Supervisor), lee `GET /api/alerts/low-stock` y, si hay productos bajo el mínimo, envía un correo desde Gmail (SMTP con contraseña de aplicación). Si no configuras Gmail, usa Amazon SES, que no está disponible en el plan gratuito de AWS. Se ejecuta todos los días a las 8:00 (hora de Lima) con GitHub Actions, o con EventBridge Scheduler si despliegas en AWS. En tu PC, con la API corriendo:

```bash
cd backend
dotnet run --project src/StockFlow.Alerts
```

No envía nada: guarda el correo en `backend/alerts-preview.html`.

## Despliegue

- **Gratis:** API en Render (Docker), base compatible con MySQL en TiDB Cloud, frontend en Vercel y alertas diarias con GitHub Actions. Paso a paso en [deploy/README.md](deploy/README.md).
- **Todo en AWS:** API en Lambda + API Gateway, MySQL en RDS, S3 y EventBridge Scheduler, con la plantilla de [infra/README.md](infra/README.md). Necesita una cuenta de AWS que permita CloudFormation (las del plan gratuito nuevo lo bloquean).
