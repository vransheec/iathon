/**
 * Handlers de las rutas /items (tarea 4.1).
 *
 * Implementa los tres endpoints del contrato del hackathon apoyándose en el
 * repositorio de DynamoDB (`src/lib/ddb.ts`) y en los helpers de respuesta JSON
 * (`src/lib/http.ts`). Cada función tiene la firma estable que espera el router
 * (`src/router.ts`): `(req: RouteRequest) => Promise<HttpResponse>`.
 *
 * El router despacha así (ver `routeRequest` en src/router.ts):
 *   POST /items       → createItem
 *   GET  /items       → listItems
 *   GET  /items/{id}  → getItem   (con `req.params.id`)
 *
 * Contrato (Req. 20.2, 20.3, 20.4, 25.8):
 *   POST /items { value } ⇒ 201 { id }           · falta value ⇒ 400 { error }
 *   GET  /items/{id}      ⇒ 200 { value }         · no existe   ⇒ 404 { error }
 *   GET  /items           ⇒ 200 { items: [...] }  · incluye el valor persistido
 *
 * _Requirements: 20.2, 20.3, 20.4, 25.8_
 */
import type { RouteRequest } from "../router.js";
import { json, type HttpResponse } from "../lib/http.js";
import { putItem, getItemById, listAllItems } from "../lib/ddb.js";

/** Comprueba que el cuerpo parseado es un objeto (no null, no array). */
function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

/**
 * POST /items — crea un item con el `value` del cuerpo.
 *
 * Si el cuerpo no trae `value`, responde 400 `{ error }`. Si está presente,
 * persiste con `putItem` y responde 201 `{ id }` (Req. 25.8: 201 al crear).
 */
export async function createItem(req: RouteRequest): Promise<HttpResponse> {
  const body = req.body;
  if (!isObject(body) || !("value" in body) || body.value === undefined) {
    return json(400, {
      error: "bad_request",
      message: "El cuerpo debe incluir el campo 'value'.",
    });
  }

  const { id } = await putItem(body.value);
  return json(201, {
    id,
    message: `Item creado con id ${id}.`,
  });
}

/**
 * GET /items/{id} — devuelve el valor persistido para ese id.
 *
 * Responde 200 `{ value }` si el item existe; 404 `{ error }` si no.
 */
export async function getItem(req: RouteRequest): Promise<HttpResponse> {
  const id = req.params.id;
  if (!id) {
    return json(400, {
      error: "bad_request",
      message: "Falta el parámetro de ruta 'id'.",
    });
  }

  const found = await getItemById(id);
  if (!found) {
    return json(404, {
      error: "not_found",
      message: `No existe un item con id ${id}.`,
    });
  }
  return json(200, { value: found.value });
}

/**
 * GET /items — devuelve la lista de items persistidos.
 *
 * Formato elegido: `{ items: [{ id, value }, ...] }`. Es un objeto con una
 * clave `items` que contiene un arreglo de objetos con los campos `id` y
 * `value`. Así el verificador del hackathon encuentra el nonce persistido
 * dentro de los objetos `value` de la lista (Req. 20.4).
 */
export async function listItems(_req: RouteRequest): Promise<HttpResponse> {
  const items = await listAllItems();
  return json(200, { items });
}
