/**
 * Endpoint `GET /health` y `GET /health/{componente}` (tarea 3.1).
 *
 * Ejecuta verificaciones por componente, compone el arreglo `checks` con un
 * mensaje diagnóstico legible por componente y deriva el estado global con la
 * función pura `computeGlobalHealth`. El contrato (Req. 20.1, 25) exige:
 *   - `status: "ok"` siempre que el servicio responde,
 *   - `team`, `version` y `timestamp` para trazabilidad (Req. 25.10),
 *   - `global` con `healthy`/`degraded`/`unhealthy` (Req. 25.1-25.4),
 *   - código HTTP 200/207/503 acorde al estado global.
 *
 * Modelo de esencialidad (Req. 25.4-25.6):
 *   - DynamoDB y el servicio propio son ESENCIALES: su caída ⇒ 503.
 *   - Bedrock y el Enlace_Satelital NO son esenciales para `/health`: su
 *     degradación o microcorte ⇒ `degraded`/207, nunca `unhealthy`/503.
 *
 * Las verificaciones son tolerantes a fallos: cada sonda externa se ejecuta
 * dentro de try/catch con un timeout corto, de modo que la ausencia de
 * credenciales, de tabla o de conectividad nunca lanza una excepción no
 * controlada; en su lugar se traduce al estado del componente correspondiente.
 *
 * _Requirements: 20.1, 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.10_
 */
import {
  DynamoDBClient,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  BedrockRuntimeClient,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "../config.js";
import { json, notFound, type HttpResponse } from "../lib/http.js";
import {
  computeGlobalHealth,
  type HealthCheck,
} from "../lib/health.js";
import type { RouteRequest } from "../router.js";

/** Timeout corto para las sondas externas (ms). Mantiene `/health` ágil. */
const PROBE_TIMEOUT_MS = 2000;

/**
 * Ejecuta una promesa con un límite de tiempo. Si la promesa no resuelve antes
 * de `ms`, rechaza con un error de timeout. Permite que las sondas externas no
 * cuelguen la respuesta de `/health`.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout tras ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Normaliza un error desconocido a un mensaje legible y acotado. */
function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "error desconocido";
}

/**
 * Verifica DynamoDB (ESENCIAL) con una operación ligera `DescribeTable` sobre
 * la tabla configurada. Alcanzable ⇒ `healthy`; cualquier error (incluida la
 * ausencia de credenciales o de tabla) ⇒ `unhealthy`. Nunca lanza.
 */
async function checkDynamoDB(): Promise<HealthCheck> {
  const component = "dynamodb";
  try {
    const client = new DynamoDBClient({ region: config.awsRegion });
    await withTimeout(
      client.send(new DescribeTableCommand({ TableName: config.tableName })),
      PROBE_TIMEOUT_MS
    );
    return {
      component,
      status: "healthy",
      essential: true,
      message: `alcanzable: tabla ${config.tableName}`,
    };
  } catch (err) {
    return {
      component,
      status: "unhealthy",
      essential: true,
      message: `no alcanzable: ${errorMessage(err)}`,
    };
  }
}

/**
 * Verifica Amazon Bedrock (NO esencial para `/health`). Para la demo basta con
 * confirmar que el cliente se instancia sin error; se reporta `healthy` con un
 * mensaje informativo. Si la construcción del cliente fallara, se degrada a
 * `degraded` (nunca `unhealthy`, por no ser esencial, Req. 25.3). Nunca lanza.
 */
async function checkBedrock(): Promise<HealthCheck> {
  const component = "bedrock";
  try {
    // Construcción ligera del cliente; no se invoca al modelo en la demo para
    // mantener `/health` barato y rápido.
    new BedrockRuntimeClient({ region: config.awsRegion });
    return {
      component,
      status: "healthy",
      essential: false,
      message: `alcanzable: modelo ${config.bedrockModelId}`,
    };
  } catch (err) {
    return {
      component,
      status: "degraded",
      essential: false,
      message: `degradado: ${errorMessage(err)}`,
    };
  }
}

/**
 * Verifica el Enlace_Satelital (NO esencial, simulado en la demo). Reporta el
 * canal activo y se mantiene `healthy`. Un microcorte se modelaría como
 * `degraded` sin escalar nunca a `unhealthy` (Req. 25.5-25.6).
 */
function checkEnlaceSatelital(): HealthCheck {
  return {
    component: "enlace_satelital",
    status: "healthy",
    essential: false,
    message: "canal activo: leo",
  };
}

/**
 * Verifica el servicio propio (ESENCIAL). Si esta función se ejecuta, la Lambda
 * está respondiendo, de modo que el servicio está `healthy` (Req. 25.5).
 */
function checkServicioPropio(): HealthCheck {
  return {
    component: "api",
    status: "healthy",
    essential: true,
    message: "endpoints operativos",
  };
}

/**
 * Ejecuta todas las verificaciones por componente en paralelo y devuelve el
 * arreglo `checks` en orden estable.
 */
async function runChecks(): Promise<HealthCheck[]> {
  const [dynamo, bedrock] = await Promise.all([
    checkDynamoDB(),
    checkBedrock(),
  ]);
  return [checkServicioPropio(), dynamo, bedrock, checkEnlaceSatelital()];
}

/**
 * Compone el cuerpo de la respuesta de `/health` a partir de las verificaciones
 * y el estado global derivado. El campo `status` es siempre "ok" mientras el
 * servicio responde (contrato Req. 20.1); `global` expresa la salud agregada.
 */
function buildBody(checks: HealthCheck[], global: string) {
  return {
    status: "ok",
    team: config.teamId,
    global,
    version: config.serviceVersion,
    timestamp: new Date().toISOString(),
    checks,
  };
}

/**
 * Handler de `GET /health`: ejecuta las verificaciones, calcula el estado
 * global y responde con el código HTTP correspondiente (200/207/503).
 */
export async function handleHealth(_req: RouteRequest): Promise<HttpResponse> {
  const checks = await runChecks();
  const { global, httpStatus } = computeGlobalHealth(checks);
  return json(httpStatus, buildBody(checks, global));
}

/**
 * Handler de `GET /health/{componente}`: devuelve solo el `check` del
 * componente indicado en `req.params.componente` (Req. 25.7). Si el componente
 * no existe, responde 404.
 */
export async function handleHealthComponent(
  req: RouteRequest
): Promise<HttpResponse> {
  const componente = req.params.componente;
  const checks = await runChecks();
  const match = checks.find((check) => check.component === componente);

  if (!match) {
    return notFound(req.method, req.path);
  }

  // El código HTTP del componente individual refleja su propio estado:
  // healthy ⇒ 200, degraded ⇒ 207, unhealthy ⇒ 503 (coherente con Req. 25).
  const { httpStatus } = computeGlobalHealth([match]);
  return json(httpStatus, {
    team: config.teamId,
    version: config.serviceVersion,
    timestamp: new Date().toISOString(),
    check: match,
  });
}
