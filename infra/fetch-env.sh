#!/bin/bash
set -euo pipefail
REGION=ap-south-1
get() { aws ssm get-parameter --name "$1" --with-decryption --region "$REGION" --query Parameter.Value --output text; }

cat > /home/ubuntu/spendwise/backend/.env <<EOF
DB_HOST=$(get /spendwise/db/host)
DB_NAME=$(get /spendwise/db/name)
DB_USER=$(get /spendwise/db/user)
DB_PASSWORD=$(get /spendwise/db/password)
JWT_SECRET=$(get /spendwise/app/jwt_secret)
S3_BUCKET=spendwise-receipts-clayton-2026
AWS_REGION=$REGION
EOF
chmod 600 /home/ubuntu/spendwise/backend/.env
