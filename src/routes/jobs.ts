/**
 * Handlers del flujo asíncrono /jobs (tarea 5.1).
 *
 * El router (`src/router.ts`) despacha a estos exports:
 *   POST /jobs          → createJob
 *   GET  /jobs/{jobId}  → getJob
 *
 * Ambos cumplen la firma `(req: RouteRequest) => Promise<HttpResponse>`.
 *
 * Contrato del hackathon (Req. 20.5-20.7, 25.9):
 *   - POST /jobs responde **202** `{ jobId }` de inmediato (comportamiento
 *     asíncrono observable).
 *   - GET /jobs/{jobId} devuelve `{ status: "done", output }` con el `input`
 *     invertido como cadena, disponible en < 12 s.
 *
 * Nota de arquitectura (demo vs. enterprise): en la versión enterprise del
 * `design.md`, `POST /jobs` encolaría el trabajo en SQS y un `jobs-worker`
 * independiente lo procesaría de forma asíncrona (invertir cadena o lanzar el
 * Pipeline_Generacion con Bedrock). En esta DEMO corremos sobre una sola
 * Lambda sin cola real, así que el worker se resuelve **inline**: calculamos el
 * `output` y persistimos el job directamente con `status: "done"` ANTES de
 * responder. Aun así respondemos **202** (no 200) para exponer el mismo
 * contrato asíncrono observable: el cliente recibe un `jobId` y consulta el
 * resultado vía `GET /jobs/{jobId}`, garantizando que esté disponible en < 12 s.
 *
 * _Requirements: 6.1, 20.5, 20.6, 20.7, 25.9_
 */
import { randomUUID } from "node:crypto";
import type { RouteRequest } from "../router.js";
import { json, type HttpResponse } from "../lib/http.js";
import { reverseString } from "../lib/jobs.js";
import {
  getJob as readJob,
  putJob,
  type JobRecord,
} from "../lib/jobs-store.js";

/**
 * Extrae el campo `input` (string) del cuerpo JSON de la solicitud.
 * Devuelve `null` si el cuerpo no es un objeto o `input` no es una cadena.
 */
function readInput(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>).input;
  return typeof value === "string" ? value : null;
}

/**
 * POST /jobs — crea un job y responde 202 `{ jobId }`.
 *
 * Lee `req.body.input`, genera un `jobId` con `crypto.randomUUID()`, calcula el
 * `output` invertido de inmediato (worker inline de la demo) y persiste el job
 * con `status: "done"`. Responde 202 para exponer el comportamiento asíncrono
 * observable del contrato (Req. 20.5, 25.9).
 *
 * @param req Solicitud ya parseada por el router.
 */
export async function createJob(req: RouteRequest): Promise<HttpResponse> {
  const input = readInput(req.body);
  if (input === null) {
    return json(400, {
      error: "invalid_request",
      message: "El cuerpo debe incluir 'input' como cadena.",
    });
  }

  const jobId = randomUUID();
  const now = new Date().toISOString();

  // Worker inline de la DEMO: en enterprise esto iría a SQS + jobs-worker.
  // Aquí calculamos el resultado y lo persistimos como "done" de inmediato,
  // garantizando que GET /jobs/{jobId} lo devuelva en < 12 s (Req. 20.7).
  const output = reverseString(input);

  const job: JobRecord = {
    pk: `JOB#${jobId}`,
    kind: "job",
    jobId,
    type: "verificador",
    status: "done",
    input,
    output,
    createdAt: now,
    updatedAt: now,
  };

  await putJob(job);

  // 202 Accepted: comportamiento asíncrono observable del contrato (Req. 20.5, 25.9).
  return json(202, { jobId });
}

/**
 * GET /jobs/{jobId} — consulta el estado y resultado de un job.
 *
 * Lee `req.params.jobId`. Si el job existe, responde 200 `{ status, output }`
 * (con `status: "done"` y el `output` invertido). Si no existe, responde 404
 * `{ error }` (Req. 20.6).
 *
 * @param req Solicitud ya parseada por el router (con `params.jobId`).
 */
export async function getJob(req: RouteRequest): Promise<HttpResponse> {
  const jobId = req.params.jobId;
  if (!jobId) {
    return json(400, {
      error: "invalid_request",
      message: "Falta el parámetro de ruta 'jobId'.",
    });
  }

  const job = await readJob(jobId);
  if (job === null) {
    return json(404, {
      error: "not_found",
      message: `No existe el job '${jobId}'.`,
    });
  }

  return json(200, { status: job.status, output: job.output });
}
