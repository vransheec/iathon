/**
 * Handlers de las rutas de Calificaciones del panel docente (Req. 10).
 *
 * El router despacha:
 *   POST /grades            → registrarCalificacion
 *   GET  /grades?aula=<id>  → consultarCalificaciones
 *
 * Firma estable del router: `(req: RouteRequest) => Promise<HttpResponse>`.
 *
 * Contrato:
 *   POST /grades { aulaId, estudianteId, competencia, valor, escala? }
 *     ⇒ 201 { ok: true }   · falta campo o valor inválido ⇒ 400
 *   GET  /grades?aula=<id>
 *     ⇒ 200 { aulaId, registros: [...] }  · falta aula ⇒ 400
 *
 * Escalas MINEDU (Req. 10.1):
 *   - letras   : "AD" | "A" | "B" | "C"
 *   - vigesimal: entero 0..20
 * La escala se infiere del valor si el cliente no la envía. Escritura
 * idempotente por (aula, competencia, estudiante) (Req. 10.2).
 *
 * _Requirements: 10.1, 10.2, 10.3_
 */
import type { RouteRequest } from "../router.js";
import { json, type HttpResponse } from "../lib/http.js";
import {
  putGrade,
  listGrades,
  type RegistroCalificacion,
} from "../lib/docente-store.js";

/** Valores válidos en escala de letras MINEDU. */
const LETRAS = ["AD", "A", "B", "C"];

/** ¿Es un objeto plano (no null, no arreglo)? */
function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

/** Lee una cadena no vacía del cuerpo, o `null`. */
function str(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

/**
 * Valida el valor de la calificación y determina su escala.
 *
 * @returns `{ valor, escala }` normalizado, o `null` si el valor no es válido
 *   en ninguna de las dos escalas MINEDU.
 */
function validarValor(
  valor: string,
  escalaSolicitada?: string | null
): { valor: string; escala: "letras" | "vigesimal" } | null {
  const upper = valor.toUpperCase();

  // Escala de letras.
  if (LETRAS.includes(upper)) {
    if (escalaSolicitada === "vigesimal") return null;
    return { valor: upper, escala: "letras" };
  }

  // Escala vigesimal: entero 0..20.
  if (/^\d{1,2}$/.test(valor)) {
    const n = Number(valor);
    if (n >= 0 && n <= 20) {
      if (escalaSolicitada === "letras") return null;
      return { valor: String(n), escala: "vigesimal" };
    }
  }

  return null;
}

/**
 * POST /grades — registra una calificación por competencia.
 *
 * Valida `aulaId`, `estudianteId`, `competencia` y `valor` (en escala de letras
 * o vigesimal). Persiste de forma idempotente y responde 201 `{ ok: true }`.
 */
export async function registrarCalificacion(
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
  const competencia = str(body, "competencia");
  const valorRaw = str(body, "valor");
  const escalaRaw = str(body, "escala");

  if (!aulaId || !estudianteId || !competencia || !valorRaw) {
    return json(400, {
      error: "bad_request",
      message:
        "Faltan campos obligatorios: aulaId, estudianteId, competencia, valor.",
    });
  }

  const validado = validarValor(valorRaw, escalaRaw);
  if (!validado) {
    return json(400, {
      error: "bad_request",
      message:
        "Valor inválido. Use escala de letras (AD, A, B, C) o vigesimal (0 a 20).",
    });
  }

  const registro: RegistroCalificacion = {
    aulaId,
    estudianteId,
    competencia,
    valor: validado.valor,
    escala: validado.escala,
  };
  await putGrade(registro);

  return json(201, { ok: true, registro });
}

/**
 * GET /grades?aula=<id> — devuelve el reporte de notas del aula.
 *
 * Responde 200 `{ aulaId, registros }`. Si falta `aula`, responde 400.
 */
export async function consultarCalificaciones(
  req: RouteRequest
): Promise<HttpResponse> {
  const aulaId = leerAula(req);
  if (!aulaId) {
    return json(400, {
      error: "bad_request",
      message: "Falta el parámetro de consulta 'aula'.",
    });
  }

  const registros = await listGrades(aulaId);
  return json(200, { aulaId, registros });
}

/** Extrae el parámetro `aula` de la query string del evento. */
function leerAula(req: RouteRequest): string | null {
  const qs = req.rawEvent.queryStringParameters ?? undefined;
  const v = qs?.aula;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
