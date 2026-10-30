/**
 * Lógica pura del flujo asíncrono de jobs (tarea 5.1).
 *
 * Contiene la transformación del *worker* del caso del verificador del
 * hackathon: invertir una cadena. Se mantiene como función pura (sin estado ni
 * dependencias de AWS) para poder probarla de forma aislada (property test de
 * la tarea 5.2) y reutilizarla desde el handler de creación de jobs.
 *
 * _Requirements: 20.6, 20.7_
 */

/**
 * Invierte una cadena respetando correctamente los *code points* Unicode.
 *
 * Se usa `Array.from`, que itera la cadena por *code points* (siguiendo el
 * iterador de strings de ECMAScript) en lugar de por unidades de código UTF-16.
 * Esto evita partir los *surrogate pairs* (p. ej. emojis o caracteres fuera del
 * BMP), cosa que sí ocurriría con `input.split("")`. Los clústeres de grafemas
 * compuestos por varios code points (p. ej. emojis con modificadores) no se
 * preservan como unidad, pero el contrato del verificador define la inversión
 * a nivel de code point, que es la interpretación correcta para esta demo.
 *
 * @param input Cadena de entrada (puede ser vacía, unicode o muy larga).
 * @returns La cadena invertida por code points.
 */
export function reverseString(input: string): string {
  return Array.from(input).reverse().join("");
}
