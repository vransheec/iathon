---
inclusion: always
---

# Convenciones del Copiloto Docente Rural e Híbrido

El **Copiloto Docente Rural e Híbrido** es un sistema EdTech *cloud-first* que empodera a docentes de escuelas públicas en zonas rurales del Perú, alineado al Currículo Nacional del MINEDU e incorporando interculturalidad bilingüe para lenguas originarias.

## Arquitectura de la demo

- **Backend:** una única AWS Lambda (Node.js/TypeScript) con **Lambda Function URL** que enruta el contrato del hackathon (`/health`, `/items`, `/jobs`, `/app`) y las rutas de GenAI (`/genai/sesion`, `/chat`). Sin API Gateway, sin servidores siempre encendidos.
- **Persistencia:** Amazon DynamoDB on-demand con clave de partición `pk`. Items usan `pk = "ITEM#<id>"`; jobs usan `pk = "JOB#<jobId>"`.
- **IA generativa:** Amazon Bedrock. Claude Haiku para el chat pedagógico (rápido/barato) y Claude Sonnet para la generación de sesiones (calidad).

## Convenciones de código

- TypeScript estricto y AWS SDK v3.
- Los handlers tienen la firma `(req: RouteRequest) => Promise<HttpResponse>`.
- Las respuestas se construyen con los helpers de `src/lib/http.ts` (JSON + CORS).
- Códigos HTTP del contrato: 200/201 en items, 202 en jobs, 200/207/503 en health.

## GenAI con propósito

La generación de Sesiones de Aprendizaje usa un **prompt diseñado MINEDU**, valida la respuesta contra el esquema de `Sesion_Aprendizaje`, reintenta una vez y hace **fallback a una plantilla local** si Bedrock falla. El chat pedagógico degrada con un aviso cuando el modelo no responde.

## Variables de entorno

`TEAM_ID`, `TABLE_NAME`, `BEDROCK_MODEL_ID`, `BEDROCK_MODEL_ID_QUALITY`, `AWS_REGION`, `SERVICE_VERSION`.

## Principios

Tolerancia a microcortes del enlace satelital con reintento transparente, bajo costo (serverless, pago por uso), cifrado en reposo y en tránsito, y cumplimiento de la Ley N.° 29733 de Protección de Datos Personales del Perú.
