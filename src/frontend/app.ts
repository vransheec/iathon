/**
 * Frontend demo del Copiloto Docente Rural servido en `GET /app` (tarea 8.1).
 *
 * Exporta `appHtml`, una cadena HTML pública y autocontenida (SPA mínima, sin
 * login, sin dependencias externas) que el router devuelve con
 * `Content-Type: text/html` y acceso público (Req. 20.8). Todo el CSS y el JS
 * van embebidos para minimizar peticiones sobre el Enlace_Satelital (el aula
 * usa un Thin_Client con ancho de banda satelital limitado, Req. 23).
 *
 * La SPA tiene tres secciones, alineadas al diseño (`design.md` §1 Frontend):
 *   1. Generar sesión con IA  → POST /genai/sesion  (Req. 5, 7)
 *   2. Chat pedagógico        → POST /genai/chat     (Req. 11)
 *   3. Estado de salud        → GET  /health         (Req. 25, 2)
 *
 * El JS usa rutas RELATIVAS (fetch("genai/sesion", ...)) para funcionar servido
 * desde la misma Lambda Function URL sin conocer el host. Es tolerante al
 * formato de respuesta de las rutas de GenAI (que la tarea 7.3 enlaza):
 * acepta la sesión en `data.sesion` o en la raíz, y la respuesta de chat en
 * `respuesta`/`mensaje`/`output`/`text`.
 *
 * Accesibilidad (WCAG): HTML semántico, `lang="es"`, `label` por control,
 * `aria-live` en las zonas de resultado, foco visible y contraste suficiente.
 *
 * _Requirements: 20.8_
 */

/**
 * HTML completo del panel docente demo. Cadena única (no fragmento) con
 * `<!doctype html>` para que el navegador la renderice en modo estándar.
 */
export const appHtml = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Copiloto Docente Rural e Híbrido</title>
  <!-- Favicon inline (data URI) para evitar una peticion 404 a /favicon.ico. -->
  <link rel="icon" href="data:image/svg+xml,&lt;svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'&gt;&lt;text y='14' font-size='14'&gt;📚&lt;/text&gt;&lt;/svg&gt;" />
  <style>
    :root {
      --azul: #0b4f8a;
      --azul-claro: #e7f0f9;
      --verde: #1f7a4d;
      --ambar: #b45309;
      --rojo: #b42318;
      --gris: #475467;
      --borde: #d0d5dd;
      --fondo: #f7f9fc;
      --texto: #1d2939;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: var(--texto);
      background: var(--fondo);
      line-height: 1.5;
    }
    header {
      background: var(--azul);
      color: #fff;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    header h1 { font-size: 1.15rem; margin: 0; }
    header p { margin: 0; font-size: 0.85rem; opacity: 0.9; }
    .estado {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      background: rgba(255, 255, 255, 0.15);
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
    }
    .punto { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: #98a2b3; }
    .punto.ok { background: #32d583; }
    .punto.warn { background: #fdb022; }
    .punto.err { background: #f97066; }
    main {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.25rem;
      display: grid;
      gap: 1.25rem;
    }
    section {
      background: #fff;
      border: 1px solid var(--borde);
      border-radius: 12px;
      padding: 1.1rem 1.2rem;
    }
    section h2 {
      margin: 0 0 0.25rem;
      font-size: 1.05rem;
      color: var(--azul);
    }
    section .ayuda { margin: 0 0 0.9rem; color: var(--gris); font-size: 0.88rem; }
    label { display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem; }
    input, select, textarea {
      width: 100%;
      padding: 0.55rem 0.65rem;
      border: 1px solid var(--borde);
      border-radius: 8px;
      font: inherit;
      color: inherit;
      background: #fff;
    }
    textarea { resize: vertical; min-height: 4rem; }
    input:focus, select:focus, textarea:focus, button:focus {
      outline: 3px solid #90cdf4;
      outline-offset: 1px;
    }
    .fila { display: grid; gap: 0.8rem; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    .campo { margin-bottom: 0.8rem; }
    .error-campo { color: var(--rojo); font-size: 0.8rem; margin-top: 0.25rem; min-height: 1rem; }
    button {
      background: var(--azul);
      color: #fff;
      border: 0;
      border-radius: 8px;
      padding: 0.6rem 1.1rem;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #09426f; }
    button:disabled { background: #98a2b3; cursor: progress; }
    button.secundario { background: #fff; color: var(--azul); border: 1px solid var(--azul); }
    button.secundario:hover { background: var(--azul-claro); }
    .acciones { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    table.tabla { width: 100%; border-collapse: collapse; margin-top: 0.3rem; font-size: 0.85rem; }
    table.tabla th, table.tabla td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--borde); }
    table.tabla th { color: var(--gris); font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.02em; }
    .ok-msg { color: var(--verde); font-size: 0.88rem; margin: 0 0 0.5rem; }
    .nota-pill { display: inline-block; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 6px; background: var(--azul-claro); color: var(--azul); }
    .estado-pill { display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 999px; }
    .estado-presente { background: #d1fadf; color: var(--verde); }
    .estado-ausente { background: #fee4e2; color: var(--rojo); }
    .estado-tardanza { background: #fef0c7; color: var(--ambar); }
    .estado-justificado { background: #e0eaff; color: var(--azul); }
    .resultado {
      margin-top: 1rem;
      background: var(--azul-claro);
      border: 1px solid #bcd4ec;
      border-radius: 8px;
      padding: 0.9rem 1rem;
      font-size: 0.9rem;
    }
    .resultado:empty { display: none; }
    .aviso {
      background: #fff7ed;
      border: 1px solid #fdba74;
      color: var(--ambar);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      margin-bottom: 0.6rem;
    }
    .sesion h3 { margin: 0.8rem 0 0.2rem; font-size: 0.95rem; color: var(--azul); }
    .sesion h4 { margin: 0.7rem 0 0.15rem; font-size: 0.88rem; }
    .sesion ul { margin: 0.2rem 0 0.4rem 1.1rem; padding: 0; }
    .sesion p { margin: 0.2rem 0; }
    .pill {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      margin-left: 0.4rem;
      vertical-align: middle;
    }
    .pill.ia { background: #d1fadf; color: var(--verde); }
    .pill.plantilla { background: #fef0c7; color: var(--ambar); }
    .chat-log { display: grid; gap: 0.6rem; margin-bottom: 0.8rem; }
    .msg { padding: 0.6rem 0.8rem; border-radius: 10px; max-width: 85%; font-size: 0.9rem; }
    .msg.docente { background: var(--azul); color: #fff; justify-self: end; }
    .msg.copiloto { background: var(--azul-claro); border: 1px solid #bcd4ec; justify-self: start; }
    .checks { list-style: none; padding: 0; margin: 0.6rem 0 0; display: grid; gap: 0.4rem; }
    .checks li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; }
    .badge { font-size: 0.72rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 6px; }
    .badge.healthy { background: #d1fadf; color: var(--verde); }
    .badge.degraded { background: #fef0c7; color: var(--ambar); }
    .badge.unhealthy { background: #fee4e2; color: var(--rojo); }
    footer { text-align: center; color: var(--gris); font-size: 0.8rem; padding: 1rem; }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); border: 0;
    }
    .cargando {
      display: inline-flex; align-items: center; gap: 0.5rem;
      color: var(--azul); font-size: 0.9rem; font-weight: 600;
    }
    .spinner {
      width: 1rem; height: 1rem; border-radius: 50%;
      border: 2px solid #bcd4ec; border-top-color: var(--azul);
      animation: girar 0.7s linear infinite;
    }
    @keyframes girar { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
    button .spinner-btn {
      display: inline-block; width: 0.85rem; height: 0.85rem; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.5); border-top-color: #fff;
      margin-right: 0.4rem; vertical-align: -0.1rem;
      animation: girar 0.7s linear infinite;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Copiloto Docente Rural e Híbrido</h1>
      <p>Panel docente demo · planificación asistida por IA alineada al MINEDU</p>
    </div>
    <span class="estado" id="estado-conexion" role="status" aria-live="polite">
      <span class="punto" id="estado-punto"></span>
      <span id="estado-texto">Comprobando enlace…</span>
    </span>
  </header>

  <main>
    <!-- Sección 1: Generar sesión con IA (Req. 5, 7) -->
    <section aria-labelledby="t-sesion">
      <h2 id="t-sesion">Generar sesión de aprendizaje con IA</h2>
      <p class="ayuda">Genera un borrador de Sesión de Aprendizaje en formato MINEDU, contextualizado a tu comunidad rural.</p>
      <form id="form-sesion" novalidate>
        <div class="campo">
          <label for="tema">Tema de la sesión</label>
          <input id="tema" name="tema" type="text" placeholder="Ej.: El ciclo del agua en mi comunidad" autocomplete="off" />
          <div class="error-campo" id="error-tema" aria-live="polite"></div>
        </div>
        <div class="fila">
          <div class="campo">
            <label for="grado">Grado</label>
            <input id="grado" name="grado" type="text" placeholder="Ej.: 3° y 4°" autocomplete="off" />
          </div>
          <div class="campo">
            <label for="area">Área curricular</label>
            <select id="area" name="area">
              <option value="Comunicación">Comunicación</option>
              <option value="Matemática">Matemática</option>
              <option value="Ciencia y Tecnología">Ciencia y Tecnología</option>
              <option value="Personal Social">Personal Social</option>
              <option value="Arte y Cultura">Arte y Cultura</option>
            </select>
          </div>
          <div class="campo">
            <label for="lengua">Lengua</label>
            <select id="lengua" name="lengua">
              <option value="castellano">Castellano</option>
              <option value="quechua_sureno">Quechua sureño</option>
              <option value="quechua_norteno">Quechua norteño</option>
              <option value="ashaninka">Asháninka</option>
              <option value="shipibo_konibo">Shipibo-konibo</option>
              <option value="awajun">Awajún</option>
            </select>
          </div>
        </div>
        <button type="submit" id="btn-sesion">Generar sesión</button>
      </form>
      <div class="resultado" id="resultado-sesion" aria-live="polite"></div>
    </section>

    <!-- Sección: Registro de asistencia (Req. 9) -->
    <section aria-labelledby="t-asistencia">
      <h2 id="t-asistencia">Registro de asistencia</h2>
      <p class="ayuda">Registra la asistencia de tus estudiantes y consulta el histórico del aula.</p>
      <form id="form-asistencia" novalidate>
        <div class="fila">
          <div class="campo">
            <label for="att-aula">Aula</label>
            <input id="att-aula" name="aula" type="text" value="aula-3A" placeholder="Ej.: aula-3A" autocomplete="off" />
          </div>
          <div class="campo">
            <label for="att-estudiante">Estudiante</label>
            <input id="att-estudiante" name="estudiante" type="text" placeholder="Ej.: María Quispe" autocomplete="off" />
          </div>
          <div class="campo">
            <label for="att-fecha">Fecha</label>
            <input id="att-fecha" name="fecha" type="date" />
          </div>
          <div class="campo">
            <label for="att-estado">Estado</label>
            <select id="att-estado" name="estado">
              <option value="presente">Presente</option>
              <option value="ausente">Ausente</option>
              <option value="tardanza">Tardanza</option>
              <option value="justificado">Justificado</option>
            </select>
          </div>
        </div>
        <div class="error-campo" id="error-asistencia" aria-live="polite"></div>
        <div class="acciones">
          <button type="submit" id="btn-asistencia">Registrar asistencia</button>
          <button type="button" class="secundario" id="btn-ver-asistencia">Ver histórico</button>
        </div>
      </form>
      <div class="resultado" id="resultado-asistencia" aria-live="polite"></div>
    </section>

    <!-- Sección: Registro de notas / calificaciones (Req. 10) -->
    <section aria-labelledby="t-notas">
      <h2 id="t-notas">Notas de los estudiantes</h2>
      <p class="ayuda">Sube las calificaciones por competencia (escala MINEDU: AD, A, B, C o vigesimal 0-20) y genera el reporte del aula.</p>
      <form id="form-notas" novalidate>
        <div class="fila">
          <div class="campo">
            <label for="grd-aula">Aula</label>
            <input id="grd-aula" name="aula" type="text" value="aula-3A" placeholder="Ej.: aula-3A" autocomplete="off" />
          </div>
          <div class="campo">
            <label for="grd-estudiante">Estudiante</label>
            <input id="grd-estudiante" name="estudiante" type="text" placeholder="Ej.: María Quispe" autocomplete="off" />
          </div>
          <div class="campo">
            <label for="grd-competencia">Competencia / Área</label>
            <input id="grd-competencia" name="competencia" type="text" placeholder="Ej.: Comunicación C1" autocomplete="off" />
          </div>
          <div class="campo">
            <label for="grd-valor">Nota</label>
            <input id="grd-valor" name="valor" type="text" placeholder="AD, A, B, C o 0-20" autocomplete="off" />
          </div>
        </div>
        <div class="error-campo" id="error-notas" aria-live="polite"></div>
        <div class="acciones">
          <button type="submit" id="btn-notas">Subir nota</button>
          <button type="button" class="secundario" id="btn-ver-notas">Ver reporte</button>
        </div>
      </form>
      <div class="resultado" id="resultado-notas" aria-live="polite"></div>
    </section>

    <!-- Sección 2: Chat pedagógico (Req. 11) -->
    <section aria-labelledby="t-chat">
      <h2 id="t-chat">Chat pedagógico</h2>
      <p class="ayuda">Consulta sobre planificación, estrategias de enseñanza, aulas multigrado y lenguas originarias.</p>
      <div class="chat-log" id="chat-log" aria-live="polite" aria-label="Conversación"></div>
      <form id="form-chat" novalidate>
        <div class="campo">
          <label for="pregunta">Tu pregunta</label>
          <textarea id="pregunta" name="pregunta" placeholder="Escribe tu pregunta pedagógica…"></textarea>
          <div class="error-campo" id="error-pregunta" aria-live="polite"></div>
        </div>
        <button type="submit" id="btn-chat">Enviar pregunta</button>
      </form>
    </section>

    <!-- Sección 3: Estado de salud (Req. 25, 2) -->
    <section aria-labelledby="t-health">
      <h2 id="t-health">Estado del servicio</h2>
      <p class="ayuda">Salud de los componentes en la nube y del enlace satelital.</p>
      <button type="button" id="btn-health">Actualizar estado</button>
      <div class="resultado" id="resultado-health" aria-live="polite"></div>
    </section>
  </main>

  <footer>Copiloto Docente Rural e Híbrido — versión demo · AWS serverless · GenAI con Amazon Bedrock</footer>

  <script>
  (function () {
    "use strict";

    // --- Utilidades ---------------------------------------------------------

    // Escapa texto para interpolar de forma segura en innerHTML (evita XSS).
    function esc(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // Renderiza una lista <ul> a partir de un arreglo de cadenas.
    function lista(items) {
      if (!Array.isArray(items) || items.length === 0) return "";
      return "<ul>" + items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>";
    }

    // fetch con timeout para tolerar microcortes del enlace satelital.
    function fetchJson(ruta, opciones, timeoutMs) {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 60000);
      var opts = Object.assign({ signal: ctrl.signal }, opciones || {});
      return fetch(ruta, opts).then(function (resp) {
        clearTimeout(t);
        return resp.text().then(function (texto) {
          var data = null;
          try { data = texto ? JSON.parse(texto) : null; } catch (e) { data = null; }
          return { ok: resp.ok, status: resp.status, data: data, texto: texto };
        });
      }).catch(function (err) {
        clearTimeout(t);
        throw err;
      });
    }

    // --- Indicador de estado de conexión (Req. 2) ---------------------------

    var estadoPunto = document.getElementById("estado-punto");
    var estadoTexto = document.getElementById("estado-texto");

    function setEstado(clase, texto) {
      estadoPunto.className = "punto " + clase;
      estadoTexto.textContent = texto;
    }

    // --- Sección 1: Generar sesión (POST /genai/sesion) ---------------------

    var formSesion = document.getElementById("form-sesion");
    var btnSesion = document.getElementById("btn-sesion");
    var errorTema = document.getElementById("error-tema");
    var resultadoSesion = document.getElementById("resultado-sesion");

    function renderSesion(data) {
      // Tolerante al formato: { sesion, origen, aviso } o la sesión en la raíz.
      var sesion = (data && data.sesion) ? data.sesion : data;
      var origen = (data && data.origen) || (sesion && sesion.origen) || "IA";
      var aviso = data && data.aviso;
      if (!sesion || !sesion.titulo) {
        resultadoSesion.innerHTML = "<p>No se pudo interpretar la sesión generada.</p>";
        return;
      }
      var pillClase = origen === "plantilla" ? "plantilla" : "ia";
      var html = "";
      if (aviso) html += '<div class="aviso">' + esc(aviso) + "</div>";
      html += '<div class="sesion">';
      html += "<h3>" + esc(sesion.titulo) + '<span class="pill ' + pillClase + '">origen: ' + esc(origen) + "</span></h3>";
      if (sesion.proposito) html += "<h4>Propósito</h4><p>" + esc(sesion.proposito) + "</p>";
      if (sesion.competencias) html += "<h4>Competencias</h4>" + lista(sesion.competencias);
      if (sesion.capacidades) html += "<h4>Capacidades</h4>" + lista(sesion.capacidades);
      if (sesion.desempenos) html += "<h4>Desempeños</h4>" + lista(sesion.desempenos);
      if (sesion.momentos) {
        html += "<h4>Momentos</h4>";
        html += "<p><strong>Inicio:</strong> " + esc(sesion.momentos.inicio) + "</p>";
        html += "<p><strong>Desarrollo:</strong> " + esc(sesion.momentos.desarrollo) + "</p>";
        html += "<p><strong>Cierre:</strong> " + esc(sesion.momentos.cierre) + "</p>";
      }
      if (sesion.materiales) html += "<h4>Materiales</h4>" + lista(sesion.materiales);
      if (sesion.evaluacion && sesion.evaluacion.criterios) {
        html += "<h4>Evaluación</h4>" + lista(sesion.evaluacion.criterios);
      }
      if (sesion.bilingue) {
        html += '<p><strong>Sesión bilingüe</strong> (lengua: ' + esc(sesion.lengua || "") + ")</p>";
      }
      html += "</div>";
      resultadoSesion.innerHTML = html;
    }

    formSesion.addEventListener("submit", function (e) {
      e.preventDefault();
      var tema = document.getElementById("tema").value.trim();
      errorTema.textContent = "";

      // Validación en el borde: tema obligatorio (Req. 6.5).
      if (tema === "") {
        errorTema.textContent = "El tema es obligatorio.";
        document.getElementById("tema").focus();
        return;
      }

      var payload = {
        tema: tema,
        grado: document.getElementById("grado").value.trim(),
        area: document.getElementById("area").value,
        lengua: document.getElementById("lengua").value
      };

      btnSesion.disabled = true;
      btnSesion.textContent = "Generando…";
      resultadoSesion.innerHTML = "<p>Generando sesión con IA, esto puede tardar unos segundos…</p>";

      fetchJson("genai/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, 60000).then(function (res) {
        if (res.status === 400 && res.data) {
          errorTema.textContent = (res.data.message || "Solicitud inválida.");
          resultadoSesion.innerHTML = "";
          return;
        }
        if (!res.ok || !res.data) {
          resultadoSesion.innerHTML = "<p>El servicio de generación no está disponible temporalmente. Intenta nuevamente.</p>";
          return;
        }
        renderSesion(res.data);
      }).catch(function () {
        resultadoSesion.innerHTML = "<p>No se pudo contactar al servicio (posible microcorte del enlace). Intenta nuevamente.</p>";
      }).then(function () {
        btnSesion.disabled = false;
        btnSesion.textContent = "Generar sesión";
      });
    });

    // --- Sección: Asistencia (POST/GET /attendance) -------------------------

    var formAsistencia = document.getElementById("form-asistencia");
    var btnAsistencia = document.getElementById("btn-asistencia");
    var btnVerAsistencia = document.getElementById("btn-ver-asistencia");
    var errorAsistencia = document.getElementById("error-asistencia");
    var resultadoAsistencia = document.getElementById("resultado-asistencia");

    var ETIQUETA_ESTADO = {
      presente: "Presente",
      ausente: "Ausente",
      tardanza: "Tardanza",
      justificado: "Justificado"
    };

    function renderAsistencia(data, okMsg) {
      var registros = (data && data.registros) || [];
      var cabecera = okMsg ? '<p class="ok-msg">' + esc(okMsg) + "</p>" : "";
      if (registros.length === 0) {
        resultadoAsistencia.innerHTML = cabecera + "<p>No hay registros de asistencia para esta aula.</p>";
        return;
      }
      var html = cabecera + '<table class="tabla"><thead><tr>' +
        "<th>Fecha</th><th>Estudiante</th><th>Estado</th></tr></thead><tbody>";
      registros.forEach(function (r) {
        var etiqueta = ETIQUETA_ESTADO[r.estado] || r.estado;
        html += "<tr><td>" + esc(r.fecha) + "</td><td>" + esc(r.estudianteId) +
          '</td><td><span class="estado-pill estado-' + esc(r.estado) + '">' +
          esc(etiqueta) + "</span></td></tr>";
      });
      html += "</tbody></table>";
      resultadoAsistencia.innerHTML = html;
    }

    function cargarAsistencia(okMsg) {
      var aula = document.getElementById("att-aula").value.trim();
      if (aula === "") { errorAsistencia.textContent = "Indica el aula."; return; }
      resultadoAsistencia.innerHTML = '<span class="cargando"><span class="spinner" aria-hidden="true"></span>Consultando histórico…</span>';
      fetchJson("attendance?aula=" + encodeURIComponent(aula), { method: "GET" }, 15000)
        .then(function (res) {
          if (!res.ok || !res.data) {
            resultadoAsistencia.innerHTML = "<p>No se pudo consultar la asistencia.</p>";
            return;
          }
          renderAsistencia(res.data, okMsg);
        }).catch(function () {
          resultadoAsistencia.innerHTML = "<p>No se pudo contactar al servicio (posible microcorte del enlace).</p>";
        });
    }

    formAsistencia.addEventListener("submit", function (e) {
      e.preventDefault();
      errorAsistencia.textContent = "";
      var aula = document.getElementById("att-aula").value.trim();
      var estudiante = document.getElementById("att-estudiante").value.trim();
      var fecha = document.getElementById("att-fecha").value;
      var estado = document.getElementById("att-estado").value;

      if (aula === "" || estudiante === "") {
        errorAsistencia.textContent = "El aula y el estudiante son obligatorios.";
        return;
      }

      var payload = { aulaId: aula, estudianteId: estudiante, estado: estado };
      if (fecha) { payload.fecha = fecha; }

      btnAsistencia.disabled = true;
      btnAsistencia.innerHTML = '<span class="spinner-btn" aria-hidden="true"></span>Guardando…';
      resultadoAsistencia.innerHTML = '<span class="cargando"><span class="spinner" aria-hidden="true"></span>Registrando asistencia de ' + esc(estudiante) + '…</span>';

      fetchJson("attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, 15000).then(function (res) {
        if (res.status === 400 && res.data) {
          errorAsistencia.textContent = res.data.message || "Solicitud inválida.";
          return;
        }
        if (!res.ok) {
          errorAsistencia.textContent = "El servicio no está disponible temporalmente.";
          return;
        }
        document.getElementById("att-estudiante").value = "";
        cargarAsistencia("✓ Asistencia de " + estudiante + " registrada.");
      }).catch(function () {
        errorAsistencia.textContent = "No se pudo guardar (posible microcorte del enlace). Reintenta.";
        resultadoAsistencia.innerHTML = "";
      }).then(function () {
        btnAsistencia.disabled = false;
        btnAsistencia.textContent = "Registrar asistencia";
      });
    });

    btnVerAsistencia.addEventListener("click", function () { cargarAsistencia(); });

    // --- Sección: Notas / calificaciones (POST/GET /grades) -----------------

    var formNotas = document.getElementById("form-notas");
    var btnNotas = document.getElementById("btn-notas");
    var btnVerNotas = document.getElementById("btn-ver-notas");
    var errorNotas = document.getElementById("error-notas");
    var resultadoNotas = document.getElementById("resultado-notas");

    function renderNotas(data, okMsg) {
      var registros = (data && data.registros) || [];
      var cabecera = okMsg ? '<p class="ok-msg">' + esc(okMsg) + "</p>" : "";
      if (registros.length === 0) {
        resultadoNotas.innerHTML = cabecera + "<p>No hay notas registradas para esta aula.</p>";
        return;
      }
      var html = cabecera + '<table class="tabla"><thead><tr>' +
        "<th>Estudiante</th><th>Competencia</th><th>Nota</th><th>Escala</th></tr></thead><tbody>";
      registros.forEach(function (r) {
        html += "<tr><td>" + esc(r.estudianteId) + "</td><td>" + esc(r.competencia) +
          '</td><td><span class="nota-pill">' + esc(r.valor) + "</span></td><td>" +
          esc(r.escala) + "</td></tr>";
      });
      html += "</tbody></table>";
      resultadoNotas.innerHTML = html;
    }

    function cargarNotas(okMsg) {
      var aula = document.getElementById("grd-aula").value.trim();
      if (aula === "") { errorNotas.textContent = "Indica el aula."; return; }
      resultadoNotas.innerHTML = '<span class="cargando"><span class="spinner" aria-hidden="true"></span>Consultando reporte…</span>';
      fetchJson("grades?aula=" + encodeURIComponent(aula), { method: "GET" }, 15000)
        .then(function (res) {
          if (!res.ok || !res.data) {
            resultadoNotas.innerHTML = "<p>No se pudo consultar el reporte.</p>";
            return;
          }
          renderNotas(res.data, okMsg);
        }).catch(function () {
          resultadoNotas.innerHTML = "<p>No se pudo contactar al servicio (posible microcorte del enlace).</p>";
        });
    }

    formNotas.addEventListener("submit", function (e) {
      e.preventDefault();
      errorNotas.textContent = "";
      var aula = document.getElementById("grd-aula").value.trim();
      var estudiante = document.getElementById("grd-estudiante").value.trim();
      var competencia = document.getElementById("grd-competencia").value.trim();
      var valor = document.getElementById("grd-valor").value.trim();

      if (aula === "" || estudiante === "" || competencia === "" || valor === "") {
        errorNotas.textContent = "Todos los campos son obligatorios.";
        return;
      }

      var payload = {
        aulaId: aula,
        estudianteId: estudiante,
        competencia: competencia,
        valor: valor
      };

      btnNotas.disabled = true;
      btnNotas.innerHTML = '<span class="spinner-btn" aria-hidden="true"></span>Guardando…';
      resultadoNotas.innerHTML = '<span class="cargando"><span class="spinner" aria-hidden="true"></span>Subiendo nota de ' + esc(estudiante) + '…</span>';

      fetchJson("grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, 15000).then(function (res) {
        if (res.status === 400 && res.data) {
          errorNotas.textContent = res.data.message || "Solicitud inválida.";
          return;
        }
        if (!res.ok) {
          errorNotas.textContent = "El servicio no está disponible temporalmente.";
          return;
        }
        document.getElementById("grd-valor").value = "";
        cargarNotas("✓ Nota de " + estudiante + " registrada.");
      }).catch(function () {
        errorNotas.textContent = "No se pudo guardar (posible microcorte del enlace). Reintenta.";
        resultadoNotas.innerHTML = "";
      }).then(function () {
        btnNotas.disabled = false;
        btnNotas.textContent = "Subir nota";
      });
    });

    btnVerNotas.addEventListener("click", function () { cargarNotas(); });

    // --- Sección 2: Chat pedagógico (POST /genai/chat) ----------------------

    var formChat = document.getElementById("form-chat");
    var btnChat = document.getElementById("btn-chat");
    var chatLog = document.getElementById("chat-log");
    var errorPregunta = document.getElementById("error-pregunta");

    function agregarMensaje(clase, texto) {
      var div = document.createElement("div");
      div.className = "msg " + clase;
      div.textContent = texto;
      chatLog.appendChild(div);
      chatLog.scrollTop = chatLog.scrollHeight;
      return div;
    }

    // Extrae la respuesta del chat de forma tolerante al nombre del campo.
    function extraerRespuesta(data) {
      if (!data) return "";
      return data.respuesta || data.mensaje || data.output || data.text || data.answer || "";
    }

    formChat.addEventListener("submit", function (e) {
      e.preventDefault();
      var campo = document.getElementById("pregunta");
      var pregunta = campo.value.trim();
      errorPregunta.textContent = "";

      if (pregunta === "") {
        errorPregunta.textContent = "Escribe una pregunta.";
        campo.focus();
        return;
      }

      agregarMensaje("docente", pregunta);
      campo.value = "";
      var pensando = agregarMensaje("copiloto", "Pensando…");
      btnChat.disabled = true;

      fetchJson("genai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: pregunta, mensaje: pregunta })
      }, 60000).then(function (res) {
        if (res.status === 503) {
          pensando.textContent = "El servicio de chat no está disponible temporalmente.";
          return;
        }
        if (!res.ok || !res.data) {
          pensando.textContent = "No se pudo obtener respuesta. Intenta nuevamente.";
          return;
        }
        var respuesta = extraerRespuesta(res.data);
        pensando.textContent = respuesta || "No se recibió contenido en la respuesta.";
      }).catch(function () {
        pensando.textContent = "No se pudo contactar al servicio (posible microcorte del enlace).";
      }).then(function () {
        btnChat.disabled = false;
      });
    });

    // --- Sección 3: Estado de salud (GET /health) ---------------------------

    var btnHealth = document.getElementById("btn-health");
    var resultadoHealth = document.getElementById("resultado-health");

    function badgeClase(status) {
      if (status === "healthy") return "healthy";
      if (status === "unhealthy") return "unhealthy";
      return "degraded";
    }

    function renderHealth(data) {
      if (!data) {
        resultadoHealth.innerHTML = "<p>Sin datos de salud.</p>";
        return;
      }
      var html = "";
      html += "<p><strong>Equipo:</strong> " + esc(data.team || "—") +
        " · <strong>Versión:</strong> " + esc(data.version || "—") +
        ' · <strong>Global:</strong> <span class="badge ' + badgeClase(data.global) + '">' +
        esc(data.global || "—") + "</span></p>";
      if (Array.isArray(data.checks)) {
        html += '<ul class="checks">';
        data.checks.forEach(function (c) {
          html += "<li>";
          html += '<span class="badge ' + badgeClase(c.status) + '">' + esc(c.status) + "</span> ";
          html += "<strong>" + esc(c.component) + ":</strong> " + esc(c.message || "");
          html += "</li>";
        });
        html += "</ul>";
      }
      resultadoHealth.innerHTML = html;
    }

    // Actualiza el indicador de conexión de la cabecera a partir de /health.
    function actualizarIndicador(res) {
      if (res && res.ok && res.data) {
        var global = res.data.global;
        if (global === "healthy") { setEstado("ok", "Conectado"); }
        else if (global === "unhealthy") { setEstado("err", "Servicio no disponible"); }
        else { setEstado("warn", "Reconectando"); }
      } else {
        setEstado("err", "Sin enlace");
      }
    }

    function consultarHealth(mostrarDetalle) {
      if (mostrarDetalle) {
        btnHealth.disabled = true;
        resultadoHealth.innerHTML = "<p>Consultando estado…</p>";
      }
      return fetchJson("health", { method: "GET" }, 10000).then(function (res) {
        actualizarIndicador(res);
        if (mostrarDetalle) {
          if (res.data) { renderHealth(res.data); }
          else { resultadoHealth.innerHTML = "<p>No se pudo leer el estado.</p>"; }
        }
        return res;
      }).catch(function () {
        setEstado("err", "Sin enlace");
        if (mostrarDetalle) {
          resultadoHealth.innerHTML = "<p>No se pudo contactar al servicio de salud.</p>";
        }
      }).then(function (res) {
        if (mostrarDetalle) { btnHealth.disabled = false; }
        return res;
      });
    }

    btnHealth.addEventListener("click", function () { consultarHealth(true); });

    // Comprobación inicial del enlace y sondeo periódico ligero (cada 30 s).
    consultarHealth(false);
    setInterval(function () { consultarHealth(false); }, 30000);
  })();
  </script>
</body>
</html>`;
