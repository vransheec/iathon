#!/usr/bin/env bash
#
# Despliegue de la DEMO del Copiloto Docente Rural e Híbrido (tareas 11.1 y 11.2).
#
# Crea/actualiza en AWS (region us-east-1, cuenta del workshop, rol
# WSParticipantRole) los recursos minimos de la demo:
#   1. Tabla DynamoDB on-demand (clave pk) para items y jobs.
#   2. Rol IAM de ejecucion de la Lambda (trust: lambda.amazonaws.com) con
#      permisos minimos: logs basicos, acciones DynamoDB sobre la tabla y
#      bedrock:InvokeModel sobre los modelos Claude.
#   3. Funcion Lambda (nodejs20.x, handler index.handler) desde dist/function.zip.
#   4. Function URL publica (--auth-type NONE) con permiso de invocacion publico.
#
# Al final imprime la URL publica del frontend: <FunctionURL>app
#
# Requiere credenciales/permisos de la cuenta del workshop (ya activas via
# WSParticipantRole). Idempotente: si un recurso ya existe, lo actualiza.
#
# _Requirements: 20.1, 20.8, 22.8_
set -euo pipefail

# --- Configuracion (coincide con src/config.ts) ---------------------------
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="${FUNCTION_NAME:-copiloto-docente-rural}"
TABLE_NAME="${TABLE_NAME:-copiloto-rural-demo}"
ROLE_NAME="${ROLE_NAME:-copiloto-docente-rural-exec}"
TEAM_ID="${TEAM_ID:-copiloto-rural}"
# Inference profiles (prefijo "us."): los Claude 4.5 no admiten on-demand con
# el ID directo; el perfil regional es obligatorio para invocarlos.
BEDROCK_MODEL_ID="${BEDROCK_MODEL_ID:-us.anthropic.claude-haiku-4-5-20251001-v1:0}"
BEDROCK_MODEL_ID_QUALITY="${BEDROCK_MODEL_ID_QUALITY:-us.anthropic.claude-sonnet-4-5-20250929-v1:0}"
SERVICE_VERSION="${SERVICE_VERSION:-1.0.0}"
RUNTIME="nodejs20.x"
HANDLER="index.handler"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP_PATH="${ROOT_DIR}/dist/function.zip"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "== Cuenta: ${ACCOUNT_ID} · Region: ${REGION} =="

# --- 1. Tabla DynamoDB on-demand (tarea 11.1) ------------------------------
if aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  echo "== DynamoDB: tabla ${TABLE_NAME} ya existe =="
else
  echo "== DynamoDB: creando tabla ${TABLE_NAME} =="
  aws dynamodb create-table \
    --table-name "${TABLE_NAME}" \
    --attribute-definitions AttributeName=pk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${REGION}" >/dev/null
  echo "   esperando a que la tabla este ACTIVE…"
  aws dynamodb wait table-exists --table-name "${TABLE_NAME}" --region "${REGION}"
fi

# --- 2. Rol IAM de ejecucion (tarea 11.1) ----------------------------------
TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "== IAM: rol ${ROLE_NAME} ya existe =="
else
  echo "== IAM: creando rol ${ROLE_NAME} =="
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document "${TRUST_POLICY}" >/dev/null
  aws iam attach-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null
fi

# Politica inline con permisos minimos: DynamoDB sobre la tabla + Bedrock.
INLINE_POLICY="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"dynamodb:PutItem\", \"dynamodb:GetItem\", \"dynamodb:Query\", \"dynamodb:Scan\", \"dynamodb:UpdateItem\", \"dynamodb:DescribeTable\"],
      \"Resource\": [\"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}\", \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}/index/*\"]
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"bedrock:InvokeModel\"],
      \"Resource\": [\"arn:aws:bedrock:*::foundation-model/anthropic.*\", \"arn:aws:bedrock:*:${ACCOUNT_ID}:inference-profile/*\"]
    }
  ]
}"
aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name copiloto-inline \
  --policy-document "${INLINE_POLICY}" >/dev/null
echo "   politica inline aplicada (DynamoDB + Bedrock)"

# --- 3. Build del bundle ----------------------------------------------------
echo "== Build: empaquetando dist/function.zip =="
( cd "${ROOT_DIR}" && npm run build >/dev/null 2>&1 )
test -f "${ZIP_PATH}" || { echo "ERROR: no se genero ${ZIP_PATH}"; exit 1; }

# --- 4. Lambda: crear o actualizar (tarea 11.2) ----------------------------
ENV_VARS="Variables={TEAM_ID=${TEAM_ID},TABLE_NAME=${TABLE_NAME},BEDROCK_MODEL_ID=${BEDROCK_MODEL_ID},BEDROCK_MODEL_ID_QUALITY=${BEDROCK_MODEL_ID_QUALITY},SERVICE_VERSION=${SERVICE_VERSION}}"

if aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  echo "== Lambda: actualizando codigo de ${FUNCTION_NAME} =="
  aws lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --zip-file "fileb://${ZIP_PATH}" \
    --region "${REGION}" >/dev/null
  aws lambda wait function-updated --function-name "${FUNCTION_NAME}" --region "${REGION}"
  echo "== Lambda: actualizando configuracion (env, timeout) =="
  aws lambda update-function-configuration \
    --function-name "${FUNCTION_NAME}" \
    --environment "${ENV_VARS}" \
    --timeout 30 --memory-size 512 \
    --region "${REGION}" >/dev/null
  aws lambda wait function-updated --function-name "${FUNCTION_NAME}" --region "${REGION}"
else
  echo "== Lambda: creando ${FUNCTION_NAME} =="
  # Reintentos: el rol recien creado puede tardar en propagarse a Lambda.
  for intento in 1 2 3 4 5; do
    if aws lambda create-function \
        --function-name "${FUNCTION_NAME}" \
        --runtime "${RUNTIME}" \
        --handler "${HANDLER}" \
        --role "${ROLE_ARN}" \
        --zip-file "fileb://${ZIP_PATH}" \
        --environment "${ENV_VARS}" \
        --timeout 30 --memory-size 512 \
        --region "${REGION}" >/dev/null 2>/tmp/lambda_err; then
      break
    fi
    echo "   intento ${intento} fallo (propagacion del rol IAM), reintentando en 10s…"
    cat /tmp/lambda_err || true
    sleep 10
  done
  aws lambda wait function-active --function-name "${FUNCTION_NAME}" --region "${REGION}"
fi

# --- 5. Function URL publica (--auth-type NONE) ----------------------------
if aws lambda get-function-url-config --function-name "${FUNCTION_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  echo "== Function URL: ya configurada =="
else
  echo "== Function URL: creando (auth NONE) =="
  aws lambda create-function-url-config \
    --function-name "${FUNCTION_NAME}" \
    --auth-type NONE \
    --region "${REGION}" >/dev/null
fi

# Permiso de invocacion publico para la Function URL.
aws lambda add-permission \
  --function-name "${FUNCTION_NAME}" \
  --statement-id FunctionURLPublic \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region "${REGION}" >/dev/null 2>&1 || true

FUNCTION_URL="$(aws lambda get-function-url-config \
  --function-name "${FUNCTION_NAME}" \
  --region "${REGION}" \
  --query FunctionUrl --output text)"

echo ""
echo "========================================================"
echo " Despliegue completo."
echo " Function URL base : ${FUNCTION_URL}"
echo " Frontend (/app)   : ${FUNCTION_URL}app"
echo " Health            : ${FUNCTION_URL}health"
echo "========================================================"
