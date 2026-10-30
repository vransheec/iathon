# Implementation Plan

## Nota de alcance (versión DEMO)

Este plan corresponde a la **versión DEMO para hackathon** del Copiloto Docente Rural e Híbrido: un subconjunto ejecutable del diseño enterprise descrito en `design.md`. La demo prioriza un despliegue rápido y funcional en AWS (región `us-east-1`, rol `WSParticipantRole`) que cumpla el contrato de evaluación del hackathon (Req. 20, 21, 25) y demuestre **GenAI con propósito** con Amazon Bedrock (Req. 5, 7, 11, 21.4-21.5).

Simplificaciones respecto al diseño enterprise (todas documentadas como evolución futura):

- **Backend:** UNA sola función AWS Lambda en Node.js/TypeScript (`nodejs20.x` o `nodejs22.x`) con **Lambda Function URL** (HTTPS público, sin API Gateway) que enruta internamente todas las rutas.
- **Persistencia:** UNA tabla Amazon DynamoDB on-demand (ítems y jobs con PK genérica) creada por AWS CLI.
- **GenAI:** la misma Lambda invoca Amazon Bedrock (Converse/InvokeModel) para la generación de `Sesion_Aprendizaje` MINEDU y el chat pedagógico, con prompt diseñado, validación de esquema, un reintento y *fallback* a plantilla local.
- **Frontend:** `GET /app` devuelve HTML público embebido en la Lambda (panel docente demo, sin login).
- **Despliegue:** AWS CLI empaquetando un zip (sin AWS CDK ni CloudFormation).

Modelos Bedrock: `anthropic.claude-haiku-4-5-20251001-v1:0` (respuestas rápidas/baratas) y `anthropic.claude-sonnet-4-5-20250929-v1:0` (calidad). La arquitectura completa del `design.md` (API Gateway, Cognito, Step Functions multi-agente, SNS/SQS, Glue, Global Tables, Multi-Región) queda como **evolución futura**.

## Tasks

- [ ] 1. Inicializar el proyecto backend y el pipeline de empaquetado
  - [ ] 1.1 Crear la estructura del proyecto, dependencias y el script de build del zip
    - Crear `package.json` con dependencias de ejecución `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` y `@aws-sdk/client-bedrock-runtime` (AWS SDK v3), y dependencias de desarrollo `typescript`, `esbuild`, `vitest` y `fast-check`.
    - Configurar `tsconfig.json` (target `ES2022`, `module` NodeNext, `strict: true`) y la estructura de carpetas `src/` (`src/handler.ts`, `src/router.ts`, `src/routes/`, `src/lib/`, `src/genai/`, `src/frontend/`).
    - Definir en `src/config.ts` la lectura de variables de entorno `TEAM_ID`, `TABLE_NAME`, `BEDROCK_MODEL_ID`, `BEDROCK_MODEL_ID_QUALITY`, `AWS_REGION` y `SERVICE_VERSION` con valores por defecto para la demo.
    - Añadir script `build` que use `esbuild` para empaquetar `src/handler.ts` en `dist/index.js` (bundle, `--platform=node`, `--target=node20`) y generar `dist/function.zip` listo para desplegar.
    - _Requirements: 22.8_

- [ ] 2. Implementar el router HTTP interno de la Lambda
  - [ ] 2.1 Implementar el parseo del evento de Lambda Function URL y el despacho por método + ruta
    - En `src/router.ts` parsear `event.requestContext.http.method` y `rawPath`, extraer parámetros de ruta (`/items/{id}`, `/jobs/{jobId}`) y el cuerpo JSON, y despachar a los handlers de `GET /health`, `POST /items`, `GET /items/{id}`, `GET /items`, `POST /jobs`, `GET /jobs/{jobId}` y `GET /app`.
    - Implementar helpers de respuesta JSON con cabeceras CORS (`Access-Control-Allow-Origin: *`, métodos y headers) y soporte de `OPTIONS` (preflight), además de una respuesta 404 para rutas no reconocidas.
    - Mapear códigos de estado del contrato: 200/201 (items), 202 (jobs), 200/207/503 (health) y 503 para dependencias no disponibles.
    - _Requirements: 20.1, 20.2, 20.5, 20.8, 25.8, 25.9_

  - [ ]* 2.2 Escribir pruebas unitarias del router
    - Verificar despacho correcto por método + ruta, extracción de parámetros y respuesta 404 para rutas desconocidas.
    - Verificar respuesta a `OPTIONS` con cabeceras CORS.
    - _Requirements: 20.1, 20.8_

- [ ] 3. Implementar el endpoint GET /health con verificación por componente
  - [ ] 3.1 Implementar el cálculo de estado global y la verificación por componente
    - En `src/routes/health.ts` verificar DynamoDB (alcanzable/no alcanzable), Bedrock (alcanzable/no alcanzable/degradado) y el estado del propio servicio; componer la respuesta con `status: "ok"`, `team` (desde `TEAM_ID`), `global` (`healthy`/`degraded`/`unhealthy`), `version`, `timestamp` ISO y un arreglo `checks` por componente con mensaje diagnóstico.
    - Implementar la función pura `computeGlobalHealth(checks)` en `src/lib/health.ts`: todos sanos ⇒ `healthy`/200; componente no esencial degradado y sistema operativo ⇒ `degraded`/207; componente esencial caído ⇒ `unhealthy`/503; un microcorte/dependencia temporalmente degradada ⇒ `degraded` (nunca `unhealthy`).
    - _Requirements: 20.1, 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.10_

  - [ ]* 3.2 Escribir property test de microcorte nunca produce "unhealthy"
    - **Feature: copiloto-docente-rural, Property 5: Un microcorte nunca produce estado "unhealthy"**
    - **Validates: Requirements 25.6**

  - [ ]* 3.3 Escribir property test de coherencia del cálculo de estado global
    - **Feature: copiloto-docente-rural, Property 6: Coherencia del cálculo de estado global de /health**
    - **Validates: Requirements 25.1, 25.2, 25.3, 25.4**

  - [ ]* 3.4 Escribir prueba unitaria del contrato básico de /health
    - Verificar respuesta 200 con campos `status: "ok"` y `team` presentes cuando todos los componentes están sanos.
    - _Requirements: 20.1_

- [ ] 4. Implementar el cliente de DynamoDB y los endpoints /items
  - [ ] 4.1 Implementar el acceso a DynamoDB y el repositorio de items
    - En `src/lib/ddb.ts` crear el `DynamoDBDocumentClient` (AWS SDK v3) apuntando a `TABLE_NAME`, con esquema de clave genérico (`pk`/`sk`) para distinguir items (`pk = "ITEM#<id>"`) y jobs.
    - Implementar `putItem(value)` que genera un `id`, persiste y devuelve el `id`; `getItem(id)` que devuelve `{ value }`; y `listItems()` que devuelve la lista de valores persistidos.
    - En `src/routes/items.ts` enlazar: `POST /items { value }` ⇒ 201 `{ id }`; `GET /items/{id}` ⇒ `{ value }`; `GET /items` ⇒ lista que incluye el valor persistido.
    - _Requirements: 20.2, 20.3, 20.4, 25.8_

  - [ ]* 4.2 Escribir property test de round-trip de items
    - **Feature: copiloto-docente-rural, Property 2: Persistencia de items es un round-trip**
    - **Validates: Requirements 20.2, 20.3, 20.4**
    - Mockear el cliente de DynamoDB con un almacén en memoria.

- [ ] 5. Implementar el flujo asíncrono /jobs
  - [ ] 5.1 Implementar la creación y el worker de jobs
    - En `src/routes/jobs.ts` implementar `POST /jobs { input }` que crea un registro de job en DynamoDB (`pk = "JOB#<jobId>"`, `status: "queued"`) y responde **de inmediato** 202 `{ jobId }` con la ruta de consulta.
    - Implementar el worker en la misma invocación o en segundo plano simple (p. ej. ejecución tras responder, o cálculo síncrono previo a persistir `done`) que produce `output = input` invertido como cadena y actualiza el job a `status: "done"` en < 12 s.
    - Implementar `GET /jobs/{jobId}` que lee de DynamoDB y devuelve `{ status: "done", output }` cuando el job terminó.
    - Implementar la función pura `reverseString(input)` en `src/lib/jobs.ts` usada por el worker.
    - _Requirements: 6.1, 20.5, 20.6, 20.7, 25.9_

  - [ ]* 5.2 Escribir property test de output = input invertido
    - **Feature: copiloto-docente-rural, Property 1: El output de un job es siempre el input invertido**
    - **Validates: Requirements 20.6, 20.7**
    - Generadores de cadenas vacías, unicode y de gran longitud.

- [ ] 6. Checkpoint — contrato del verificador
  - Asegurar que pasan todas las pruebas de /health, /items y /jobs; si surgen dudas, consultar al usuario.

- [ ] 7. Integrar Amazon Bedrock para generación de sesión y chat pedagógico
  - [ ] 7.1 Implementar el cliente Bedrock y el esquema de Sesion_Aprendizaje
    - En `src/genai/bedrock.ts` crear el `BedrockRuntimeClient` (AWS SDK v3) y una función `invokeModel(prompt, modelId)` usando la Converse API, con selección de modelo rápido (`BEDROCK_MODEL_ID`) o de calidad (`BEDROCK_MODEL_ID_QUALITY`).
    - En `src/genai/schema.ts` definir el esquema de `Sesion_Aprendizaje` MINEDU (titulo, proposito, competencias, capacidades, desempenos, momentos inicio/desarrollo/cierre, materiales, evaluacion) y la función `validateSesion(obj)` que valida tipos y campos obligatorios.
    - _Requirements: 5.2, 7.1, 21.4_

  - [ ] 7.2 Implementar la generación de Sesion_Aprendizaje con validación, reintento y fallback
    - En `src/genai/sesion.ts` construir el prompt diseñado MINEDU, invocar Bedrock, validar la respuesta contra el esquema; si es inválida o la invocación falla, reintentar una vez; si el segundo intento falla, producir un borrador desde una plantilla local (`src/genai/plantilla.ts`) marcando `origen: "plantilla"` y un aviso.
    - _Requirements: 5.1, 5.6, 7.1, 7.2, 7.3, 21.5_

  - [ ] 7.3 Implementar el chat pedagógico
    - En `src/genai/chat.ts` construir un prompt diseñado que inyecta contexto del Currículo Nacional MINEDU, invocar Bedrock y devolver la respuesta; si Bedrock no está disponible, devolver un aviso de servicio temporalmente no disponible.
    - Exponer las rutas del panel `POST /genai/sesion` y `POST /genai/chat` en el router, devolviendo JSON.
    - _Requirements: 11.1, 11.2, 11.3, 21.4_

  - [ ]* 7.4 Escribir pruebas unitarias de validación y fallback
    - Verificar que `validateSesion` rechaza respuestas incompletas y que el flujo cae a plantilla tras dos fallos de Bedrock (mockeado).
    - Verificar que tema vacío al generar sesión produce error y rechazo.
    - _Requirements: 6.5, 7.1, 7.3_

- [ ] 8. Implementar el frontend demo servido en GET /app
  - [ ] 8.1 Construir el HTML/JS del panel docente demo
    - En `src/frontend/app.ts` exportar una cadena HTML pública (SPA mínima embebida, sin login) con tres secciones: generar sesión con IA (formulario de tema/grado/área que llama a `POST /genai/sesion`), chat pedagógico (que llama a `POST /genai/chat`) y estado de salud (que consulta `GET /health`).
    - Enlazar `GET /app` en el router para devolver el HTML con `Content-Type: text/html` y acceso público sin autenticación ni redirección.
    - _Requirements: 20.8_

- [ ] 9. Checkpoint — GenAI y frontend
  - Asegurar que el build genera el zip y que pasan las pruebas de GenAI y frontend; si surgen dudas, consultar al usuario.

- [ ] 10. Crear los artefactos de Maestría Kiro (steering y hook)
  - [ ] 10.1 Crear el archivo de steering del proyecto
    - Crear `.kiro/steering/project-conventions.md` (≥200 caracteres) que describa las convenciones del proyecto, la arquitectura cloud-first/serverless de la demo, el enrutamiento en la Lambda única, el uso de Amazon Bedrock (modelos Claude, prompt diseñado, validación + reintento + fallback) y las variables de entorno del despliegue.
    - _Requirements: 21.2_

  - [ ] 10.2 Crear el hook del proyecto
    - Crear un hook en `.kiro/hooks/` con condición `when` (al guardar archivos del backend bajo `src/`) y acción `then` (ejecutar `npm run build` y las pruebas), con contenido válido.
    - _Requirements: 21.3_

- [ ] 11. Desplegar la demo con AWS CLI y validar con smoke tests
  - [ ] 11.1 Crear la tabla DynamoDB y el rol de ejecución IAM
    - Escribir `scripts/deploy.sh` que cree la tabla DynamoDB on-demand (`--billing-mode PAY_PER_REQUEST`, clave `pk`) en `us-east-1` y el rol IAM de ejecución de la Lambda con *trust policy* de `lambda.amazonaws.com` y permisos mínimos: `AWSLambdaBasicExecutionRole`, acciones de DynamoDB (`PutItem`/`GetItem`/`Query`/`Scan`/`UpdateItem`) sobre la tabla y `bedrock:InvokeModel` sobre los modelos Claude.
    - **Marcar como paso que requiere credenciales/permisos de la cuenta de workshop.**
    - _Requirements: 22.8_

  - [ ] 11.2 Empaquetar y desplegar la función Lambda con Function URL
    - Extender `scripts/deploy.sh` para ejecutar el build, crear/actualizar la función Lambda (`nodejs20.x`, handler `index.handler`, `--zip-file fileb://dist/function.zip`, rol de ejecución), configurar variables de entorno `TEAM_ID`, `TABLE_NAME`, `BEDROCK_MODEL_ID`, `BEDROCK_MODEL_ID_QUALITY` y `SERVICE_VERSION`, y crear la Function URL pública (`--auth-type NONE`) con permiso de invocación público.
    - **Marcar como paso que requiere credenciales/permisos de la cuenta de workshop.**
    - _Requirements: 20.1, 20.8, 22.8_

  - [ ] 11.3 Ejecutar smoke tests de los endpoints con curl
    - Escribir `scripts/smoke.sh` que valide con `curl`: `GET /health` ⇒ 200 `{ status: "ok", team }`; `POST /items` ⇒ `{ id }` y `GET /items/{id}` ⇒ valor; `POST /jobs` ⇒ 202 `{ jobId }` y `GET /jobs/{jobId}` ⇒ `{ status: "done", output }` en < 12 s; `GET /app` ⇒ HTML público.
    - **Marcar como paso que requiere la Function URL desplegada.**
    - _Requirements: 20.1, 20.2, 20.3, 20.5, 20.6, 20.7, 20.8_

- [ ] 12. Checkpoint final — demo verificable
  - Asegurar que todos los endpoints responden según el contrato del hackathon y que los artefactos de Maestría Kiro existen; si surgen dudas, consultar al usuario.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido; las tareas sin `*` deben implementarse.
- Cada tarea referencia los requisitos específicos que implementa para trazabilidad.
- Las propiedades testeables de la demo (Property 1, 2, 5 y 6) se implementan con **fast-check**, mínimo 100 iteraciones, mockeando DynamoDB y Bedrock. Las propiedades 3, 4, 7 y 8 pertenecen a funcionalidad enterprise fuera del alcance de esta demo.
- Los pasos de despliegue (tarea 11) requieren credenciales/permisos de la cuenta de workshop y están claramente marcados.
- Esta es la **versión DEMO**: la arquitectura completa de `design.md` (API Gateway, Cognito, Step Functions multi-agente, SNS/SQS, Glue, Global Tables) queda como evolución futura.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1", "7.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "3.4", "4.2", "5.2", "7.2", "7.3"] },
    { "id": 3, "tasks": ["7.4", "8.1", "10.1", "10.2"] },
    { "id": 4, "tasks": ["11.1"] },
    { "id": 5, "tasks": ["11.2"] },
    { "id": 6, "tasks": ["11.3"] }
  ]
}
```
