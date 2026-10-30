/**
 * Router HTTP interno de la Lambda (tarea 2.1, integración checkpoint 6).
 *
 * Parsea el evento de Lambda Function URL (payload format 2.0) y despacha por
 * método + ruta hacia los handlers de dominio mediante **imports estáticos**:
 *   GET  /health                → src/routes/health.ts  (handleHealth)
 *   GET  /health/{componente}   → src/routes/health.ts  (handleHealthComponent)
 *   POST /items                 → src/routes/items.ts   (createItem)
 *   GET  /items                 → src/routes/items.ts   (listItems)
 *   GET  /items/{id}            → src/routes/items.ts   (getItem)
 *   POST /jobs                  → src/routes/jobs.ts    (createJob)
 *   GET  /jobs/{jobId}          → src/routes/jobs.ts    (getJob)
 *   GET  /app                   → placeholder local (tarea 8.1 lo reemplaza)
 *
 * Nota de integración: la versión original de este router cargaba los módulos
 * de ruta con `createRequire(__filename)` y especificadores NO literales
 * (`"./" + moduleName`). esbuild no puede resolver esos require dinámicos en el
 * bundle, de modo que los módulos quedaban FUERA de `dist/index.js` y TODAS las
 * rutas respondían 503 "módulo no disponible" en runtime. Se sustituye por
 * imports estáticos directos para que esbuild incluya el código real de las
 * rutas en el bundle.
 *
 * Contrato de estado (Req. 20, 25):
 *   200/201 items · 202 jobs · 200/207/503 health · 404 desconocido · 204 OPTIONS.
 *
 * _Requirements: 20.1, 20.2, 20.5, 20.8, 25.8, 25.9_
 */
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import {
  html,
  notFound,
  preflight,
  type HttpResponse,
} from "./lib/http.js";
import { handleHealth, handleHealthComponent } from "./routes/health.js";
import { createItem, getItem, listItems } from "./routes/items.js";
import { createJob, getJob } from "./routes/jobs.js";
import {
  registrarAsistencia,
  consultarAsistencia,
} from "./routes/attendance.js";
import {
  registrarCalificacion,
  consultarCalificaciones,
} from "./routes/grades.js";
import { generarSesionHandler, chatHandler } from "./routes/genai.js";
import { appHtml } from "./frontend/app.js";

/**
 * Solicitud ya parseada que el router entrega a los handlers de dominio.
 * Es el contrato estable que consumen los módulos de ruta (health, items,
 * jobs importan `RouteRequest` desde "./router.js").
 */
export interface RouteRequest {
  /** Método HTTP en mayúsculas (GET, POST, OPTIONS...). */
  method: string;
  /** Ruta normalizada sin barra final (p. ej. "/items"). */
  path: string;
  /** Parámetros de ruta extraídos (p. ej. `{ id }` o `{ jobId }`). */
  params: Record<string, string>;
  /** Cuerpo JSON ya parseado (o `undefined` si no hay cuerpo válido). */
  body: unknown;
  /** Evento crudo de Function URL por si un handler necesita más detalle. */
  rawEvent: APIGatewayProxyEventV2;
}

/** Firma común de un handler de dominio. */
export type RouteHandler = (req: RouteRequest) => Promise<HttpResponse>;

/**
 * Normaliza una ruta: garantiza prefijo "/" y elimina la barra final
 * (excepto para la raíz "/"). Así "/items/" y "/items" se tratan igual.
 */
function normalizePath(rawPath: string): string {
  let path = rawPath || "/";
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

/**
 * Parsea el cuerpo de la solicitud. Soporta `body` base64-encoded cuando
 * `event.isBase64Encoded` es verdadero. Devuelve el objeto parseado o
 * `undefined` si el cuerpo está ausente o no es JSON válido.
 */
function parseBody(event: APIGatewayProxyEventV2): unknown {
  const raw = event.body;
  if (raw === undefined || raw === null || raw === "") return undefined;

  let text = raw;
  if (event.isBase64Encoded) {
    try {
      text = Buffer.from(raw, "base64").toString("utf-8");
    } catch {
      return undefined;
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Extrae el segmento de parámetro inmediatamente después de `prefix`.
 * Devuelve el valor (decodificado) si la ruta coincide con
 * `<prefix><param>` sin segmentos adicionales, o `null` si no coincide.
 */
function matchParam(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  if (rest === "" || rest.includes("/")) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

/**
 * Sirve el frontend demo en `GET /app` (tarea 8.1). Devuelve el HTML público
 * autocontenido de `src/frontend/app.ts` con `Content-Type: text/html`, sin
 * autenticación ni redirección (Req. 20.8). Import estático para que esbuild lo
 * incluya en el bundle.
 */
function renderApp(): HttpResponse {
  return html(200, appHtml);
}

/**
 * Enruta la solicitud ya parseada por método + ruta mediante despacho directo a
 * los handlers importados estáticamente. Devuelve 404 para combinaciones no
 * reconocidas.
 */
async function routeRequest(req: RouteRequest): Promise<HttpResponse> {
  const { method, path, params } = req;

  // --- Health (Req. 20.1, 25) ---
  // GET /health  y  GET /health/{componente}
  if (method === "GET" && path === "/health") {
    return handleHealth(req);
  }
  const healthComponent = matchParam(path, "/health/");
  if (method === "GET" && healthComponent !== null) {
    return handleHealthComponent({
      ...req,
      params: { ...params, componente: healthComponent },
    });
  }

  // --- Items (Req. 20.2, 20.3, 20.4, 25.8) ---
  if (path === "/items") {
    if (method === "POST") {
      return createItem(req);
    }
    if (method === "GET") {
      return listItems(req);
    }
  }
  const itemId = matchParam(path, "/items/");
  if (method === "GET" && itemId !== null) {
    return getItem({
      ...req,
      params: { ...params, id: itemId },
    });
  }

  // --- Jobs (Req. 20.5, 20.6, 20.7, 25.9) ---
  if (method === "POST" && path === "/jobs") {
    return createJob(req);
  }
  const jobId = matchParam(path, "/jobs/");
  if (method === "GET" && jobId !== null) {
    return getJob({
      ...req,
      params: { ...params, jobId },
    });
  }

  // --- Panel docente: Asistencia (Req. 9) ---
  if (path === "/attendance") {
    if (method === "POST") {
      return registrarAsistencia(req);
    }
    if (method === "GET") {
      return consultarAsistencia(req);
    }
  }

  // --- Panel docente: Calificaciones (Req. 10) ---
  if (path === "/grades") {
    if (method === "POST") {
      return registrarCalificacion(req);
    }
    if (method === "GET") {
      return consultarCalificaciones(req);
    }
  }

  // --- Panel docente: GenAI con Bedrock (Req. 5, 7, 11) ---
  if (method === "POST" && path === "/genai/sesion") {
    return generarSesionHandler(req);
  }
  if (method === "POST" && path === "/genai/chat") {
    return chatHandler(req);
  }

  // --- Frontend demo (Req. 20.8) ---
  if (method === "GET" && path === "/app") {
    return renderApp();
  }

  return notFound(method, path);
}

/**
 * Punto de entrada del router. Parsea el evento de Function URL, maneja el
 * preflight `OPTIONS` (204) y delega el despacho a `routeRequest`.
 */
export async function route(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const method = (event.requestContext?.http?.method ?? "GET").toUpperCase();
  const path = normalizePath(event.rawPath ?? "/");

  // Preflight CORS: responde 204 con cabeceras CORS para cualquier ruta.
  if (method === "OPTIONS") {
    return preflight();
  }

  const req: RouteRequest = {
    method,
    path,
    params: {},
    body: parseBody(event),
    rawEvent: event,
  };

  return routeRequest(req);
}
