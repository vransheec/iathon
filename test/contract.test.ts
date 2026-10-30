/**
 * Test del contrato del verificador (checkpoint 6).
 *
 * Verifica EN RUNTIME LOCAL que el handler de la Lambda (`src/handler.ts`)
 * ejecuta el código REAL de las rutas (health, items, jobs) tras la corrección
 * del router (imports estáticos en lugar de require dinámico). Antes de la
 * corrección, el router cargaba los módulos con `createRequire` + especificador
 * no literal, por lo que esbuild no los incluía y todas las rutas respondían
 * 503 "módulo no disponible". Este test confirma que ya NO es así.
 *
 * Estrategia de aislamiento (sin AWS real):
 *   - `src/lib/jobs-store.js` se mockea con un Map en memoria (persistencia de
 *     jobs), de modo que POST /jobs guarda y GET /jobs/{jobId} recupera.
 *   - `src/lib/ddb.js` se mockea con un Map en memoria (persistencia de items).
 *   - `@aws-sdk/client-dynamodb` se mockea para que la sonda `DescribeTable` de
 *     `/health` resuelva con éxito: así DynamoDB se reporta ALCANZABLE y, al ser
 *     el único componente esencial además del propio servicio, el estado global
 *     es `healthy`/200 (contrato Req. 25.2).
 *
 * No se mockea la lógica de negocio (inversión de cadena, cálculo de salud,
 * esquema de items): esos caminos se ejecutan de verdad.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mock de la persistencia de jobs (Map en memoria) --------------------
vi.mock("../src/lib/jobs-store.js", () => {
  const store = new Map<string, unknown>();
  return {
    // Reexponemos el store para poder limpiarlo entre tests.
    __store: store,
    async putJob(job: { jobId: string }) {
      store.set(job.jobId, job);
    },
    async getJob(jobId: string) {
      return store.get(jobId) ?? null;
    },
    async updateJobDone(jobId: string, output: string) {
      const existing = store.get(jobId) as Record<string, unknown> | undefined;
      if (existing) {
        store.set(jobId, { ...existing, status: "done", output });
      }
    },
  };
});

// --- Mock de la persistencia de items (Map en memoria) -------------------
vi.mock("../src/lib/ddb.js", () => {
  const store = new Map<string, unknown>();
  let counter = 0;
  return {
    __store: store,
    async putItem(value: unknown) {
      const id = `item-${++counter}`;
      store.set(id, value);
      return { id };
    },
    async getItemById(id: string) {
      if (!store.has(id)) return null;
      return { value: store.get(id) };
    },
    async listAllItems() {
      return Array.from(store.entries()).map(([id, value]) => ({ id, value }));
    },
  };
});

// --- Mock de DynamoDB low-level para la sonda de /health -----------------
// Con DescribeTable resolviendo, DynamoDB se considera ALCANZABLE => healthy.
vi.mock("@aws-sdk/client-dynamodb", () => {
  class DynamoDBClient {
    async send() {
      // DescribeTable resuelve: DynamoDB alcanzable.
      return { Table: { TableStatus: "ACTIVE" } };
    }
  }
  class DescribeTableCommand {
    constructor(public input: unknown) {}
  }
  return { DynamoDBClient, DescribeTableCommand };
});

// Importamos el handler DESPUÉS de declarar los mocks (vi.mock es hoisted).
import { handler } from "../src/handler.js";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

/** Construye un evento de Lambda Function URL (payload format v2.0). */
function makeEvent(
  method: string,
  path: string,
  body?: unknown
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: path,
    rawQueryString: "",
    headers: { "content-type": "application/json" },
    requestContext: {
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "contract-test",
      },
    } as APIGatewayProxyEventV2["requestContext"],
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

/** Invoca el handler y devuelve { statusCode, json }. */
async function invoke(method: string, path: string, body?: unknown) {
  const res = (await handler(makeEvent(method, path, body))) as {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  };
  let parsed: unknown = undefined;
  try {
    parsed = res.body ? JSON.parse(res.body) : undefined;
  } catch {
    parsed = undefined;
  }
  return { statusCode: res.statusCode, json: parsed, raw: res };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Contrato del verificador — /jobs (asíncrono, output = input invertido)", () => {
  it("POST /jobs responde 202 con jobId y GET /jobs/{jobId} devuelve done + output invertido", async () => {
    const created = await invoke("POST", "/jobs", { input: "hola" });
    expect(created.statusCode).toBe(202);
    const jobId = (created.json as { jobId?: string }).jobId;
    expect(typeof jobId).toBe("string");
    expect(jobId).toBeTruthy();

    const fetched = await invoke("GET", `/jobs/${jobId}`);
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json).toMatchObject({ status: "done", output: "aloh" });
  });

  it("maneja correctamente entradas unicode (inversión por code points)", async () => {
    const input = "héllo 🌟 níño";
    const expected = Array.from(input).reverse().join("");

    const created = await invoke("POST", "/jobs", { input });
    expect(created.statusCode).toBe(202);
    const jobId = (created.json as { jobId?: string }).jobId!;

    const fetched = await invoke("GET", `/jobs/${jobId}`);
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json).toMatchObject({ status: "done", output: expected });
  });
});

describe("Contrato del verificador — /items (round-trip de persistencia)", () => {
  it("POST /items crea (201 + id), GET /items/{id} devuelve el value y GET /items lo lista", async () => {
    const nonce = `nonce-${Math.random().toString(36).slice(2)}`;

    const created = await invoke("POST", "/items", { value: nonce });
    expect(created.statusCode).toBe(201);
    const id = (created.json as { id?: string }).id;
    expect(typeof id).toBe("string");
    expect(id).toBeTruthy();

    const fetched = await invoke("GET", `/items/${id}`);
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json).toMatchObject({ value: nonce });

    const list = await invoke("GET", "/items");
    expect(list.statusCode).toBe(200);
    const items = (list.json as { items?: Array<{ value: unknown }> }).items;
    expect(Array.isArray(items)).toBe(true);
    expect(items!.some((it) => it.value === nonce)).toBe(true);
  });
});

describe("Contrato del verificador — /health (ejecuta código real, no 503)", () => {
  it("GET /health responde con status 'ok' y team; con DynamoDB alcanzable el global es healthy/200", async () => {
    const res = await invoke("GET", "/health");

    // El código REAL de health se ejecuta: NO debe ser el 503 placeholder
    // "módulo no disponible" que devolvía el router roto.
    expect(res.json).not.toMatchObject({ error: "módulo no disponible" });

    const body = res.json as {
      status?: string;
      team?: string;
      global?: string;
      checks?: Array<{ component: string; status: string }>;
    };
    expect(body.status).toBe("ok");
    expect(body.team).toBeTruthy();
    expect(Array.isArray(body.checks)).toBe(true);

    // DynamoDB mockeado como alcanzable => componente esencial healthy.
    const dynamo = body.checks!.find((c) => c.component === "dynamodb");
    expect(dynamo?.status).toBe("healthy");

    // Con todos los esenciales sanos, el global es healthy/200 (Req. 25.2).
    expect(body.global).toBe("healthy");
    expect(res.statusCode).toBe(200);
  });
});
