/**
 * Repositorio DynamoDB del panel docente: Asistencia (Req. 9) y Calificaciones
 * (Req. 10).
 *
 * Reutiliza el `docClient` compartido de `src/lib/ddb.ts` y la misma tabla
 * (`TABLE_NAME`) con clave de partición genérica `pk`. Para poder consultar por
 * aula sin un índice adicional, los registros se agrupan por `pk` de aula y se
 * distinguen con un atributo `sk` lógico dentro del mismo item colección:
 *
 *   Asistencia    → pk = "ATT#<aulaId>"   · sk = "<fecha>#<estudianteId>"
 *   Calificaciones→ pk = "GRD#<aulaId>"   · sk = "<competencia>#<estudianteId>"
 *
 * Como la tabla de la demo tiene SOLO `pk` como clave (sin sort key física),
 * cada registro se persiste como un item independiente usando una `pk`
 * compuesta que embebe el `sk` lógico: `pk = "ATT#<aulaId>#<fecha>#<estId>"`.
 * Así la escritura es idempotente (misma clave ⇒ mismo item, sobrescribe) y la
 * lectura por aula se hace con un `Scan` filtrado por el prefijo del aula.
 *
 * Idempotencia (Req. 9.2, 10.2): la clave determinista por (aula, fecha/
 * competencia, estudiante) garantiza que reintentos ante un microcorte
 * produzcan un único registro con el efecto aplicado una sola vez.
 *
 * _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3_
 */
import {
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "../config.js";
import { docClient } from "./ddb.js";

/** Estados válidos de asistencia (Req. 9.1). */
export const ESTADOS_ASISTENCIA = [
  "presente",
  "ausente",
  "tardanza",
  "justificado",
] as const;
export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];

/** Registro de asistencia de un estudiante en una fecha. */
export interface RegistroAsistencia {
  aulaId: string;
  fecha: string;
  estudianteId: string;
  estado: EstadoAsistencia;
  updatedAt?: string;
}

/** Registro de calificación de un estudiante por competencia. */
export interface RegistroCalificacion {
  aulaId: string;
  estudianteId: string;
  competencia: string;
  /** Valor en escala de letras MINEDU ("AD"|"A"|"B"|"C") o vigesimal (0-20). */
  valor: string;
  /** Escala usada: "letras" o "vigesimal". */
  escala: "letras" | "vigesimal";
  updatedAt?: string;
}

const PREFIJO_ASISTENCIA = "ATT#";
const PREFIJO_CALIFICACION = "GRD#";

/** Discriminadores de tipo de registro. */
const KIND_ASISTENCIA = "asistencia";
const KIND_CALIFICACION = "calificacion";

/** Clave de partición determinista de un registro de asistencia. */
function attendancePk(aulaId: string, fecha: string, estudianteId: string): string {
  return `${PREFIJO_ASISTENCIA}${aulaId}#${fecha}#${estudianteId}`;
}

/** Clave de partición determinista de un registro de calificación. */
function gradePk(aulaId: string, competencia: string, estudianteId: string): string {
  return `${PREFIJO_CALIFICACION}${aulaId}#${competencia}#${estudianteId}`;
}

/**
 * Persiste (o sobrescribe de forma idempotente) un registro de asistencia.
 *
 * La `pk` determinista por (aula, fecha, estudiante) hace que N reintentos ante
 * un microcorte dejen un único registro con el último estado (Req. 9.2).
 *
 * @param r Registro de asistencia a guardar.
 */
export async function putAttendance(r: RegistroAsistencia): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: config.tableName,
      Item: {
        pk: attendancePk(r.aulaId, r.fecha, r.estudianteId),
        kind: KIND_ASISTENCIA,
        aulaId: r.aulaId,
        fecha: r.fecha,
        estudianteId: r.estudianteId,
        estado: r.estado,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

/**
 * Lista los registros de asistencia de un aula (histórico por aula y
 * estudiante, Req. 9.3). Usa un `Scan` filtrado por el prefijo del aula.
 *
 * @param aulaId Identificador del aula.
 * @returns Registros de asistencia del aula, ordenados por fecha ascendente.
 */
export async function listAttendance(
  aulaId: string
): Promise<RegistroAsistencia[]> {
  const prefix = `${PREFIJO_ASISTENCIA}${aulaId}#`;
  const items = await scanByPrefix(prefix, KIND_ASISTENCIA);
  return items
    .map((i) => ({
      aulaId: i.aulaId as string,
      fecha: i.fecha as string,
      estudianteId: i.estudianteId as string,
      estado: i.estado as EstadoAsistencia,
      updatedAt: i.updatedAt as string | undefined,
    }))
    .sort((a, b) =>
      a.fecha === b.fecha
        ? a.estudianteId.localeCompare(b.estudianteId)
        : a.fecha.localeCompare(b.fecha)
    );
}

/**
 * Persiste (o sobrescribe de forma idempotente) un registro de calificación.
 *
 * La `pk` determinista por (aula, competencia, estudiante) hace que N
 * reintentos dejen un único registro con el último valor (Req. 10.2).
 *
 * @param r Registro de calificación a guardar.
 */
export async function putGrade(r: RegistroCalificacion): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: config.tableName,
      Item: {
        pk: gradePk(r.aulaId, r.competencia, r.estudianteId),
        kind: KIND_CALIFICACION,
        aulaId: r.aulaId,
        estudianteId: r.estudianteId,
        competencia: r.competencia,
        valor: r.valor,
        escala: r.escala,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

/**
 * Lista los registros de calificación de un aula (reporte por aula y
 * estudiante, Req. 10.3). Usa un `Scan` filtrado por el prefijo del aula.
 *
 * @param aulaId Identificador del aula.
 * @returns Registros de calificación del aula.
 */
export async function listGrades(
  aulaId: string
): Promise<RegistroCalificacion[]> {
  const prefix = `${PREFIJO_CALIFICACION}${aulaId}#`;
  const items = await scanByPrefix(prefix, KIND_CALIFICACION);
  return items
    .map((i) => ({
      aulaId: i.aulaId as string,
      estudianteId: i.estudianteId as string,
      competencia: i.competencia as string,
      valor: i.valor as string,
      escala: i.escala as "letras" | "vigesimal",
      updatedAt: i.updatedAt as string | undefined,
    }))
    .sort((a, b) =>
      a.estudianteId === b.estudianteId
        ? a.competencia.localeCompare(b.competencia)
        : a.estudianteId.localeCompare(b.estudianteId)
    );
}

/**
 * `Scan` paginado filtrando por prefijo de `pk` y por `kind`. Para la demo es
 * suficiente; en producción se sustituiría por una `Query` sobre una tabla con
 * sort key o un GSI por aula.
 */
async function scanByPrefix(
  prefix: string,
  kind: string
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: config.tableName,
        FilterExpression: "begins_with(pk, :p) AND #k = :kind",
        ExpressionAttributeNames: { "#k": "kind" },
        ExpressionAttributeValues: { ":p": prefix, ":kind": kind },
        ExclusiveStartKey: lastKey,
      })
    );
    for (const record of result.Items ?? []) {
      out.push(record as Record<string, unknown>);
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return out;
}
