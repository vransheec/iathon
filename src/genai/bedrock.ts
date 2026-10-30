/**
 * Cliente de Amazon Bedrock para la demo del Copiloto Docente Rural.
 *
 * Expone un `BedrockRuntimeClient` (AWS SDK v3) configurado con RETRY ADAPTATIVO
 * del SDK y una función `invokeModel` que usa la Converse API para obtener texto
 * de un modelo Claude, con un reintento explícito adicional con backoff
 * exponencial + jitter ante throttling y errores de red transitorios.
 *
 * ## Manejo de throttling y errores de red (clasificación)
 *
 * Basado en la guía oficial de Amazon Bedrock:
 *  - REINTENTABLES (se reintentan con backoff): `ThrottlingException`,
 *    `ModelTimeoutException`, `ServiceUnavailableException`,
 *    `InternalServerException` y errores de red/transitorios
 *    (`TimeoutError`, `NetworkingError`, `ECONNRESET`, `ETIMEDOUT`,
 *    `EAI_AGAIN`, o HTTP 429 / 5xx).
 *  - NO REINTENTABLES (fallan de inmediato): `ValidationException`,
 *    `AccessDeniedException`, `ResourceNotFoundException`.
 *
 * `maxTokens` se fija SIEMPRE de forma explícita (default 2048): dejarlo sin
 * definir reserva la cuota máxima del modelo y provoca `ThrottlingException`
 * inesperado (mecánica de cuota documentada por AWS).
 *
 * Cuando la invocación falla de forma definitiva, `invokeModel` lanza un Error
 * con un mensaje claro; los llamadores reaccionan: `sesion.ts` cae a plantilla
 * local y `chat.ts` degrada con un aviso de servicio no disponible.
 *
 * _Requirements: 5.2, 7.1, 7.2, 7.3, 11.3, 21.4, 21.5_
 */
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
  type Message,
  type SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "../config.js";

/**
 * Cliente compartido. Usa retry ADAPTATIVO del SDK (`maxAttempts: 5`), que
 * ajusta dinámicamente la tasa de reintentos ante throttling, además del
 * reintento explícito de `invokeModel`.
 */
export const bedrockClient = new BedrockRuntimeClient({
  region: config.awsRegion,
  maxAttempts: 5,
  retryMode: "adaptive",
});

/** Opciones para ajustar la invocación de Bedrock. */
export interface InvokeModelOptions {
  /** Identificador del modelo Bedrock a usar; por defecto el rápido. */
  modelId?: string;
  /** Prompt de sistema opcional para condicionar el comportamiento del modelo. */
  system?: string;
  /** Límite de tokens de la respuesta; por defecto 2048. SIEMPRE explícito. */
  maxTokens?: number;
}

/** Máximo de reintentos EXPLÍCITOS adicionales tras el primer intento. */
const MAX_EXTRA_RETRIES = 3;
/** Retardo base del backoff exponencial (ms). */
const BASE_DELAY_MS = 300;

/**
 * Devuelve el `modelId` adecuado según se requiera calidad o rapidez.
 *
 * @param quality `true` ⇒ modelo de calidad (Sonnet); `false` ⇒ rápido (Haiku).
 */
export function selectModel(quality: boolean): string {
  return quality ? config.bedrockModelIdQuality : config.bedrockModelId;
}

/** Pausa `ms` milisegundos. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clasifica un error de invocación de Bedrock como reintentable o no.
 *
 * Reintentables: throttling, timeouts del modelo, servicio no disponible,
 * errores internos y fallos de red transitorios (HTTP 429 / 5xx incluidos).
 * No reintentables: validación, acceso denegado, recurso no encontrado.
 *
 * @param err Error capturado de la llamada a Bedrock.
 * @returns `true` si conviene reintentar; `false` si debe fallar de inmediato.
 */
export function isRetryableBedrockError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;

  const e = err as {
    name?: string;
    code?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };

  const name = (e.name ?? "") + " " + (e.code ?? "") + " " + (e.message ?? "");
  const status = e.$metadata?.httpStatusCode;

  // No reintentables explícitos.
  if (/ValidationException|AccessDeniedException|ResourceNotFoundException/.test(name)) {
    return false;
  }

  // Reintentables por nombre de excepción o error de red/transitorio.
  if (
    /ThrottlingException|ModelTimeoutException|ServiceUnavailableException|InternalServerException|TimeoutError|NetworkingError|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ThrottlingError/.test(
      name
    )
  ) {
    return true;
  }

  // Reintentables por código HTTP: 429 (throttling) o 5xx (servidor).
  if (status === 429 || (typeof status === "number" && status >= 500)) {
    return true;
  }

  return false;
}

/**
 * Invoca un modelo Claude en Bedrock usando la Converse API y devuelve el texto,
 * con reintento ante throttling y errores de red transitorios.
 *
 * @param prompt Texto del mensaje del usuario.
 * @param opts   Opciones: `modelId`, `system`, `maxTokens`.
 * @returns El texto de la respuesta del modelo.
 * @throws {Error} Si la invocación falla de forma definitiva (error no
 *   reintentable, o se agotaron los reintentos) o la respuesta no tiene texto.
 */
export async function invokeModel(
  prompt: string,
  opts: InvokeModelOptions = {}
): Promise<string> {
  const modelId = opts.modelId ?? config.bedrockModelId;
  const maxTokens = opts.maxTokens ?? 2048; // SIEMPRE explícito.

  const messages: Message[] = [{ role: "user", content: [{ text: prompt }] }];
  const system: SystemContentBlock[] | undefined =
    opts.system !== undefined && opts.system !== ""
      ? [{ text: opts.system }]
      : undefined;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_EXTRA_RETRIES; attempt++) {
    try {
      const response: ConverseCommandOutput = await bedrockClient.send(
        new ConverseCommand({
          modelId,
          messages,
          system,
          inferenceConfig: { maxTokens },
        })
      );

      const text = response.output?.message?.content?.[0]?.text;
      if (text === undefined || text === "") {
        throw new Error(
          `La respuesta de Bedrock para el modelo "${modelId}" no contiene texto.`
        );
      }
      return text;
    } catch (err) {
      lastError = err;

      // Errores no reintentables (validación, acceso, recurso): fallar ya.
      if (!isRetryableBedrockError(err)) {
        break;
      }
      // Sin más reintentos disponibles.
      if (attempt === MAX_EXTRA_RETRIES) {
        break;
      }
      // Backoff exponencial con jitter: 300, 600, 1200 ms (+ jitter < 150ms).
      const delay = BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 150);
      await sleep(delay);
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  const retryable = isRetryableBedrockError(lastError);
  throw new Error(
    `Error al invocar el modelo Bedrock "${modelId}" (${
      retryable ? "throttling/red tras reintentos" : "no reintentable"
    }): ${detail}`
  );
}
