/**
 * Generación de `Sesion_Aprendizaje` (formato MINEDU) con Amazon Bedrock.
 *
 * Implementa el flujo central de "GenAI con propósito" para la generación de
 * sesiones: construye un prompt diseñado MINEDU (system + user), invoca Bedrock
 * con el modelo de calidad, parsea la respuesta a JSON de forma tolerante y la
 * valida contra el esquema `Sesion_Aprendizaje`. Si la respuesta es inválida o
 * la invocación falla, reintenta una sola vez. Si el segundo intento también
 * falla, cae a un borrador local desde `plantillaSesion` marcando
 * `origen: "plantilla"` y un aviso claro para el docente.
 *
 * El único error que se propaga es el de "tema vacío" (el handler lo traduce a
 * un 400). Cualquier otro fallo se absorbe mediante el *fallback* a plantilla.
 *
 * _Requirements: 5.1, 5.6, 7.1, 7.2, 7.3, 21.5_
 */
import { invokeModel, selectModel } from "./bedrock.js";
import { plantillaSesion } from "./plantilla.js";
import { validateSesion, type SesionAprendizaje } from "./schema.js";

/** Parámetros de solicitud para generar una `Sesion_Aprendizaje`. */
export interface GenerarSesionParams {
  /** Tema de la sesión. Obligatorio: vacío/espacios produce error. */
  tema: string;
  /** Grado o grados del aula (p. ej. "3° y 4°"); opcional. */
  grado?: string;
  /** Área curricular (p. ej. "Comunicación", "Matemática"); opcional. */
  area?: string;
  /** Lengua de la sesión (p. ej. "castellano", "quechua_sureno"); opcional. */
  lengua?: string;
}

/** Resultado de `generarSesion`: la sesión, su origen y un aviso opcional. */
export interface GenerarSesionResult {
  /** La `Sesion_Aprendizaje` generada (por IA o desde plantilla). */
  sesion: SesionAprendizaje;
  /** Origen del borrador: "IA" (Bedrock) o "plantilla" (fallback local). */
  origen: "IA" | "plantilla";
  /** Aviso para el docente (presente solo cuando se usó el fallback). */
  aviso?: string;
}

/** Aviso mostrado al docente cuando se recurre al fallback de plantilla. */
const AVISO_FALLBACK =
  "La IA no estuvo disponible; se generó un borrador desde plantilla.";

/** Prompt de sistema diseñado para la generación de sesiones MINEDU. */
const SYSTEM_PROMPT =
  "Eres un asistente pedagógico experto en el Currículo Nacional de la " +
  "Educación Básica del Perú (MINEDU) y en educación rural intercultural. " +
  "Tu tarea es generar Sesiones de Aprendizaje en formato MINEDU. " +
  "Debes responder EXCLUSIVAMENTE con un objeto JSON válido que cumpla el " +
  "esquema Sesion_Aprendizaje, sin texto adicional, sin explicaciones y sin " +
  "bloques de código Markdown. Todo el contenido debe estar en español, ser " +
  "pedagógicamente coherente y estar contextualizado a la realidad rural y a " +
  "la comunidad del docente.";

/**
 * Construye el mensaje de usuario (prompt diseñado) con las instrucciones de
 * contextualización rural y, si aplica, de contenido bilingüe.
 */
function buildUserPrompt(params: GenerarSesionParams): string {
  const tema = params.tema.trim();
  const grado = (params.grado ?? "").trim() || "aula multigrado";
  const area = (params.area ?? "").trim() || "Comunicación";
  const lengua = (params.lengua ?? "").trim() || "castellano";
  const esBilingue = lengua.toLowerCase() !== "castellano";

  const instruccionLengua = esBilingue
    ? "La sesión debe ser BILINGÜE: incluye el contenido en castellano y marca " +
      `claramente las consignas en ${lengua} con el prefijo ` +
      '"[REVISAR CON HABLANTE]" para que un hablante de la lengua las revise. ' +
      'Establece "bilingue": true y "lengua": "' +
      lengua +
      '" en el JSON.'
    : 'La sesión es en castellano. Establece "bilingue": false y ' +
      '"lengua": "castellano" en el JSON.';

  return [
    `Genera una Sesion_Aprendizaje MINEDU sobre el tema: "${tema}".`,
    `Grado: ${grado}. Área curricular: ${area}.`,
    "Contextualiza los ejemplos, situaciones y personajes a la realidad rural " +
      "y a la comunidad de los estudiantes (chacra, río, animales, festividades, " +
      "saberes locales).",
    instruccionLengua,
    "El JSON debe incluir EXACTAMENTE estos campos: " +
      "titulo (string), proposito (string), competencias (string[] no vacío), " +
      "capacidades (string[]), desempenos (string[]), " +
      "momentos (objeto con inicio, desarrollo y cierre como strings no vacíos), " +
      "materiales (string[]), evaluacion (objeto con criterios: string[] no vacío), " +
      'lengua (string), bilingue (boolean), estado: "borrador", origen: "IA".',
    "Responde ÚNICAMENTE con el JSON, sin ningún otro texto.",
  ].join("\n");
}

/**
 * Extrae y parsea el primer bloque JSON `{...}` encontrado en el texto.
 *
 * Tolera que el modelo envuelva el JSON en texto, vallas de código Markdown o
 * comentarios: localiza la primera `{` y su `}` de cierre balanceado (ignorando
 * llaves dentro de cadenas) y parsea ese fragmento.
 *
 * @param text Texto crudo devuelto por el modelo.
 * @returns El objeto parseado, o `null` si no hay JSON válido.
 */
function parseFirstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Intenta una generación por IA: invoca Bedrock, parsea y valida la respuesta.
 *
 * @returns La `Sesion_Aprendizaje` válida, o `null` si la invocación falla o la
 *   respuesta no cumple el esquema (el llamador decide reintentar o caer a
 *   plantilla).
 */
async function intentarGeneracionIA(
  system: string,
  userPrompt: string,
  modelId: string
): Promise<SesionAprendizaje | null> {
  let text: string;
  try {
    text = await invokeModel(userPrompt, { modelId, system, maxTokens: 4096 });
  } catch {
    // Fallo de invocación: se trata como intento fallido.
    return null;
  }

  const parsed = parseFirstJsonObject(text);
  if (parsed === null) return null;

  const result = validateSesion(parsed);
  if (!result.valid) return null;

  return result.value;
}

/**
 * Genera una `Sesion_Aprendizaje` MINEDU con Bedrock, con validación de esquema,
 * un reintento y *fallback* a plantilla local.
 *
 * Flujo:
 *   1. Si `tema` está vacío/espacios ⇒ lanza `Error` (el handler lo mapea a 400).
 *   2. Construye el prompt diseñado MINEDU e invoca el modelo de calidad.
 *   3. Parsea de forma tolerante y valida contra el esquema.
 *   4. Si falla (inválido o excepción), reintenta UNA vez.
 *   5. Si el segundo intento también falla, usa `plantillaSesion` con
 *      `origen: "plantilla"` y un aviso.
 *
 * Nunca propaga excepciones salvo el caso de tema vacío.
 *
 * @param params Tema (obligatorio), grado, área y lengua.
 * @returns La sesión generada, su origen y, si hubo fallback, un aviso.
 * @throws {Error} Si `params.tema` está vacío o solo contiene espacios.
 */
export async function generarSesion(
  params: GenerarSesionParams
): Promise<GenerarSesionResult> {
  if (params.tema === undefined || params.tema.trim() === "") {
    throw new Error("El campo 'tema' es obligatorio para generar una sesión.");
  }

  const system = SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(params);
  const modelId = selectModel(true); // Modelo de calidad (Sonnet).

  // Dos intentos: generación inicial + un reintento (Req. 7.2).
  for (let intento = 0; intento < 2; intento++) {
    const sesion = await intentarGeneracionIA(system, userPrompt, modelId);
    if (sesion !== null) {
      sesion.origen = "IA";
      if (sesion.estado === undefined || sesion.estado === "") {
        sesion.estado = "borrador";
      }
      return { sesion, origen: "IA" };
    }
  }

  // Fallback a plantilla tras dos intentos fallidos (Req. 5.6, 7.3).
  const sesion = plantillaSesion(params);
  return { sesion, origen: "plantilla", aviso: AVISO_FALLBACK };
}
