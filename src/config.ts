/**
 * Configuración de la demo del Copiloto Docente Rural.
 *
 * Lee las variables de entorno inyectadas en la Lambda y provee valores por
 * defecto razonables para que la demo funcione sin configuración adicional.
 * Requisito relacionado: 22.8 (serverless, bajo costo).
 */

/** Devuelve el valor de una variable de entorno o un valor por defecto. */
function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value !== "" ? value : fallback;
}

export interface Config {
  /** Identificador del equipo, expuesto en GET /health. */
  teamId: string;
  /** Nombre de la tabla DynamoDB (items y jobs). */
  tableName: string;
  /** Modelo Bedrock rápido/barato (Claude Haiku) para respuestas ágiles. */
  bedrockModelId: string;
  /** Modelo Bedrock de calidad (Claude Sonnet) para generación cuidada. */
  bedrockModelIdQuality: string;
  /** Región AWS de los servicios (DynamoDB, Bedrock). */
  awsRegion: string;
  /** Versión del servicio, expuesta en GET /health. */
  serviceVersion: string;
}

export const config: Config = {
  teamId: env("TEAM_ID", "copiloto-rural"),
  tableName: env("TABLE_NAME", "copiloto-rural-demo"),
  // Nota: los modelos Claude 4.5 NO admiten invocación on-demand con el ID
  // directo; requieren el inference profile regional (prefijo "us."). Usar el
  // ID sin prefijo produce ValidationException y fuerza el fallback a plantilla.
  bedrockModelId: env("BEDROCK_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
  bedrockModelIdQuality: env(
    "BEDROCK_MODEL_ID_QUALITY",
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
  ),
  awsRegion: env("AWS_REGION", "us-east-1"),
  serviceVersion: env("SERVICE_VERSION", "1.0.0"),
};
