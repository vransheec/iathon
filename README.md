# Copiloto Docente Rural e Híbrido

Sistema EdTech **cloud-first** que empodera a docentes de escuelas públicas en zonas rurales del Perú. Ofrece un panel docente con **generación de sesiones de aprendizaje con IA** (formato MINEDU), **chat pedagógico**, asistencia y calificaciones, interculturalidad bilingüe para lenguas originarias, y un estado de salud diagnóstico. Toda la lógica, los datos y la IA residen en **AWS**.

> Versión **DEMO** para la Kiro IAthon. La arquitectura enterprise completa (API Gateway, Cognito, Step Functions multi-agente, SNS/SQS, Glue, DynamoDB Global Tables) está documentada en `.kiro/specs/copiloto-docente-rural/design.md`.

## Arquitectura (demo)

- **Backend:** una AWS Lambda (Node.js 20 / TypeScript) con **Lambda Function URL** pública. Enruta el contrato de la IAthon y las rutas de GenAI.
- **Persistencia:** Amazon DynamoDB on-demand (clave `pk`; items `ITEM#<id>`, jobs `JOB#<jobId>`).
- **IA generativa:** Amazon Bedrock — Claude Haiku (chat, rápido) y Claude Sonnet (generación de calidad), con prompt diseñado MINEDU, validación de esquema, reintento con backoff y fallback a plantilla.

## Endpoints (contrato IAthon, rutas públicas sin autenticación)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | `200 { "status": "ok", "team": "<TEAM_ID>", ... }` con detalle por componente |
| POST | `/items` | `{ "value": "..." }` → `201 { "id" }` (persiste en DynamoDB) |
| GET | `/items/{id}` | `200 { "value" }` (404 si no existe) |
| GET | `/items` | `200` lista de items (incluye el recién creado) |
| POST | `/jobs` | `{ "input": "..." }` → `202 { "jobId" }` |
| GET | `/jobs/{jobId}` | `200 { "status": "done", "output": "<input invertido>" }` (<12 s) |
| GET | `/app` | Panel docente demo (HTML público) |
| POST | `/genai/sesion` | Genera una Sesión de Aprendizaje MINEDU con Bedrock |
| POST | `/chat` | Chat pedagógico con Bedrock |

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `TEAM_ID` | Id público del equipo en el portal (aparece en `/health`) | `copiloto-rural` |
| `TABLE_NAME` | Tabla DynamoDB de items y jobs | `copiloto-rural-demo` |
| `BEDROCK_MODEL_ID` | Modelo Bedrock rápido (chat) | `anthropic.claude-haiku-4-5-20251001-v1:0` |
| `BEDROCK_MODEL_ID_QUALITY` | Modelo Bedrock de calidad (sesiones) | `anthropic.claude-sonnet-4-5-20250929-v1:0` |
| `AWS_REGION` | Región AWS | `us-east-1` |
| `SERVICE_VERSION` | Versión del servicio (en `/health`) | `1.0.0` |

## Requisitos previos

- Node.js 20+, npm
- Credenciales AWS configuradas (región `us-east-1`), con acceso a DynamoDB, Lambda y Bedrock
- Acceso a los modelos Claude habilitado en Amazon Bedrock

## Desarrollo local

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest (pruebas, incl. property-based con fast-check)
npm run build       # esbuild → dist/index.js + dist/function.zip
```

## Despliegue

### Opción A — AWS SAM (infraestructura como código, recomendada)

Requiere la AWS SAM CLI. `template.yaml` define la tabla DynamoDB, la Lambda con permisos de Bedrock y la Function URL pública.

```bash
npm install && npm run build
sam build
sam deploy \
  --stack-name copiloto-docente-rural \
  --region us-east-1 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides TeamId=<tu-teamId> \
  --no-confirm-changeset --no-fail-on-empty-changeset
```

El despliegue imprime el Output **`ApiUrl`**. Pega esa URL (sin barra final) en *Perfil del equipo* del portal y pulsa *Verificar ahora*.

### Opción B — AWS CLI (sin SAM)

```bash
# 1) Tabla DynamoDB (on-demand, clave pk)
aws dynamodb create-table --table-name copiloto-rural-demo \
  --attribute-definitions AttributeName=pk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

# 2) Rol de ejecución IAM con permisos a DynamoDB y Bedrock
#    (trust: lambda.amazonaws.com; políticas: AWSLambdaBasicExecutionRole,
#     dynamodb:* sobre la tabla, bedrock:InvokeModel / bedrock:Converse)

# 3) Crear la función Lambda con el bundle
npm run build
aws lambda create-function --function-name copiloto-rural-demo \
  --runtime nodejs20.x --handler index.handler \
  --zip-file fileb://dist/function.zip \
  --role <ARN-del-rol> --timeout 30 --memory-size 512 \
  --environment "Variables={TEAM_ID=<tu-teamId>,TABLE_NAME=copiloto-rural-demo,BEDROCK_MODEL_ID=anthropic.claude-haiku-4-5-20251001-v1:0,BEDROCK_MODEL_ID_QUALITY=anthropic.claude-sonnet-4-5-20250929-v1:0,SERVICE_VERSION=1.0.0}" \
  --region us-east-1

# 4) Function URL pública
aws lambda create-function-url-config --function-name copiloto-rural-demo \
  --auth-type NONE --region us-east-1
aws lambda add-permission --function-name copiloto-rural-demo \
  --statement-id public --action lambda:InvokeFunctionUrl \
  --principal '*' --function-url-auth-type NONE --region us-east-1
```

## Verificación tras desplegar

```bash
curl -s <ApiUrl>/health
curl -s -X POST <ApiUrl>/items -H 'Content-Type: application/json' -d '{"value":"demo"}'
curl -s -X POST <ApiUrl>/jobs  -H 'Content-Type: application/json' -d '{"input":"abc1"}'
```

## Manejo de throttling y errores de Bedrock

El cliente de Bedrock (`src/genai/bedrock.ts`) usa **retry adaptativo** del SDK (`maxAttempts: 5`) más un **backoff exponencial con jitter** adicional. Clasifica errores reintetables (`ThrottlingException`, `ModelTimeoutException`, `ServiceUnavailableException`, `InternalServerException`, errores de red, HTTP 429/5xx) frente a los no reintetables (`ValidationException`, `AccessDeniedException`, `ResourceNotFoundException`). Las rutas de GenAI validan campos requeridos y longitud máxima del prompt **antes** de invocar Bedrock para evitar invocaciones costosas.

## Estructura

```
src/
  handler.ts            # entry point Lambda
  router.ts             # enrutamiento por método + ruta
  routes/               # health, items, jobs, genai
  lib/                  # http, ddb, jobs, health
  genai/                # bedrock, schema, sesion, plantilla, chat
  frontend/app.ts       # panel docente demo (HTML)
template.yaml           # infraestructura como código (AWS SAM)
.kiro/                  # specs, steering y hooks (Kiro)
```
