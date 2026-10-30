/**
 * Cliente y repositorio de Amazon DynamoDB para la demo (tarea 4.1).
 *
 * Crea un `DynamoDBClient` (AWS SDK v3) y lo envuelve en un
 * `DynamoDBDocumentClient` (`@aws-sdk/lib-dynamodb`) que serializa/deserializa
 * objetos JavaScript planos de forma transparente. Apunta a la tabla
 * `TABLE_NAME` en la región `AWS_REGION` definidas en `src/config.ts`.
 *
 * Esquema de clave genérico: la tabla usa una única clave de partición `pk`
 * (string). Los items de este repositorio se guardan con `pk = "ITEM#<id>"` y
 * un atributo discriminador `kind = "item"`, de modo que la misma tabla pueda
 * alojar también los jobs (`pk = "JOB#<jobId>"`, `kind = "job"`) que implementa
 * la tarea 5.1 sin colisiones.
 *
 * Contrato del hackathon relacionado (Req. 20.2, 20.3, 20.4, 25.8):
 *   POST /items { value } ⇒ 201 { id }
 *   GET  /items/{id}      ⇒ { value }
 *   GET  /items           ⇒ lista que incluye el valor persistido
 *
 * Nota: no se ejecutan comandos contra AWS en esta tarea (sin credenciales).
 *
 * _Requirements: 20.2, 20.3, 20.4, 25.8_
 */
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "../config.js";

/**
 * Cliente de bajo nivel de DynamoDB apuntando a la región configurada. El SDK
 * resuelve las credenciales desde el entorno de ejecución (rol de la Lambda).
 */
const baseClient = new DynamoDBClient({ region: config.awsRegion });

/**
 * Cliente de documentos reutilizable: traduce entre objetos JS y el formato de
 * atributos de DynamoDB. Se exporta para que otras rutas (p. ej. jobs, tarea
 * 5.1) reutilicen la misma conexión y configuración sin recrear el cliente.
 */
export const docClient = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    // Elimina atributos `undefined` en lugar de fallar, útil para `value`
    // parcialmente definidos.
    removeUndefinedValues: true,
  },
});

/** Discriminador de tipo de registro para los items de este repositorio. */
const ITEM_KIND = "item";

/** Construye la clave de partición de un item a partir de su id. */
function itemPk(id: string): string {
  return `ITEM#${id}`;
}

/**
 * Persiste un valor arbitrario como un nuevo item y devuelve su identificador.
 *
 * Genera un `id` con `crypto.randomUUID()` y escribe un registro
 * `{ pk, kind, id, value, createdAt }`. El `value` se guarda tal cual lo envía
 * el cliente (puede ser string, número, objeto, etc.).
 *
 * @param value Valor a persistir (contenido del campo `value` del cuerpo).
 * @returns Objeto con el `id` generado del item creado.
 */
export async function putItem(value: unknown): Promise<{ id: string }> {
  const id = randomUUID();
  await docClient.send(
    new PutCommand({
      TableName: config.tableName,
      Item: {
        pk: itemPk(id),
        kind: ITEM_KIND,
        id,
        value,
        createdAt: new Date().toISOString(),
      },
    })
  );
  return { id };
}

/**
 * Recupera un item por su id.
 *
 * @param id Identificador del item (el generado por `putItem`).
 * @returns `{ value }` con el valor persistido, o `null` si no existe.
 */
export async function getItemById(
  id: string
): Promise<{ value: unknown } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { pk: itemPk(id) },
    })
  );
  if (!result.Item) return null;
  return { value: result.Item.value };
}

/**
 * Lista todos los items persistidos.
 *
 * Para la demo basta con un `Scan` simple filtrando por `kind = "item"` (así se
 * excluyen los jobs que comparten tabla). En un escenario de producción se
 * sustituiría por una `Query` sobre un índice o un particionado por prefijo.
 *
 * @returns Arreglo de `{ id, value }` con todos los items persistidos.
 */
export async function listAllItems(): Promise<
  Array<{ id: string; value: unknown }>
> {
  const items: Array<{ id: string; value: unknown }> = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: config.tableName,
        FilterExpression: "#k = :kind",
        ExpressionAttributeNames: { "#k": "kind" },
        ExpressionAttributeValues: { ":kind": ITEM_KIND },
        ExclusiveStartKey: lastKey,
      })
    );
    for (const record of result.Items ?? []) {
      items.push({ id: record.id as string, value: record.value });
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}
