/**
 * Handlers de las rutas de GenAI del panel docente (Req. 5, 7, 11).
 *
 * El router despacha:
 *   POST /genai/sesion → generarSesionHandler  (generación de Sesion_Aprendizaje)
 *   POST /genai/chat   → chatHandler            (chat pedagógico)
 *
 * Firma estable del router: `(req: RouteRequest) => Promise<HttpResponse>`.
 * Respuestas con los helpers JSON de `src/lib/http.ts`.
 *
 * Contratos (alineados al frontend `src/frontend/app.ts`):
 *   POST /genai/sesion { tema, grado?, area?, lengua? }
 *     ⇒ 200 { sesion, origen, aviso? }   · tema vacío ⇒ 400 { error, message }
 *   POST /genai/chat { pregunta | mensaje, lengua? }
 *     ⇒ 200 { respuesta, disponible }    · pregunta vacía ⇒ 400
 *     ⇒ 503 { ... } si Bedrock no está disponible (disponible: false)
 *
 * La lógica de IA (prompt diseñado, validación de esquema, reintento y
 * *fallback* a plantilla) vive en `src/genai/`. Estos handlers solo adaptan la
 * entrada/salida HTTP.
 *
 * _Requirements: 5.1, 6.5, 7.3, 11.1, 11.2, 11.3, 21.4, 21.5_
 */
import type { RouteRequest } from "../router.js";
import { json, type HttpResponse } from "../lib/http.js";
import { generarSesion } from "../genai/sesion.js";
import { chatPedagogico } from "../genai/chat.js";

/** Límites de validación de entrada antes de invocar Bedrock (evita errores costosos). */
const LIMITES = {
  /** Longitud máxima del tema de una sesión. */
  temaMax: 500,
  /** Longitud máxima de los campos auxiliares (grado, área, lengua). */
  campoMax: 120,
  /** Longitud máxima de una pregunta del chat pedagógico. */
  preguntaMax: 2000,
};

/** Valida que un texto no supere la longitud máxima indicada. */
function excedeLongitud(valor: string | undefined, max: number): boolean {
  return typeof valor === "string" && valor.length > max;
}

/** ¿Es un objeto plano (no null, no arreglo)? */
function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

/** Lee una cadena del cuerpo por clave, o `undefined`. */
function readStr(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const v = body[key];
  return typeof v === "string" ? v : undefined;
}

/**
 * POST /genai/sesion — genera una `Sesion_Aprendizaje` MINEDU con Bedrock.
 *
 * Valida que haya `tema` (vacío ⇒ 400, Req. 6.5). Delega en `generarSesion`,
 * que valida el esquema, reintenta una vez y cae a plantilla si Bedrock falla
 * (Req. 7.2, 7.3). Responde 200 `{ sesion, origen, aviso? }`.
 */
export async function generarSesionHandler(
  req: RouteRequest
): Promise<HttpResponse> {
  const body = req.body;
  if (!isObject(body)) {
    return json(400, {
      error: "bad_request",
      message: "El cuerpo debe ser un objeto JSON con el campo 'tema'.",
    });
  }

  const tema = readStr(body, "tema");
  if (tema === undefined || tema.trim() === "") {
    return json(400, {
      error: "bad_request",
      message: "El campo 'tema' es obligatorio para generar una sesión.",
    });
  }

  // Validación de longitud ANTES de invocar Bedrock (evita invocaciones costosas).
  const grado = readStr(body, "grado");
  const area = readStr(body, "area");
  const lengua = readStr(body, "lengua");
  if (excedeLongitud(tema, LIMITES.temaMax)) {
    return json(400, {
      error: "bad_request",
      message: `El 'tema' no puede superar ${LIMITES.temaMax} caracteres.`,
    });
  }
  if (
    excedeLongitud(grado, LIMITES.campoMax) ||
    excedeLongitud(area, LIMITES.campoMax) ||
    excedeLongitud(lengua, LIMITES.campoMax)
  ) {
    return json(400, {
      error: "bad_request",
      message: `Los campos 'grado', 'area' y 'lengua' no pueden superar ${LIMITES.campoMax} caracteres.`,
    });
  }

  try {
    const result = await generarSesion({ tema, grado, area, lengua });
    return json(200, result);
  } catch (err) {
    // generarSesion solo propaga el caso de tema vacío (ya cubierto arriba);
    // cualquier otro error se mapea a un 503 controlado.
    const message = err instanceof Error ? err.message : "error desconocido";
    return json(503, { error: "genai_no_disponible", message });
  }
}

/**
 * POST /genai/chat — responde una pregunta pedagógica con Bedrock.
 *
 * Acepta la pregunta en `pregunta` o `mensaje` (el frontend envía ambos).
 * Pregunta vacía ⇒ 400. Si Bedrock no está disponible, `chatPedagogico`
 * devuelve `disponible: false` y aquí se responde 503 con el aviso (Req. 11.3).
 */
export async function chatHandler(req: RouteRequest): Promise<HttpResponse> {
  const body = req.body;
  if (!isObject(body)) {
    return json(400, {
      error: "bad_request",
      message: "El cuerpo debe ser un objeto JSON con el campo 'pregunta'.",
    });
  }

  const pregunta = readStr(body, "pregunta") ?? readStr(body, "mensaje") ?? "";
  if (pregunta.trim() === "") {
    return json(400, {
      error: "bad_request",
      message: "El campo 'pregunta' es obligatorio.",
    });
  }

  // Validación de longitud ANTES de invocar Bedrock.
  if (excedeLongitud(pregunta, LIMITES.preguntaMax)) {
    return json(400, {
      error: "bad_request",
      message: `La 'pregunta' no puede superar ${LIMITES.preguntaMax} caracteres.`,
    });
  }

  const result = await chatPedagogico({
    pregunta,
    lengua: readStr(body, "lengua"),
  });

  // Si Bedrock no respondió, el contrato del frontend espera 503 para mostrar
  // el aviso de servicio temporalmente no disponible (Req. 11.3).
  const status = result.disponible ? 200 : 503;
  return json(status, result);
}
