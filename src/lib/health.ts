/**
 * Cálculo PURO del estado global de salud a partir de las verificaciones por
 * componente (tarea 3.1).
 *
 * Esta función no realiza E/S: recibe el resultado ya computado de cada
 * verificación de componente y deriva de forma determinista el estado global y
 * el código HTTP del contrato del hackathon. Al ser pura, es trivialmente
 * testeable (Property 5 y Property 6 del diseño).
 *
 * Reglas (Req. 25.1-25.6):
 *   - Todos los componentes `healthy`            ⇒ { global: "healthy",   httpStatus: 200 }.
 *   - Algún componente degradado (o un esencial
 *     degradado pero no caído) y ningún esencial
 *     `unhealthy`                                ⇒ { global: "degraded",  httpStatus: 207 }.
 *   - Algún componente ESENCIAL `unhealthy`      ⇒ { global: "unhealthy", httpStatus: 503 }.
 *
 * Nota Req. 25.6: un microcorte del enlace satelital se modela como `degraded`
 * y el enlace NO es esencial, de modo que su degradación —o incluso su caída—
 * nunca escala a `unhealthy`/503. Solo la caída de un componente marcado como
 * esencial produce `unhealthy`.
 */

/** Estado posible de un componente individual. */
export type ComponentStatus = "healthy" | "degraded" | "unhealthy";

/** Estado global derivado del conjunto de verificaciones. */
export type GlobalStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Resultado de una verificación por componente. Es la unidad que compone el
 * arreglo `checks` de la respuesta de `/health` (Req. 25.1).
 */
export interface HealthCheck {
  /** Nombre del componente (p. ej. "dynamodb", "bedrock", "enlace_satelital"). */
  component: string;
  /** Estado del componente verificado. */
  status: ComponentStatus;
  /**
   * Indica si el componente es esencial para la salud del servicio. Solo la
   * caída (`unhealthy`) de un componente esencial produce estado global
   * `unhealthy`/503 (Req. 25.4).
   */
  essential: boolean;
  /** Mensaje diagnóstico legible con la causa específica (Req. 25.3-25.5). */
  message: string;
}

/** Resultado del cálculo global: estado y código HTTP del contrato. */
export interface GlobalHealth {
  /** Estado global agregado. */
  global: GlobalStatus;
  /** Código HTTP del contrato: 200 healthy, 207 degraded, 503 unhealthy. */
  httpStatus: number;
}

/**
 * Calcula el estado global y el código HTTP a partir de las verificaciones por
 * componente. Función pura y determinista (Property 6).
 *
 * @param checks Arreglo de verificaciones por componente ya evaluadas.
 * @returns El estado global y su código HTTP correspondiente.
 */
export function computeGlobalHealth(checks: readonly HealthCheck[]): GlobalHealth {
  // Un componente ESENCIAL caído degrada el servicio por completo (Req. 25.4).
  const essentialDown = checks.some(
    (check) => check.essential && check.status === "unhealthy"
  );
  if (essentialDown) {
    return { global: "unhealthy", httpStatus: 503 };
  }

  // Cualquier componente que no esté plenamente sano —sin que ningún esencial
  // esté caído— produce `degraded` (Req. 25.3). Esto abarca:
  //   - componentes NO esenciales `degraded` o incluso `unhealthy` (p. ej. un
  //     microcorte del enlace satelital, Req. 25.6), y
  //   - componentes esenciales `degraded` (degradados pero no caídos).
  const anyNotHealthy = checks.some((check) => check.status !== "healthy");
  if (anyNotHealthy) {
    return { global: "degraded", httpStatus: 207 };
  }

  // Todos los componentes sanos (Req. 25.2).
  return { global: "healthy", httpStatus: 200 };
}
