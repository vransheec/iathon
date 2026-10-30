# Requirements Document

## Introduction

El **Copiloto Docente Rural e Híbrido** es un sistema EdTech *cloud-first* que empodera a docentes de escuelas públicas en zonas rurales y de difícil acceso del Perú. El sistema combina un panel docente integral (asistencia, calificaciones, chat pedagógico con IA, generación de contenido alineado al currículo MINEDU y material multimedia contextualizado a la comunidad del estudiante) con planificación pedagógica asistida por inteligencia artificial multi-agente.

La arquitectura reside por completo en la nube de AWS. El aula se conecta directamente a los servicios AWS a través de un Enlace_Satelital casi siempre disponible: el canal principal es Amazon_Leo (que llega vía DirecTV) y el canal alternativo de respaldo es Starlink (operado por Entel en Perú); el sistema opera sobre cualquiera de los dos y conmuta entre ellos de forma automática. Cada aula dispone de un Thin_Client y un Monitor_Aula por docente; el thin client únicamente renderiza la aplicación cloud y no almacena ni procesa lógica de negocio local. Varias aulas de una misma escuela comparten el Enlace_Satelital.

El factor limitante de la operación es la energía eléctrica, no el internet: si no hay luz, no hay clases, por lo que el escenario de "sin conexión por días" no es un caso crítico. El modelo asume conectividad durante la jornada escolar y tolera microcortes breves del enlace mediante reintento transparente, sin depender de almacenamiento local. El producto está alineado a los lineamientos del MINEDU, incorpora interculturalidad bilingüe para lenguas originarias amazónicas y andinas, y utiliza exclusivamente servicios de AWS, cumpliendo la Ley N.° 29733 de Protección de Datos Personales del Perú.

## Principios Rectores y Restricciones de Primer Nivel

Estos principios son restricciones transversales que todo requisito funcional y no funcional debe respetar.

### Principio 1: Arquitectura Cloud-First

- Toda la lógica de negocio, los datos y los modelos de IA residen en la nube de AWS. El aula consume la aplicación cloud a través del Thin_Client sobre el Enlace_Satelital.
- El Enlace_Satelital está casi siempre disponible durante la jornada escolar. El sistema opera sobre Amazon_Leo (vía DirecTV) como canal principal y conmuta a Starlink (Entel) como respaldo.
- El factor limitante es la energía eléctrica. El sistema no entra en un modo offline prolongado; únicamente tolera microcortes breves del enlace con reintento transparente.

### Principio 2: Costo Bajo (TCO del Sector Público)

- Se priorizan servicios *serverless* y de pago por uso: AWS Lambda, Amazon DynamoDB (on-demand), Amazon S3, Amazon SQS, Amazon SNS, AWS Step Functions y Amazon Bedrock, en lugar de servidores siempre encendidos.
- Se optimiza el ancho de banda satelital mediante compresión, transmisión de solo lo necesario y envío por lotes del tráfico cliente-nube.
- El costo total de propiedad (TCO) debe mantenerse dentro de los presupuestos del sector público.

### Principio 3: Alta Disponibilidad

- Se despliega Multi-AZ en la nube y DynamoDB con replicación mediante Global Tables y Auto Scaling.
- La disponibilidad de la operación depende de la disponibilidad del servicio en nube y del Enlace_Satelital.

## Glossary

- **Copiloto_Docente**: Sistema integral cloud (front web y app) que agrupa las funcionalidades del docente, servido desde la nube de AWS.
- **Thin_Client**: Cliente ligero de aula, uno por docente, que únicamente renderiza la aplicación cloud y no almacena ni procesa lógica de negocio local.
- **Monitor_Aula**: Pantalla del aula asociada al Thin_Client, una por docente.
- **Enlace_Satelital**: Enlace de conectividad satelital del aula hacia los servicios AWS; opera sobre Amazon_Leo o Starlink y conmuta entre ambos.
- **Amazon_Leo**: Canal satelital principal de órbita terrestre baja de AWS, que llega al aula vía DirecTV.
- **Starlink**: Canal satelital alternativo de respaldo, operado por Entel en Perú.
- **Microcorte**: Interrupción breve del Enlace_Satelital durante la jornada, resuelta mediante reintento transparente.
- **Capa_Shiksha**: Capa de IA generativa en la nube responsable de producir Sesiones de Aprendizaje.
- **Sesion_Aprendizaje**: Documento de sesión de aprendizaje en formato MINEDU.
- **Portafolio_Docente**: Conjunto de evidencias del docente asociadas a sesiones validadas.
- **Curador**: Especialista de la UGEL con rol de revisión y validación de sesiones.
- **UGEL**: Unidad de Gestión Educativa Local.
- **MINEDU**: Ministerio de Educación del Perú.
- **Material_MINEDU**: Material educativo oficial que entrega el MINEDU (libros, cuadernos de trabajo, guías docentes, recursos multimedia y plantillas), distribuido digitalmente mediante uno o varios buckets de Amazon S3 en lugar de distribución física.
- **Bucket_Material**: Bucket de Amazon S3 donde el MINEDU publica y versiona el Material_MINEDU para su consumo por las escuelas.
- **Orquestador_Agentes**: Componente en la nube que coordina la ejecución de los agentes de IA mediante un pipeline.
- **Agente_Curricular**: Agente de IA que genera el contenido pedagógico alineado al Currículo Nacional.
- **Agente_Traductor**: Agente de IA que traduce contenido a una Lengua_Originaria.
- **Agente_Contextualizador**: Agente de IA que adapta ejemplos y situaciones al contexto rural y la comunidad.
- **Agente_Portafolio**: Agente de IA que asiste en el armado del Portafolio_Docente.
- **Skill**: Unidad de capacidad invocable de un agente de IA.
- **Steering_File**: Configuración declarativa por agente (lengua, zona, grado, área), almacenada en la nube, que condiciona la generación.
- **Tablero_Analitico**: Panel analítico centralizado en la nube para la UGEL y el MINEDU.
- **Lengua_Originaria**: Lengua originaria soportada (quechua sureño, quechua norteño, asháninka, shipibo-konibo, awajún).
- **Evidencia**: Archivo (foto u otro documento) que respalda una Sesion_Aprendizaje en el Portafolio_Docente.
- **Pipeline_Generacion**: Flujo de generación orquestado en la nube implementado con AWS Step Functions.
- **Base_Datos_Nube**: Base de datos del sistema en la nube (Amazon DynamoDB, con Global Tables), donde se almacenan todas las sesiones, asistencia, calificaciones, portafolios, perfiles e items/jobs.
- **Alta_Disponibilidad**: Capacidad del sistema de mantener el servicio en nube ante fallos.
- **Topic_SNS**: Tema de Amazon SNS utilizado para distribución *fanout* de eventos.
- **Cola_SQS**: Cola de Amazon SQS utilizada para mensajería asíncrona.
- **Asistencia**: Registro del estado de presencia de un estudiante en una sesión o fecha.
- **Calificacion**: Registro de la valoración de un estudiante por competencia o área.
- **Chat_Pedagogico**: Asistente de IA conversacional pedagógico basado en Amazon_Bedrock.
- **Contenido_Multimedia_Contextualizado**: Imágenes o videos que representan la realidad y comunidad del estudiante según la zona.
- **Amazon_Bedrock**: Servicio de AWS para modelos fundacionales de IA generativa.
- **Health_Check**: Verificación del estado de salud de un componente o subsistema que devuelve un código de estado y un mensaje diagnóstico legible.

## Requirements

### Requisito 1: Conectividad Satelital Resiliente

**Historia de Usuario:** Como docente de una escuela rural, quiero que el sistema funcione sobre el enlace satelital y tolere microcortes, para trabajar sin interrupciones visibles cuando el enlace falla brevemente.

#### Criterios de Aceptación

1. THE Copiloto_Docente SHALL operar sobre el Enlace_Satelital utilizando Amazon_Leo como canal principal y Starlink como canal de respaldo.
2. WHEN el canal activo del Enlace_Satelital presenta un fallo sostenido, THE Enlace_Satelital SHALL conmutar automáticamente entre Amazon_Leo y Starlink sin intervención del docente.
3. WHILE existe Enlace_Satelital activo, THE Copiloto_Docente SHALL mantener una latencia de interacción cliente-nube menor o igual a 600 milisegundos.
4. WHEN ocurre un Microcorte durante una operación del docente, THE Copiloto_Docente SHALL reintentar la operación de forma transparente y preservar los datos de la operación en curso.
5. IF el Enlace_Satelital permanece sin señal, THEN THE Copiloto_Docente SHALL indicar que el servicio no está disponible temporalmente y reanudar la operación al restablecerse el enlace.

### Requisito 2: Indicadores de Estado de Conexión

**Historia de Usuario:** Como docente, quiero ver siempre el estado del enlace satelital, para saber si mi trabajo se está procesando con la nube.

#### Criterios de Aceptación

1. THE Copiloto_Docente SHALL mostrar de forma permanente un indicador de estado con uno de los valores "Conectado", "Reconectando" o "Sin enlace".
2. WHILE el Enlace_Satelital está activo y estable, THE Copiloto_Docente SHALL mostrar el indicador en estado "Conectado".
3. WHILE ocurre un Microcorte y el Copiloto_Docente reintenta la conexión, THE Copiloto_Docente SHALL mostrar el indicador en estado "Reconectando".
4. WHILE el Enlace_Satelital permanece sin señal, THE Copiloto_Docente SHALL mostrar el indicador en estado "Sin enlace".

### Requisito 3: Gestión de Contenido Curricular en la Nube

**Historia de Usuario:** Como docente, quiero disponer del currículo nacional y las plantillas MINEDU servidos desde la nube, para generar sesiones con contenido siempre vigente.

#### Criterios de Aceptación

1. THE Copiloto_Docente SHALL almacenar el currículo nacional completo, las plantillas MINEDU vigentes y los recursos multimedia en el almacenamiento de contenido en nube con Amazon S3 y la Base_Datos_Nube.
2. WHEN el docente solicita contenido curricular, THE Copiloto_Docente SHALL servir el contenido desde la nube en menos de 3 segundos.
3. WHEN se publica una versión actualizada del currículo o las plantillas en la nube, THE Copiloto_Docente SHALL servir la versión vigente a los docentes en su siguiente solicitud.
4. WHERE el docente selecciona un periodo, área y grado, THE Copiloto_Docente SHALL filtrar el contenido curricular servido desde la nube según esa selección.
5. THE Copiloto_Docente SHALL obtener el contenido curricular oficial y las plantillas MINEDU a partir del Material_MINEDU almacenado en los Bucket_Material, conforme a la distribución digital definida en el Requisito 26.

### Requisito 4: Autenticación y Control de Accesos

**Historia de Usuario:** Como docente o curador, quiero autenticarme de forma segura, para acceder únicamente a las funciones correspondientes a mi rol.

#### Criterios de Aceptación

1. WHEN el usuario intenta realizar cualquier operación, THE Copiloto_Docente SHALL requerir autenticación mediante Amazon Cognito antes de ejecutar la operación.
2. WHEN un usuario con rol "curador" intenta acceder a funciones de revisión, THE Copiloto_Docente SHALL verificar el rol "curador" del usuario antes de conceder acceso.
3. THE Copiloto_Docente SHALL aplicar control de acceso basado en roles para los roles docente, curador y administrador_UGEL.
4. IF un usuario registra 5 intentos de autenticación fallidos, THEN THE Copiloto_Docente SHALL bloquear la cuenta durante 15 minutos y registrar un evento en el log de seguridad.

### Requisito 5: Generación de Sesiones de Aprendizaje con IA Multi-Agente

**Historia de Usuario:** Como docente, quiero generar sesiones de aprendizaje con asistencia de IA alineadas al currículo MINEDU, para reducir el tiempo de planificación.

#### Criterios de Aceptación

1. WHEN el docente solicita generar una Sesion_Aprendizaje, THE Orquestador_Agentes SHALL coordinar al Agente_Curricular, al Agente_Contextualizador y al Agente_Traductor mediante Amazon_Bedrock y producir la sesión en formato MINEDU en menos de 45 segundos.
2. WHEN el Agente_Curricular genera una Sesion_Aprendizaje, THE Agente_Curricular SHALL incluir competencias, capacidades, desempeños, momentos de inicio, desarrollo y cierre, recursos y criterios de evaluación conforme al Currículo Nacional del Perú.
3. WHERE el docente selecciona una Lengua_Originaria, THE Orquestador_Agentes SHALL producir contenido bilingüe de la Sesion_Aprendizaje.
4. WHEN el Agente_Contextualizador procesa una Sesion_Aprendizaje, THE Agente_Contextualizador SHALL adaptar los ejemplos, situaciones y personajes al contexto rural definido en el Steering_File del docente.
5. WHEN la generación de una Sesion_Aprendizaje finaliza, THE Orquestador_Agentes SHALL guardar la sesión como borrador asociado al docente en la Base_Datos_Nube.
6. IF Amazon_Bedrock no está disponible o se produce un Microcorte durante la generación, THEN THE Orquestador_Agentes SHALL generar la Sesion_Aprendizaje a partir de una plantilla servida desde la nube.
7. WHILE una Sesion_Aprendizaje está en estado de borrador, THE Copiloto_Docente SHALL permitir al docente editar la sesión antes de enviarla a revisión.
8. WHEN el Orquestador_Agentes inicia la generación, THE Orquestador_Agentes SHALL cargar el Steering_File del docente desde la nube.
9. IF la ejecución de una Skill falla, THEN THE Orquestador_Agentes SHALL reintentar la Skill hasta 2 veces antes de aplicar el respaldo o declarar el fallo.

### Requisito 6: Generación Asíncrona de Sesión desde el Panel

**Historia de Usuario:** Como docente, quiero iniciar la generación de una sesión y seguir trabajando mientras se procesa, para no quedar bloqueado durante la generación.

#### Criterios de Aceptación

1. WHEN el docente activa la acción "Generar sesión con IA", THE Copiloto_Docente SHALL crear un trabajo asíncrono de tipo "sesion" y responder con un acuse de recepción de inmediato.
2. WHEN la generación asíncrona finaliza, THE Copiloto_Docente SHALL entregar un resultado que contiene título, propósito, competencia, desempeño, inicio, desarrollo, cierre, materiales y evaluación.
3. WHERE la sesión corresponde a un aula multigrado, THE Agente_Curricular SHALL generar actividades diferenciadas por grado.
4. WHERE el docente selecciona una Lengua_Originaria distinta del castellano, THE Agente_Traductor SHALL marcar las consignas traducidas para revisión por un hablante de la lengua.
5. IF el campo de tema está vacío al solicitar la generación, THEN THE Copiloto_Docente SHALL mostrar un mensaje de error junto al campo de tema y rechazar la solicitud.

### Requisito 7: Confiabilidad de la IA y Manejo de Errores

**Historia de Usuario:** Como docente, quiero que el sistema maneje los errores de la IA de forma predecible, para recibir siempre un borrador utilizable.

#### Criterios de Aceptación

1. WHEN Amazon_Bedrock devuelve una respuesta de generación, THE Orquestador_Agentes SHALL validar la respuesta contra el esquema de la Sesion_Aprendizaje.
2. IF la respuesta del modelo es inválida respecto al esquema o la invocación falla, THEN THE Orquestador_Agentes SHALL reintentar la generación una vez.
3. IF el segundo intento de generación falla, THEN THE Orquestador_Agentes SHALL producir un borrador a partir de una plantilla servida desde la nube y mostrar un aviso claro al docente.

### Requisito 8: Traducción y Adaptación a Lenguas Originarias

**Historia de Usuario:** Como docente de una comunidad bilingüe, quiero traducir las sesiones a la lengua originaria de mis estudiantes, para impartir una educación culturalmente pertinente.

#### Criterios de Aceptación

1. THE Agente_Traductor SHALL soportar al menos 5 Lenguas_Originarias: quechua sureño, quechua norteño, asháninka, shipibo-konibo y awajún.
2. WHEN el Agente_Traductor traduce una Sesion_Aprendizaje mediante Amazon_Bedrock, THE Agente_Traductor SHALL traducir el título, los objetivos, las instrucciones y el vocabulario dentro de los 45 segundos del proceso de generación.
3. WHEN el Agente_Traductor encuentra un término técnico sin equivalente, THE Agente_Traductor SHALL preservar el término en español con el marcador "ES:".
4. WHEN el Agente_Traductor genera una traducción, THE Agente_Traductor SHALL aplicar el glosario y las restricciones vigentes del Steering_File de la Lengua_Originaria almacenado en la nube.
5. WHEN el Agente_Traductor produce contenido traducido, THE Agente_Traductor SHALL validar la pertinencia cultural del contenido contra la lista de restricciones del Steering_File.
6. WHEN el docente inicia una traducción, THE Agente_Traductor SHALL seleccionar el Steering_File según el campo "lengua_originaria" del perfil del docente.

### Requisito 9: Registro de Asistencia

**Historia de Usuario:** Como docente, quiero tomar la asistencia de mis estudiantes, para llevar un control confiable de la presencia en el aula.

#### Criterios de Aceptación

1. WHEN el docente registra la Asistencia de un estudiante para una sesión o fecha, THE Copiloto_Docente SHALL guardar en la Base_Datos_Nube uno de los estados "presente", "ausente", "tardanza" o "justificado".
2. WHEN ocurre un Microcorte durante el registro de Asistencia, THE Copiloto_Docente SHALL reintentar la operación de forma transparente hasta persistirla en la Base_Datos_Nube.
3. WHEN el docente consulta el histórico de Asistencia, THE Copiloto_Docente SHALL mostrar el histórico por estudiante y por aula.

### Requisito 10: Registro de Calificaciones

**Historia de Usuario:** Como docente, quiero registrar las calificaciones de mis estudiantes por competencia, para evaluar su progreso según los estándares MINEDU.

#### Criterios de Aceptación

1. WHEN el docente registra una Calificacion por competencia o área, THE Copiloto_Docente SHALL guardar la Calificacion en la Base_Datos_Nube en la escala MINEDU de letras "AD", "A", "B" o "C" o en escala vigesimal según el nivel educativo.
2. WHEN ocurre un Microcorte durante el registro de Calificacion, THE Copiloto_Docente SHALL reintentar la operación de forma transparente hasta persistirla en la Base_Datos_Nube.
3. WHEN el docente solicita un reporte de notas, THE Copiloto_Docente SHALL generar el reporte por estudiante y por aula.

### Requisito 11: Chat Pedagógico Conversacional

**Historia de Usuario:** Como docente, quiero hacer preguntas pedagógicas en lenguaje natural, para recibir orientación alineada al currículo nacional.

#### Criterios de Aceptación

1. WHEN el docente envía una pregunta al Chat_Pedagogico, THE Chat_Pedagogico SHALL responder mediante Amazon_Bedrock con contexto del Currículo Nacional MINEDU.
2. THE Chat_Pedagogico SHALL atender consultas sobre planificación pedagógica, estrategias de enseñanza, adaptación multigrado y lenguas originarias.
3. IF el Enlace_Satelital no está disponible, THEN THE Chat_Pedagogico SHALL indicar al docente que el servicio no está disponible temporalmente.

### Requisito 12: Contenido Multimedia Contextualizado

**Historia de Usuario:** Como docente, quiero que el material generado represente la realidad de la comunidad de mis estudiantes, para que el aprendizaje sea significativo y culturalmente pertinente.

#### Criterios de Aceptación

1. WHEN el docente solicita Contenido_Multimedia_Contextualizado, THE Copiloto_Docente SHALL generar o seleccionar mediante Amazon_Bedrock imágenes o videos que representen la realidad y la comunidad definida en la zona del Steering_File.
2. WHEN se produce Contenido_Multimedia_Contextualizado, THE Copiloto_Docente SHALL asociar el contenido a la Sesion_Aprendizaje correspondiente.
3. WHEN se produce Contenido_Multimedia_Contextualizado, THE Copiloto_Docente SHALL validar la pertinencia cultural del contenido contra las restricciones del Steering_File.
4. IF el Enlace_Satelital no está disponible, THEN THE Copiloto_Docente SHALL indicar al docente que el servicio de contenido multimedia no está disponible temporalmente.

### Requisito 13: Armado de Portafolio Docente

**Historia de Usuario:** Como docente, quiero armar mi portafolio con evidencias fotográficas, para documentar mi práctica pedagógica y cumplir con la UGEL.

#### Criterios de Aceptación

1. WHEN el docente carga una foto de Evidencia, THE Agente_Portafolio SHALL extraer los metadatos de fecha, hora y geolocalización y asociar la Evidencia a la Sesion_Aprendizaje.
2. WHEN el docente carga una Evidencia, THE Copiloto_Docente SHALL aceptar archivos JPG, PNG o HEIC de hasta 10 megabytes.
3. WHEN el docente carga una Evidencia, THE Copiloto_Docente SHALL subir la Evidencia directamente a Amazon S3 en la nube.
4. WHEN el Copiloto_Docente transmite una Evidencia por el Enlace_Satelital, THE Copiloto_Docente SHALL comprimir la Evidencia al 50 por ciento para optimizar el ancho de banda satelital y preservar el archivo original en la nube.
5. WHEN una Sesion_Aprendizaje validada acumula 3 o más Evidencias, THE Copiloto_Docente SHALL marcar el Portafolio_Docente como "completo".
6. WHEN finaliza un periodo académico, THE Copiloto_Docente SHALL generar un PDF consolidado del Portafolio_Docente del periodo.

### Requisito 14: Gestión de Sesiones del Docente

**Historia de Usuario:** Como docente, quiero guardar y consultar mis sesiones, para reutilizarlas y conocer su origen.

#### Criterios de Aceptación

1. WHEN el docente activa la acción "Guardar en mis sesiones", THE Copiloto_Docente SHALL guardar la Sesion_Aprendizaje en la Base_Datos_Nube.
2. WHEN el docente consulta la lista "Mis sesiones", THE Copiloto_Docente SHALL mostrar cada Sesion_Aprendizaje con su origen "IA" o "plantilla".

### Requisito 15: Revisión y Validación por Curadores

**Historia de Usuario:** Como curador de la UGEL, quiero revisar y validar las sesiones de los docentes, para asegurar la calidad pedagógica y compartir buenas prácticas.

#### Criterios de Aceptación

1. WHEN un docente envía una Sesion_Aprendizaje a revisión, THE Copiloto_Docente SHALL notificar al Curador asignado en su tablero.
2. WHEN el Curador aprueba una Sesion_Aprendizaje, THE Copiloto_Docente SHALL cambiar el estado a "validada" y agregarla al banco de sesiones compartidas de la UGEL en la nube.
3. WHEN el Curador rechaza una Sesion_Aprendizaje, THE Copiloto_Docente SHALL registrar los comentarios del Curador y notificar al docente con las sugerencias.
4. WHEN una Sesion_Aprendizaje se modifica, THE Copiloto_Docente SHALL conservar el historial de versiones de la sesión en la nube.
5. IF una Sesion_Aprendizaje permanece pendiente de revisión más de 15 días hábiles, THEN THE Copiloto_Docente SHALL escalar la sesión al administrador_UGEL.
6. WHEN el Curador revisa una Sesion_Aprendizaje, THE Copiloto_Docente SHALL permitir anotaciones en secciones específicas de la sesión.

### Requisito 16: Ajuste Personalizado de la Currícula por el Docente

**Historia de Usuario:** Como docente, quiero ajustar la programación curricular anual a mi contexto, para planificar según las necesidades de mi aula sin incumplir el currículo.

#### Criterios de Aceptación

1. THE Copiloto_Docente SHALL mostrar la programación curricular anual MINEDU organizada por periodo, área y grado.
2. WHEN el docente reordena los temas de la programación, THE Agente_Curricular SHALL validar la coherencia con las competencias y capacidades obligatorias y avisar si alguna queda sin cobertura.
3. WHEN el docente configura el idioma principal y el idioma secundario por área, THE Copiloto_Docente SHALL guardar la configuración en el Steering_File en la nube.
4. WHEN el docente modifica la programación, THE Agente_Curricular SHALL regenerar los borradores de Sesion_Aprendizaje afectados.
5. THE Copiloto_Docente SHALL mostrar una vista de alineación con el porcentaje de competencias MINEDU cubiertas.
6. WHEN el docente guarda un ajuste de la currícula, THE Copiloto_Docente SHALL actualizar el Steering_File en la nube.
7. IF un cambio rompe las competencias mínimas obligatorias, THEN THE Agente_Curricular SHALL bloquear el cambio, explicar el motivo y sugerir alternativas válidas.

### Requisito 17: Pipeline de Generación Orquestado Multi-Agente

**Historia de Usuario:** Como administrador del sistema, quiero un pipeline de generación trazable y recuperable, para diagnosticar fallos y garantizar resultados consistentes.

#### Criterios de Aceptación

1. WHEN se inicia una generación, THE Pipeline_Generacion SHALL ejecutar en AWS Step Functions los pasos en el orden: carga del Steering_File, validación de entrada, Agente_Curricular, Agente_Contextualizador, Agente_Traductor cuando aplica, formateo MINEDU y almacenamiento del borrador.
2. IF un paso del Pipeline_Generacion falla, THEN THE Pipeline_Generacion SHALL registrar el error con su contexto, compensar los pasos previos y notificar al componente de monitoreo.
3. WHEN una generación se reanuda tras un fallo, THE Pipeline_Generacion SHALL ejecutar la reanudación de forma idempotente.
4. WHEN una generación finaliza, THE Pipeline_Generacion SHALL retornar un identificador único y el estado de la generación.
5. WHEN un paso o un agente se ejecuta, THE Pipeline_Generacion SHALL registrar las métricas por paso y por agente.
6. WHEN una Skill se ejecuta, THE Pipeline_Generacion SHALL registrar el agente, los parámetros y el resultado de la Skill.
7. WHEN el Steering_File se actualiza en la nube, THE Orquestador_Agentes SHALL recargar el Steering_File sin reiniciar.

### Requisito 18: Procesamiento Analítico y Tablero Analítico en la Nube

**Historia de Usuario:** Como especialista de la UGEL, quiero un tablero analítico con datos de las escuelas, para monitorear la actividad pedagógica del territorio.

#### Criterios de Aceptación

1. WHEN se registran nuevas operaciones en la Base_Datos_Nube, THE Pipeline_Generacion SHALL procesarlas con AWS Step Functions, validar su integridad y ejecutar un proceso ETL con Amazon Glue hacia el data lake en la nube.
2. THE Tablero_Analitico SHALL mostrar las sesiones por escuela, la tasa de validación por Curador, los portafolios completados y las métricas por escuela y por UGEL.
3. WHEN se reciben nuevos datos, THE Tablero_Analitico SHALL actualizar las métricas en menos de 5 minutos.
4. THE Tablero_Analitico SHALL permitir filtrar por UGEL, escuela, periodo, grado y área.
5. IF un registro presenta inconsistencia referencial, THEN THE Pipeline_Generacion SHALL aislar el registro y continuar procesando los registros válidos.

### Requisito 19: Mensajería Asíncrona con Amazon SNS y Amazon SQS

**Historia de Usuario:** Como arquitecto del sistema, quiero una mensajería desacoplada basada en eventos, para distribuir notificaciones y procesar trabajos de forma confiable.

#### Criterios de Aceptación

1. WHEN finaliza la generación de una Sesion_Aprendizaje, THE Orquestador_Agentes SHALL publicar un evento "sesion_generada" en el Topic_SNS con el identificador, el docente, la escuela y la marca de tiempo.
2. WHEN el Curador valida o rechaza una Sesion_Aprendizaje, THE Copiloto_Docente SHALL publicar un evento "sesion_revisada" en el Topic_SNS de revisiones.
3. WHEN el Copiloto_Docente procesa trabajos asíncronos, THE Copiloto_Docente SHALL encolar los mensajes en la Cola_SQS con entrega "at-least-once".
4. IF un mensaje de la Cola_SQS falla tras más de 3 intentos, THEN THE Cola_SQS SHALL mover el mensaje a la Dead Letter Queue y registrar el evento en el log de auditoría con sus detalles.
5. WHEN el Steering_File se actualiza, THE Topic_SNS SHALL distribuir el evento mediante *fanout* a las Cola_SQS suscritas.
6. THE Topic_SNS de notificaciones SHALL distribuir los eventos mediante *fanout* al Tablero_Analitico, a las notificaciones de los Curadores y al log de auditoría.
7. THE Cola_SQS SHALL aplicar un *visibility timeout* de 300 segundos a los mensajes en procesamiento.

### Requisito 20: Contrato de API del Hackathon

**Historia de Usuario:** Como jurado del hackathon, quiero verificar el sistema mediante un contrato de API público y automatizable, para evaluar el entregable de forma objetiva.

#### Criterios de Aceptación

1. WHEN se recibe GET en "{base}/health", THE Copiloto_Docente SHALL responder con código 200 y un cuerpo JSON que contiene el campo "status" con valor "ok" y el campo "team" con el identificador del equipo, sin requerir autenticación.
2. WHEN se recibe POST en "{base}/items" con un cuerpo que contiene el campo "value", THE Copiloto_Docente SHALL persistir el valor y responder con código 200 o 201 y un cuerpo JSON que contiene el campo "id", sin requerir autenticación.
3. WHEN se recibe GET en "{base}/items/{id}", THE Copiloto_Docente SHALL responder con un cuerpo JSON que contiene el campo "value" igual al valor persistido para ese id, sin requerir autenticación.
4. WHEN se recibe GET en "{base}/items", THE Copiloto_Docente SHALL responder con la lista de items que incluye el valor persistido, sin requerir autenticación.
5. WHEN se recibe POST en "{base}/jobs" con un cuerpo que contiene el campo "input", THE Copiloto_Docente SHALL responder de inmediato con código 202 o 200 o 201 y un cuerpo JSON que contiene el campo "jobId", sin requerir autenticación.
6. WHEN se recibe GET en "{base}/jobs/{jobId}" dentro de los 12 segundos posteriores a la creación del trabajo, THE Copiloto_Docente SHALL responder con un cuerpo JSON que contiene el campo "status" con valor "done" y el campo "output" con el valor de "input" invertido como cadena al revés, sin requerir autenticación.
7. THE Copiloto_Docente SHALL exponer el comportamiento observable del procesamiento asíncrono mediante un agente o una cola, dejando el resultado disponible antes de 12 segundos.
8. WHEN se recibe GET en "{base}/app", THE Copiloto_Docente SHALL servir el frontend como HTML de acceso público sin autenticación ni redirección.

### Requisito 21: Criterios de Entrega y Evaluación del Hackathon

**Historia de Usuario:** Como jurado del hackathon, quiero que el entregable cumpla los criterios de maestría de la herramienta y de uso de GenAI con propósito, para asignar el puntaje correspondiente.

#### Criterios de Aceptación

1. THE repositorio SHALL incluir, en la misma carpeta ".kiro/specs/{feature}/", los archivos "requirements.md", "design.md" y "tasks.md", cada uno con contenido propio de 300 caracteres o más.
2. THE repositorio SHALL incluir al menos un archivo de steering con contenido de 200 caracteres o más.
3. THE repositorio SHALL incluir al menos un hook que declare una condición "when" y una acción "then".
4. THE Copiloto_Docente SHALL integrar GenAI con propósito en un flujo central del producto mediante Amazon_Bedrock o AgentCore en la generación de Sesiones de Aprendizaje y en el Chat_Pedagogico.
5. WHEN el Copiloto_Docente invoca Amazon_Bedrock en la generación de Sesiones de Aprendizaje y en el Chat_Pedagogico, THE Copiloto_Docente SHALL aplicar prompts diseñados para cada flujo y manejar los errores de invocación.

### Requisito 22: Requisitos No Funcionales — Seguridad, Alta Disponibilidad y Escalabilidad

**Historia de Usuario:** Como responsable del sistema en el sector público, quiero garantías de seguridad, disponibilidad y escalabilidad a bajo costo, para operar de forma sostenible y conforme a la ley.

#### Criterios de Aceptación

1. THE Copiloto_Docente SHALL cifrar los datos en reposo con AES-256 y los datos en tránsito con TLS 1.3 o superior.
2. WHEN un usuario ejecuta una acción, THE Copiloto_Docente SHALL registrar la acción en un log de auditoría inmutable con el usuario, la marca de tiempo y la acción.
3. THE Copiloto_Docente SHALL escalar hasta 5000 aulas concurrentes mediante servicios serverless en la nube.
4. THE Base_Datos_Nube SHALL replicarse mediante DynamoDB Global Tables en al menos 2 regiones.
5. WHEN la carga supera 10000 escrituras por segundo, THE Base_Datos_Nube SHALL aplicar DynamoDB Auto Scaling sin impacto en la latencia.
6. THE Copiloto_Docente SHALL desplegar los servicios con estado en configuración Multi-AZ.
7. THE Copiloto_Docente SHALL cumplir la Ley N.° 29733 de Protección de Datos Personales y los lineamientos del Estado Peruano.
8. THE Copiloto_Docente SHALL priorizar servicios serverless y de pago por uso para optimizar el costo total de propiedad.
9. THE Thin_Client de aula SHALL requerir como mínimo 2 gigabytes de memoria RAM, un navegador web compatible y conexión al Enlace_Satelital, sin almacenar lógica de negocio local.
10. WHEN el canal activo del Enlace_Satelital deja de responder, THE Enlace_Satelital SHALL conmutar entre Amazon_Leo y Starlink en menos de 30 segundos.

### Requisito 23: Optimización de Ancho de Banda Satelital

**Historia de Usuario:** Como administrador del sistema, quiero minimizar el consumo de ancho de banda satelital, para contener costos y mejorar la interacción cliente-nube en enlaces limitados.

#### Criterios de Aceptación

1. WHEN el Copiloto_Docente transmite datos por el Enlace_Satelital, THE Copiloto_Docente SHALL comprimir las cargas antes de transmitirlas.
2. WHEN el Copiloto_Docente envía múltiples operaciones hacia la nube, THE Copiloto_Docente SHALL agrupar las operaciones en lotes.
3. THE Copiloto_Docente SHALL transmitir únicamente los datos que presentan cambios respecto a la versión ya almacenada en la nube.

### Requisito 24: Hardware y Despliegue en el Aula

**Historia de Usuario:** Como administrador de la escuela, quiero un despliegue de aula sencillo basado en clientes ligeros, para operar la aplicación cloud sin infraestructura local compleja.

#### Criterios de Aceptación

1. THE Copiloto_Docente SHALL proveer a cada docente un Thin_Client y un Monitor_Aula por aula.
2. THE Thin_Client SHALL renderizar únicamente la aplicación cloud y no almacenar ni procesar lógica de negocio local.
3. WHERE una escuela tiene varias aulas, THE Copiloto_Docente SHALL operar los Thin_Client de todas las aulas sobre el mismo Enlace_Satelital compartido.

### Requisito 25: Observabilidad y APIs de Salud Diagnósticas

**Historia de Usuario:** Como operador o administrador del sistema, quiero health checks por componente con mensajes claros, para diagnosticar con precisión qué subsistema está sano o degradado.

#### Criterios de Aceptación

1. WHEN se recibe una solicitud GET en la ruta "/health", THE Copiloto_Docente SHALL responder con código HTTP 200 y un cuerpo que incluye un estado global con valor "healthy", "degraded" o "unhealthy" y un arreglo de verificaciones por componente, donde cada verificación contiene el nombre del componente, el estado del componente y un mensaje diagnóstico legible.
2. WHEN se recibe una solicitud GET en la ruta "/health" y todos los componentes están sanos, THE Copiloto_Docente SHALL responder con código HTTP 200 y estado global "healthy".
3. IF al menos un componente no esencial está degradado mientras el sistema sigue operativo, THEN THE Copiloto_Docente SHALL responder con código HTTP 207 y estado global "degraded" e incluir en el mensaje de cada componente afectado la causa específica.
4. IF al menos un componente esencial está caído, THEN THE Copiloto_Docente SHALL responder con código HTTP 503 y estado global "unhealthy" e identificar en el mensaje el componente caído y el motivo.
5. THE Health_Check SHALL verificar de forma individual y reportar un mensaje diagnóstico específico para el Enlace_Satelital indicando si el canal activo es Amazon_Leo o Starlink y la latencia, la Base_Datos_Nube con el indicador alcanzable o no alcanzable, Amazon_Bedrock con el indicador alcanzable, no alcanzable o degradado, el almacenamiento de contenido en nube con Amazon S3 con el indicador disponible o no disponible, y el estado de los endpoints de la API.
6. IF ocurre un Microcorte o el Enlace_Satelital permanece sin señal temporalmente, THEN THE Copiloto_Docente SHALL responder el Health_Check con estado global "degraded" e indicar en el mensaje la causa del enlace.
7. WHEN se recibe una solicitud GET en la ruta "/health/{componente}", THE Copiloto_Docente SHALL responder con el estado y el mensaje diagnóstico del componente indicado.
8. WHEN un endpoint de escritura crea un recurso exitosamente, THE Copiloto_Docente SHALL responder con código HTTP 201 y un mensaje que confirma el recurso creado y su identificador.
9. WHEN un endpoint acepta un trabajo asíncrono, THE Copiloto_Docente SHALL responder con código HTTP 202 y un mensaje que indica el identificador del trabajo y la ruta para consultar su estado.
10. THE Health_Check SHALL incluir en cada respuesta una marca de tiempo y la versión del servicio para trazabilidad.

### Requisito 26: Distribución Digital del Material MINEDU mediante Amazon S3

**Historia de Usuario:** Como administrador del MINEDU o de la UGEL, quiero publicar el material oficial en buckets de Amazon S3, para que las escuelas lo reciban digitalmente desde la nube sin distribución física.

#### Criterios de Aceptación

1. WHEN el MINEDU publica Material_MINEDU, THE Copiloto_Docente SHALL almacenar el material en uno o varios Bucket_Material de Amazon S3 en lugar de distribuirlo físicamente.
2. THE Copiloto_Docente SHALL organizar el Material_MINEDU en el Bucket_Material por nivel educativo, grado, área curricular y periodo.
3. WHEN un docente solicita Material_MINEDU, THE Copiloto_Docente SHALL servir el material desde el Bucket_Material a través del Enlace_Satelital.
4. WHEN el MINEDU publica una versión actualizada de un Material_MINEDU, THE Copiloto_Docente SHALL versionar el objeto en el Bucket_Material y servir la versión vigente a los docentes.
5. THE Copiloto_Docente SHALL cifrar el Material_MINEDU en reposo en el Bucket_Material y restringir el acceso mediante políticas de acceso basadas en roles.
6. WHEN el Copiloto_Docente entrega Material_MINEDU de gran tamaño por el Enlace_Satelital, THE Copiloto_Docente SHALL optimizar la entrega mediante compresión o entrega por demanda para contener el consumo de ancho de banda satelital.
7. WHERE el MINEDU usa varios Bucket_Material, THE Copiloto_Docente SHALL mantener un índice o catálogo que permita a los docentes localizar y recuperar el material correcto.
