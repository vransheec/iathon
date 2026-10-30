/**
 * Punto de entrada de la Lambda (handler = index.handler tras el bundle).
 *
 * Compatible con el formato de evento de Lambda Function URL (payload v2.0):
 * `event.requestContext.http.method` y `event.rawPath`. Delega el enrutamiento
 * interno a `route` en src/router.ts y captura cualquier error no controlado
 * devolviendo una respuesta 500 JSON con cabeceras CORS.
 *
 * _Requirements: 20.1, 20.2, 20.5, 20.8, 25.8, 25.9_
 */
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import { route } from "./router.js";
import { json } from "./lib/http.js";

export async function handler(
  event: APIGatewayProxyEventV2,
  _context?: Context
): Promise<APIGatewayProxyResultV2> {
  try {
    return await route(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido";
    return json(500, { error: "internal_error", message });
  }
}
