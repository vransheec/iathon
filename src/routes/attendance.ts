/**
 * Handlers de las rutas de Asistencia del panel docente (Req. 9).
 *
 * El router despacha:
 *   POST /attendance            → registrarAsistencia
 *   GET  /attendance?aula=<id>  → consultarAsistencia
 *
 * Firma estable del router: `(req: RouteRequest) => Promise<HttpResponse>`.
 * Respuestas con los helpers JSON de `src/lib/http.ts`.
 *
 * Contrato:
 *   POST /attendance { aulaId, fecha, estudianteId, estado }
 *     ⇒ 201 { ok: true }          · falta campo o estado inválido ⇒ 400
 *   GET  /attendance?aula=<id>
 *     ⇒ 200 { aulaId, registros: [...] }  · falta aula ⇒ 400
 *
 * La escritura es idempotente por (aula, fecha, estudiante): reintentos ante un
 * microcorte dejan un único registro (Req. 9.2). La fecha por defecto es la de
 * hoy (ISO yyyy-mm-dd) si el cliente no la envía.
 *
 * _Requirements: 9.1, 9.2, 9.3_
 */
import type { RouteRequest } from "../router.js";
import { json, type HttpResponse } from "../lib/http.js";
import {
  putAttendance,
  listAttendance,
  ESTADOS_ASISTENCIA,
  type EstadoAsistencia,
} from "../lib/docente-store.js";

/** ¿Es un objeto plano (no null, no arreglo)? */
function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

/** Lee una cadena no vacía del cuerpo, o `null`. */
function str(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Fecha de hoy en formato ISO yyyy-mm-dd. */
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /attendance — registra la asistencia de un estudiante.
 *
 * Valida `aulaId`, `estudianteId` y `estado` (uno de los estados MINEDU).
 * `fecha` es opcional (por defecto hoy). Persiste de forma idempotente y
 * responde 201 `{ ok: true }` con el registro guardado.
 */
export async function registrarAsistencia(
  req: RouteRequest
): Promise<HttpResponse> {
  const body = req.body;
  if (!isObject(body)) {
    return json(400, {
      error: "bad_request",
      message: "El cuerpo debe ser un objeto JSON.",
    });
  }

  const aulaId = str(body, "aulaId");
  const estudianteId = str(body, "estudianteId");
  const estadoRaw = str(body, "estado");
  const fecha = str(body, "fecha") ?? hoyISO();

  if (!aulaId || !estudianteId || !estadoRaw) {
    return json(400, {
      error: "bad_request",
      message: "Faltan campos obligatorios: aulaId, estudianteId, estado.",
    });
  }

  if (!ESTADOS_ASISTENCIA.includes(estadoRaw as EstadoAsistencia)) {
    return json(400, {
      error: "bad_request",
      message: `Estado inválido. Use uno de: ${ESTADOS_ASISTENCIA.join(", ")}.`,
    });
  }

  const registro = {
    aulaId,
    fecha,
    estudianteId,
    estado: estadoRaw as EstadoAsistencia,
  };
  await putAttendance(registro);

  return json(201, { ok: true, registro });
}

/**
 * GET /attendance?aula=<id> — devuelve el histórico de asistencia del aula.
 *
 * Responde 200 `{ aulaId, registros }`. Si falta el parámetro `aula`,
 * responde 400.
 */
export async function consultarAsistencia(
  req: RouteRequest
): Promise<HttpResponse> {
  const aulaId = leerAula(req);
  if (!aulaId) {
    return json(400, {
      error: "bad_request",
      message: "Falta el parámetro de consulta 'aula'.",
    });
  }

  const registros = await listAttendance(aulaId);
  return json(200, { aulaId, registros });
}

/** Extrae el parámetro `aula` de la query string del evento. */
function leerAula(req: RouteRequest): string | null {
  const qs = req.rawEvent.queryStringParameters ?? undefined;
  const v = qs?.aula;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
