/**
 * Helpers de respuesta HTTP para la Lambda Function URL (payload format 2.0).
 *
 * Centraliza la construcción de respuestas JSON y HTML con cabeceras CORS
 * uniformes, el manejo de preflight `OPTIONS` (204) y la respuesta 404 para
 * rutas no reconocidas. Las rutas de dominio (health, items, jobs, app) usan
 * estos helpers para cumplir el contrato del hackathon (Req. 20, 25).
 */
import type { APIGatewayProxyResultV2 } from "aws-lambda";

/**
 * Cabeceras CORS comunes a todas las respuestas. El contrato del hackathon
 * expone endpoints públicos sin autenticación, por lo que se permite cualquier
 * origen y los métodos usados por el contrato.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Estructura de respuesta de Lambda Function URL con cuerpo ya serializado. */
export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Construye una respuesta JSON con el código de estado indicado, cabeceras
 * CORS y `Content-Type: application/json`. El cuerpo se serializa con
 * `JSON.stringify`.
 *
 * @param statusCode Código HTTP del contrato (200/201 items, 202 jobs,
 *   200/207/503 health, 404 desconocido, 500 error).
 * @param body Objeto a serializar como cuerpo de la respuesta.
 * @param extraHeaders Cabeceras adicionales opcionales que se combinan con CORS.
 */
export function json(
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string>
): HttpResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  };
}

/**
 * Construye una respuesta HTML pública (usada por `GET /app`) con cabeceras
 * CORS y `Content-Type: text/html; charset=utf-8`.
 *
 * @param statusCode Código HTTP (normalmente 200).
 * @param htmlString Cadena HTML a devolver tal cual en el cuerpo.
 */
export function html(statusCode: number, htmlString: string): HttpResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...CORS_HEADERS,
    },
    body: htmlString,
  };
}

/**
 * Respuesta de preflight `OPTIONS`: 204 sin cuerpo con cabeceras CORS.
 * El cuerpo vacío es obligatorio para un 204 "No Content".
 */
export function preflight(): HttpResponse {
  return {
    statusCode: 204,
    headers: { ...CORS_HEADERS },
    body: "",
  };
}

/**
 * Respuesta 404 JSON estándar para rutas no reconocidas por el router.
 *
 * @param method Método HTTP de la solicitud no encontrada.
 * @param path Ruta de la solicitud no encontrada.
 */
export function notFound(method: string, path: string): HttpResponse {
  return json(404, {
    error: "not_found",
    message: `Ruta no encontrada: ${method} ${path}`,
  });
}

/**
 * Respuesta 503 JSON para dependencias o módulos de ruta aún no disponibles.
 * Permite que el proyecto compile y responda de forma controlada mientras las
 * tareas paralelas (health/items/jobs/app) implementan sus módulos.
 *
 * @param detail Mensaje diagnóstico opcional sobre la indisponibilidad.
 */
export function serviceUnavailable(detail?: string): HttpResponse {
  return json(503, {
    error: "módulo no disponible",
    ...(detail ? { message: detail } : {}),
  });
}
