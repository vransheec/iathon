/**
 * Esquema y validación de `Sesion_Aprendizaje` (formato MINEDU).
 *
 * Define el tipo TypeScript `SesionAprendizaje` y una función pura
 * `validateSesion` que valida tipos y campos obligatorios sin realizar accesos
 * de red, de modo que pueda probarse de forma aislada. Toda respuesta de
 * Bedrock debe validarse contra este esquema antes de usarse.
 *
 * _Requirements: 5.2, 7.1, 21.4_
 */

/** Momentos pedagógicos de la sesión (estructura MINEDU). */
export interface MomentosSesion {
  inicio: string;
  desarrollo: string;
  cierre: string;
}

/** Criterios de evaluación de la sesión. */
export interface EvaluacionSesion {
  criterios: string[];
}

/** Actividades diferenciadas por grado (aula multigrado). */
export interface ActividadesPorGrado {
  grado: string;
  actividades: string[];
}

/**
 * Sesión de Aprendizaje en el formato MINEDU usado para validar respuestas de
 * Bedrock y para persistir borradores.
 */
export interface SesionAprendizaje {
  /** Identificador de la sesión (asignado al persistir). */
  sesionId?: string;
  /** Título de la sesión. Obligatorio. */
  titulo: string;
  /** Propósito de aprendizaje. Obligatorio. */
  proposito: string;
  /** Competencias del Currículo Nacional. Obligatorio y no vacío. */
  competencias: string[];
  /** Capacidades asociadas a las competencias. */
  capacidades: string[];
  /** Desempeños esperados. */
  desempenos: string[];
  /** Momentos de la sesión: inicio, desarrollo y cierre. Obligatorio. */
  momentos: MomentosSesion;
  /** Materiales y recursos. */
  materiales: string[];
  /** Evaluación con sus criterios. Obligatorio. */
  evaluacion: EvaluacionSesion;
  /** Lengua de la sesión (p. ej. "castellano", "quechua_sureno"). */
  lengua?: string;
  /** Indica si la sesión es bilingüe (EIB). */
  bilingue?: boolean;
  /** Actividades diferenciadas por grado (aula multigrado). */
  actividadesPorGrado?: ActividadesPorGrado[];
  /** Estado del borrador: "borrador" | "validada" | "rechazada". */
  estado?: string;
  /** Origen de la sesión: "IA" | "plantilla". */
  origen?: string;
  /** Versión del documento. */
  version?: number;
}

/** Resultado de `validateSesion`: válido con valor o inválido con errores. */
export type ValidationResult =
  | { valid: true; value: SesionAprendizaje }
  | { valid: false; errors: string[] };

/** ¿Es un objeto plano (no nulo, no arreglo)? */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** ¿Es un arreglo de cadenas? */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** ¿Es una cadena no vacía (ignorando espacios)? */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Valida un objeto desconocido contra el esquema de `Sesion_Aprendizaje`.
 *
 * Verifica tipos y campos obligatorios: `titulo`, `proposito`, `competencias`
 * (no vacío), `momentos.inicio/desarrollo/cierre` y `evaluacion.criterios`.
 * Los campos opcionales se validan solo si están presentes.
 *
 * @param obj Valor a validar (p. ej. el JSON devuelto por Bedrock).
 * @returns `{ valid: true, value }` o `{ valid: false, errors }`.
 */
export function validateSesion(obj: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(obj)) {
    return { valid: false, errors: ["La sesión debe ser un objeto."] };
  }

  // Campos obligatorios de tipo cadena.
  if (!isNonEmptyString(obj.titulo)) {
    errors.push("El campo 'titulo' es obligatorio y debe ser una cadena no vacía.");
  }
  if (!isNonEmptyString(obj.proposito)) {
    errors.push("El campo 'proposito' es obligatorio y debe ser una cadena no vacía.");
  }

  // competencias: arreglo de cadenas no vacío.
  if (!isStringArray(obj.competencias)) {
    errors.push("El campo 'competencias' debe ser un arreglo de cadenas.");
  } else if (obj.competencias.length === 0) {
    errors.push("El campo 'competencias' no puede estar vacío.");
  }

  // capacidades y desempenos: arreglos de cadenas (obligatorios como tipo).
  if (!isStringArray(obj.capacidades)) {
    errors.push("El campo 'capacidades' debe ser un arreglo de cadenas.");
  }
  if (!isStringArray(obj.desempenos)) {
    errors.push("El campo 'desempenos' debe ser un arreglo de cadenas.");
  }

  // momentos: objeto con inicio/desarrollo/cierre como cadenas no vacías.
  if (!isRecord(obj.momentos)) {
    errors.push("El campo 'momentos' es obligatorio y debe ser un objeto.");
  } else {
    for (const momento of ["inicio", "desarrollo", "cierre"] as const) {
      if (!isNonEmptyString(obj.momentos[momento])) {
        errors.push(
          `El campo 'momentos.${momento}' es obligatorio y debe ser una cadena no vacía.`
        );
      }
    }
  }

  // materiales: arreglo de cadenas.
  if (!isStringArray(obj.materiales)) {
    errors.push("El campo 'materiales' debe ser un arreglo de cadenas.");
  }

  // evaluacion: objeto con criterios como arreglo de cadenas no vacío.
  if (!isRecord(obj.evaluacion)) {
    errors.push("El campo 'evaluacion' es obligatorio y debe ser un objeto.");
  } else if (!isStringArray(obj.evaluacion.criterios)) {
    errors.push("El campo 'evaluacion.criterios' debe ser un arreglo de cadenas.");
  } else if (obj.evaluacion.criterios.length === 0) {
    errors.push("El campo 'evaluacion.criterios' no puede estar vacío.");
  }

  // Campos opcionales: validar solo si están presentes.
  if (obj.sesionId !== undefined && typeof obj.sesionId !== "string") {
    errors.push("El campo 'sesionId' debe ser una cadena.");
  }
  if (obj.lengua !== undefined && typeof obj.lengua !== "string") {
    errors.push("El campo 'lengua' debe ser una cadena.");
  }
  if (obj.bilingue !== undefined && typeof obj.bilingue !== "boolean") {
    errors.push("El campo 'bilingue' debe ser un booleano.");
  }
  if (obj.estado !== undefined && typeof obj.estado !== "string") {
    errors.push("El campo 'estado' debe ser una cadena.");
  }
  if (obj.origen !== undefined && typeof obj.origen !== "string") {
    errors.push("El campo 'origen' debe ser una cadena.");
  }
  if (obj.version !== undefined && typeof obj.version !== "number") {
    errors.push("El campo 'version' debe ser un número.");
  }
  if (obj.actividadesPorGrado !== undefined) {
    if (!Array.isArray(obj.actividadesPorGrado)) {
      errors.push("El campo 'actividadesPorGrado' debe ser un arreglo.");
    } else {
      obj.actividadesPorGrado.forEach((entry, index) => {
        if (!isRecord(entry)) {
          errors.push(`'actividadesPorGrado[${index}]' debe ser un objeto.`);
          return;
        }
        if (typeof entry.grado !== "string") {
          errors.push(`'actividadesPorGrado[${index}].grado' debe ser una cadena.`);
        }
        if (!isStringArray(entry.actividades)) {
          errors.push(
            `'actividadesPorGrado[${index}].actividades' debe ser un arreglo de cadenas.`
          );
        }
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, value: obj as unknown as SesionAprendizaje };
}
