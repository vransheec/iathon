#!/usr/bin/env bash
#
# Expone la Lambda de la demo a traves de API Gateway (HTTP API) como
# alternativa publica a la Function URL (que la cuenta del workshop bloquea con
# un 403 via SCP para acceso anonimo).
#
# Crea un HTTP API con integracion AWS_PROXY (payload v2.0) a la Lambda, una
# ruta catch-all ANY /{proxy+} y una ruta ANY / , stage $default con
# auto-deploy, y el permiso lambda:InvokeFunction para apigateway.
#
# Imprime la URL publica base y la del frontend (<base>/app).
#
# _Requirements: 20.1, 20.8_
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="${FUNCTION_NAME:-copiloto-docente-rural}"
API_NAME="${API_NAME:-copiloto-docente-rural-api}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

echo "== Cuenta: ${ACCOUNT_ID} · Region: ${REGION} =="

# Reutiliza el API si ya existe (idempotente).
API_ID="$(aws apigatewayv2 get-apis --region "${REGION}" \
  --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text 2>/dev/null)"

if [ "${API_ID}" = "None" ] || [ -z "${API_ID}" ]; then
  echo "== Creando HTTP API ${API_NAME} (quick-create con integracion Lambda) =="
  API_ID="$(aws apigatewayv2 create-api \
    --name "${API_NAME}" \
    --protocol-type HTTP \
    --target "${LAMBDA_ARN}" \
    --region "${REGION}" \
    --query ApiId --output text)"
  # create-api --target crea integracion AWS_PROXY, ruta $default y stage
  # $default con auto-deploy automaticamente.
else
  echo "== HTTP API ${API_NAME} ya existe (${API_ID}) =="
fi

# Permiso para que API Gateway invoque la Lambda.
aws lambda add-permission \
  --function-name "${FUNCTION_NAME}" \
  --statement-id apigw-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
  --region "${REGION}" >/dev/null 2>&1 || true

API_ENDPOINT="$(aws apigatewayv2 get-api --api-id "${API_ID}" --region "${REGION}" \
  --query ApiEndpoint --output text)"

echo ""
echo "========================================================"
echo " API Gateway listo."
echo " Base            : ${API_ENDPOINT}"
echo " Frontend (/app) : ${API_ENDPOINT}/app"
echo " Health          : ${API_ENDPOINT}/health"
echo "========================================================"
