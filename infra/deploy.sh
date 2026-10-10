#!/bin/bash
set -euo pipefail
cd /home/ubuntu/spendwise

git fetch origin main
git reset --hard origin/main

bash infra/fetch-env.sh

if [ -f backend/db/schema.sql ]; then
 envval() { grep -m1 "^$1=" backend/.env | cut -d= -f2-; }
 MYSQL_PWD="$(envval DB_PASSWORD)" mysql -h "$(envval DB_HOST)" -u "$(envval DB_USER)" "$(envval DB_NAME)" < backend/db/schema.sql
fi

cd backend
npm ci --omit=dev
cd ..

sudo systemctl restart spendwise-backend
sleep 3
curl -fs http://127.0.0.1:5000/api/health && echo " Deploy OK"
