/**
 * Chat pedagógico conversacional del Copiloto Docente Rural.
 *
 * Expone `chatPedagogico`, que inyecta un prompt de sistema diseñado con
 * contexto del Currículo Nacional del Perú (MINEDU) e invoca Amazon Bedrock
 * mediante el modelo rápido para obtener una respuesta pedagógica.
 *
 * El manejo de errores sigue el contrato de la demo: una pregunta vacía lanza
 * un `Error` controlado (que el handler traducirá a 400), mientras que un fallo
 * de invocación de Bedrock nunca se propaga: se captura y se devuelve un aviso
 * de servicio temporalmente no disponible con `disponible: false` (Req. 11.3).
 *
 * _Requirements: 11.1, 11.2, 11.3, 21.4_
 */
import { invokeModel, selectModel } from "./bedrock.js";

/** Parámetros del chat pedagógico. */
export interface ChatPedagogicoParams {
  /** Pregunta del docente en lenguaje natural. Obligatoria y no vacía. */
  pregunta: string;
  /** Lengua preferida para la respuesta (p. ej. "quechua_sureno"); opcional. */
  lengua?: string;
}

/** Resultado del chat pedagógico. */
export interface ChatPedagogicoResult {
  /** Texto de la respuesta pedagógica (o el aviso de no disponibilidad). */
  respuesta: string;
  /** `true` si Bedrock respondió; `false` si se devolvió el aviso de fallback. */
  disponible: boolean;
}

/**
 * Prompt de sistema diseñado para el chat pedagógico.
 *
 * Posiciona al modelo como asistente pedagógico experto en el Currículo
 * Nacional del Perú (MINEDU) y acota el alcance de las respuestas a los temas
 * del Requisito 11.2 (planificación, estrategias, multigrado y EIB).
 */
const SYSTEM_PROMPT =
  "Eres un asistente pedagógico experto en el Currículo Nacional del Perú " +
  "(MINEDU). Orientas a docentes de zonas rurales sobre planificación " +
  "pedagógica, estrategias de enseñanza, adaptación a aulas multigrado y " +
  "educación intercultural bilingüe en lenguas originarias. Respondes en " +
  "español de forma clara, concreta y práctica, con ejemplos aplicables al " +
  "aula. Si una consulta queda fuera del ámbito pedagógico, lo indicas con " +
  "amabilidad y reconduces la conversación hacia la práctica docente.";

/** Aviso que se devuelve cuando Bedrock no está disponible (Req. 11.3). */
const AVISO_NO_DISPONIBLE =
  "El servicio de chat pedagógico no está disponible temporalmente. " +
  "Inténtalo nuevamente cuando se restablezca la conexión.";

/**
 * Responde una pregunta pedagógica usando Amazon Bedrock.
 *
 * @param params Pregunta del docente y, opcionalmente, la lengua preferida.
 * @returns La respuesta del modelo con `disponible: true`, o un aviso de
 *          servicio no disponible con `disponible: false` si Bedrock falla.
 * @throws {Error} Si `params.pregunta` está vacía o es solo espacios.
 */
export async function chatPedagogico(
  params: ChatPedagogicoParams
): Promise<ChatPedagogicoResult> {
  const pregunta = params.pregunta?.trim() ?? "";
  if (pregunta === "") {
    throw new Error("La pregunta del chat pedagógico no puede estar vacía.");
  }

  // Si el docente indica una lengua, se añade al prompt de sistema para
  // condicionar la respuesta sin alterar el núcleo pedagógico.
  const system =
    params.lengua !== undefined && params.lengua.trim() !== ""
      ? `${SYSTEM_PROMPT} Cuando sea pertinente, incorpora la lengua originaria "${params.lengua.trim()}" en tu respuesta.`
      : SYSTEM_PROMPT;

  try {
    const respuesta = await invokeModel(pregunta, {
      modelId: selectModel(false),
      system,
    });
    return { respuesta, disponible: true };
  } catch {
    // Req. 11.3: ante indisponibilidad de Bedrock nunca propagamos la
    // excepción; devolvemos un aviso controlado para el docente.
    return { respuesta: AVISO_NO_DISPONIBLE, disponible: false };
  }
}
