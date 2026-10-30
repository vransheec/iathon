/**
 * Repositorio de persistencia de jobs en DynamoDB (tarea 5.1).
 *
 * IMPORTANTE (coordinación de tareas paralelas): la tarea 4.1 crea
 * `src/lib/ddb.ts` con su propio `DynamoDBDocumentClient` para los items. Para
 * evitar un conflicto de edición sobre el mismo archivo, este módulo construye
 * su **propio** `DynamoDBDocumentClient` apuntando a la **misma** tabla
 * (`TABLE_NAME`) pero con un prefijo de clave distinto (`pk = "JOB#<jobId>"`),
 * de modo que items y jobs conviven en la tabla genérica sin pisarse.
 *
 * Esquema de clave de la tabla (según despliegue, tarea 11.1): clave de
 * partición `pk`. Los jobs usan `pk = "JOB#<jobId>"`.
 *
 * _Requirements: 6.1, 20.5, 20.6, 20.7, 25.9_
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "../config.js";

/** Estados posibles de un job a lo largo de su ciclo de vida. */
export type JobStatus = "queued" | "processing" | "done" | "failed";

/**
 * Registro de un job tal como se persiste en DynamoDB.
 *
 * `pk` es la clave de partición genérica de la tabla, con prefijo `"JOB#"`
 * para distinguir los jobs de otros tipos de ítem (p. ej. `"ITEM#"`). `kind`
 * replica el tipo de registro como atributo consultable.
 */
export interface JobRecord {
  /** Clave de partición: `"JOB#<jobId>"`. */
  pk: string;
  /** Discriminador de tipo de registro dentro de la tabla genérica. */
  kind: "job";
  /** Identificador del job (UUID), también embebido en `pk`. */
  jobId: string;
  /** Tipo de carga de trabajo (p. ej. "verificador"). */
  type: string;
  /** Estado actual del job. */
  status: JobStatus;
  /** Entrada original del job. */
  input: string;
  /** Resultado del job cuando `status === "done"`. */
  output?: string;
  /** Marca de tiempo ISO de creación. */
  createdAt: string;
  /** Marca de tiempo ISO de la última actualización. */
  updatedAt: string;
}

/**
 * Cliente DynamoDB Document propio de este repositorio (ver nota de
 * coordinación en el encabezado). Se crea con la región de `config` para que
 * la demo funcione sin configuración adicional.
 */
const baseClient = new DynamoDBClient({ region: config.awsRegion });
const docClient = DynamoDBDocumentClient.from(baseClient);

/** Construye la clave de partición de un job a partir de su id. */
function jobPk(jobId: string): string {
  return `JOB#${jobId}`;
}

/**
 * Persiste un job completo en DynamoDB. Sobrescribe cualquier registro previo
 * con la misma clave (`PutItem`).
 *
 * @param job Registro de job a persistir.
 */
export async function putJob(job: JobRecord): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: config.tableName,
      Item: job,
    })
  );
}

/**
 * Lee un job por su id. Devuelve el registro o `null` si no existe.
 *
 * @param jobId Identificador del job.
 */
export async function getJob(jobId: string): Promise<JobRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { pk: jobPk(jobId) },
    })
  );
  return (result.Item as JobRecord | undefined) ?? null;
}

/**
 * Marca un job como terminado (`status: "done"`), fijando su `output` y
 * actualizando `updatedAt`.
 *
 * @param jobId Identificador del job.
 * @param output Resultado calculado del job.
 */
export async function updateJobDone(
  jobId: string,
  output: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: config.tableName,
      Key: { pk: jobPk(jobId) },
      UpdateExpression:
        "SET #status = :status, #output = :output, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
        "#output": "output",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":status": "done" satisfies JobStatus,
        ":output": output,
        ":updatedAt": new Date().toISOString(),
      },
    })
  );
}
