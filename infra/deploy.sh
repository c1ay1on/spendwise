#!/bin/bash
set -euo pipefail
cd /home/ubuntu/spendwise

git fetch origin main
git reset --hard origin/main

bash infra/fetch-env.sh

if [ -f backend/db/schema.sql ]; then
  set -a; source backend/.env; set +a
  MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" < backend/db/schema.sql
fi

cd backend
npm ci --omit=dev
cd ..

sudo systemctl restart spendwise-backend
sleep 3
curl -fs http://127.0.0.1:5000/api/health && echo " Deploy OK"
