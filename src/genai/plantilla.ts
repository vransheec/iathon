/**
 * Plantilla local de `Sesion_Aprendizaje` (formato MINEDU) para el *fallback*.
 *
 * Cuando Amazon Bedrock no está disponible o devuelve respuestas inválidas tras
 * el reintento (tarea 7.2), la generación debe producir igualmente un borrador
 * utilizable. `plantillaSesion` construye una `Sesion_Aprendizaje` MINEDU
 * completa y válida (pasa `validateSesion`) a partir del tema, grado y área
 * indicados, con textos en español pedagógicamente razonables y contextualizada
 * a la realidad rural y comunitaria.
 *
 * _Requirements: 5.6, 7.3, 21.5_
 */
import type { SesionAprendizaje } from "./schema.js";

/** Parámetros mínimos para construir una sesión desde la plantilla local. */
export interface PlantillaParams {
  /** Tema de la sesión (obligatorio en la práctica; aquí ya viene validado). */
  tema: string;
  /** Grado o grados del aula (p. ej. "3° y 4°"); opcional. */
  grado?: string;
  /** Área curricular (p. ej. "Comunicación", "Matemática"); opcional. */
  area?: string;
  /** Lengua de la sesión (p. ej. "castellano", "quechua_sureno"); opcional. */
  lengua?: string;
}

/** Devuelve el valor recortado o un valor por defecto si está vacío. */
function orDefault(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed !== "" ? trimmed : fallback;
}

/**
 * Construye una `Sesion_Aprendizaje` MINEDU completa y válida desde la plantilla
 * local, lista para usarse como borrador de respaldo.
 *
 * El contenido es genérico pero pedagógicamente coherente: contextualiza las
 * actividades a la comunidad rural del docente y, cuando la lengua indicada no
 * es castellano, marca la sesión como bilingüe con una consigna señalada para
 * revisión por un hablante de la lengua.
 *
 * @param params Tema, grado, área y lengua de la sesión.
 * @returns Una `Sesion_Aprendizaje` con `estado: "borrador"` y `origen: "plantilla"`.
 */
export function plantillaSesion(params: PlantillaParams): SesionAprendizaje {
  const tema = orDefault(params.tema, "Tema de la sesión");
  const grado = orDefault(params.grado, "multigrado");
  const area = orDefault(params.area, "Comunicación");
  const lengua = orDefault(params.lengua, "castellano");
  const esBilingue = lengua.toLowerCase() !== "castellano";

  // Consigna bilingüe marcada para revisión por un hablante de la lengua.
  const consignaBilingue = esBilingue
    ? `[REVISAR CON HABLANTE DE ${lengua.toUpperCase()}] Traducir y adaptar las ` +
      `consignas de la actividad a la lengua de la comunidad, respetando el ` +
      `vocabulario cultural pertinente.`
    : null;

  const sesion: SesionAprendizaje = {
    titulo: `Sesión de aprendizaje: ${tema}`,
    proposito:
      `Al finalizar la sesión, los estudiantes de ${grado} comprenderán y ` +
      `aplicarán los aprendizajes relacionados con "${tema}" en el área de ` +
      `${area}, partiendo de situaciones significativas de su comunidad rural.`,
    competencias: [
      `Competencia del área de ${area} vinculada al tema "${tema}" según el ` +
        `Currículo Nacional de la Educación Básica del Perú.`,
    ],
    capacidades: [
      `Capacidad para analizar y relacionar "${tema}" con experiencias de la ` +
        `vida cotidiana en la comunidad.`,
      `Capacidad para expresar y comunicar lo aprendido en diferentes formas.`,
    ],
    desempenos: [
      `El estudiante identifica y describe aspectos clave de "${tema}" a partir ` +
        `de su entorno rural.`,
      `El estudiante aplica lo aprendido sobre "${tema}" en una situación ` +
        `concreta de su comunidad.`,
    ],
    momentos: {
      inicio:
        `Se inicia la sesión recogiendo los saberes previos de los estudiantes ` +
        `mediante preguntas sobre cómo observan "${tema}" en su comunidad ` +
        `(chacra, río, animales, festividades locales). Se plantea el propósito ` +
        `de la sesión y el reto de aprendizaje.`,
      desarrollo:
        `Los estudiantes exploran "${tema}" a través de actividades prácticas ` +
        `con materiales del entorno. Trabajan en grupos para observar, dialogar ` +
        `y registrar sus hallazgos, relacionándolos con ejemplos y personajes de ` +
        `su propia comunidad rural. El docente acompaña y hace preguntas que ` +
        `promueven la reflexión.`,
      cierre:
        `Los estudiantes comparten sus conclusiones sobre "${tema}" y reflexionan ` +
        `sobre cómo lo aprendido se aplica en su vida diaria. Se realiza la ` +
        `metacognición: qué aprendieron, cómo lo aprendieron y para qué les sirve.`,
    },
    materiales: [
      "Materiales del entorno (piedras, semillas, hojas, agua).",
      "Papelotes, plumones y cuadernos de trabajo MINEDU.",
      "Fichas de observación elaboradas por el docente.",
    ],
    evaluacion: {
      criterios: [
        `Identifica correctamente aspectos clave de "${tema}" en su contexto.`,
        `Participa y colabora en el trabajo en equipo.`,
        `Explica con sus propias palabras lo aprendido y su utilidad.`,
      ],
    },
    lengua,
    bilingue: esBilingue,
    estado: "borrador",
    origen: "plantilla",
    version: 1,
  };

  // Actividades diferenciadas por grado para aulas multigrado.
  sesion.actividadesPorGrado = [
    {
      grado,
      actividades: [
        `Actividad guiada de exploración de "${tema}" adecuada al grado ${grado}.`,
        `Producción de una evidencia sencilla (dibujo, texto o maqueta) sobre el tema.`,
      ],
    },
  ];

  if (consignaBilingue !== null) {
    sesion.materiales.push(consignaBilingue);
  }

  return sesion;
}
