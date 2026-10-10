#!/bin/bash
# Smoke test for the SpendWise API. Usage: ./test-api.sh [base-url]
# Needs: curl, jq. Creates two throwaway users (random emails), so it is safe to run repeatedly.
BASE="${1:-http://127.0.0.1:5000/api}"
JSON='Content-Type: application/json'
PASS=0; FAIL=0
RAND=$RANDOM$RANDOM

check() {  # check "description" expected actual
  if [ "$2" == "$3" ]; then echo "  PASS  $1"; PASS=$((PASS+1)); else echo "  FAIL  $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

echo "== health"
check "GET /health" 200 "$(code $BASE/health)"

echo "== auth"
R=$(curl -s -X POST $BASE/auth/register -H "$JSON" -d "{\"name\":\"User A\",\"email\":\"a$RAND@test.com\",\"password\":\"password123\"}")
TOKEN_A=$(echo "$R" | jq -r .token)
check "register returns a token" true "$([ "$TOKEN_A" != "null" ] && [ -n "$TOKEN_A" ] && echo true || echo false)"
check "duplicate email -> 409" 409 "$(code -X POST $BASE/auth/register -H "$JSON" -d "{\"name\":\"User A\",\"email\":\"a$RAND@test.com\",\"password\":\"password123\"}")"
check "short password -> 400" 400 "$(code -X POST $BASE/auth/register -H "$JSON" -d "{\"name\":\"X\",\"email\":\"x$RAND@test.com\",\"password\":\"short\"}")"
check "wrong password -> 401" 401 "$(code -X POST $BASE/auth/login -H "$JSON" -d "{\"email\":\"a$RAND@test.com\",\"password\":\"wrongpass1\"}")"
check "unknown email -> 401" 401 "$(code -X POST $BASE/auth/login -H "$JSON" -d "{\"email\":\"nobody$RAND@test.com\",\"password\":\"password123\"}")"
check "login ok" 200 "$(code -X POST $BASE/auth/login -H "$JSON" -d "{\"email\":\"a$RAND@test.com\",\"password\":\"password123\"}")"
A="Authorization: Bearer $TOKEN_A"
check "GET /auth/me with token" 200 "$(code $BASE/auth/me -H "$A")"
check "GET /auth/me without token -> 401" 401 "$(code $BASE/auth/me)"
check "bad token -> 401" 401 "$(code $BASE/auth/me -H "Authorization: Bearer abc.def.ghi")"

echo "== categories"
check "8 default categories" 8 "$(curl -s $BASE/categories -H "$A" | jq 'map(select(.is_default)) | length')"
FOOD=$(curl -s $BASE/categories -H "$A" | jq '.[] | select(.name=="Food") | .id')
check "create custom category -> 201" 201 "$(code -X POST $BASE/categories -H "$A" -H "$JSON" -d '{"name":"Pets"}')"
check "duplicate category -> 409" 409 "$(code -X POST $BASE/categories -H "$A" -H "$JSON" -d '{"name":"Pets"}')"

echo "== expenses"
E=$(curl -s -X POST $BASE/expenses -H "$A" -H "$JSON" -d "{\"amount\":250.5,\"category_id\":$FOOD,\"description\":\"Lunch\",\"expense_date\":\"2026-10-04\"}")
EID=$(echo "$E" | jq -r .id)
check "create expense returns id" true "$([ "$EID" != "null" ] && echo true || echo false)"
check "amount is a number" number "$(echo "$E" | jq -r '.amount | type')"
check "has_receipt is boolean false" false "$(echo "$E" | jq -r .has_receipt)"
check "negative amount -> 400" 400 "$(code -X POST $BASE/expenses -H "$A" -H "$JSON" -d "{\"amount\":-5,\"category_id\":$FOOD,\"expense_date\":\"2026-10-04\"}")"
check "invalid date -> 400" 400 "$(code -X POST $BASE/expenses -H "$A" -H "$JSON" -d "{\"amount\":5,\"category_id\":$FOOD,\"expense_date\":\"2026-02-30\"}")"
check "unknown category -> 400" 400 "$(code -X POST $BASE/expenses -H "$A" -H "$JSON" -d '{"amount":5,"category_id":99999,"expense_date":"2026-10-04"}')"
check "bad month filter -> 400" 400 "$(code "$BASE/expenses?month=2026-13" -H "$A")"
check "list for month has 1" 1 "$(curl -s "$BASE/expenses?month=2026-10" -H "$A" | jq length)"
check "list for other month has 0" 0 "$(curl -s "$BASE/expenses?month=2026-09" -H "$A" | jq length)"
check "update expense" 300 "$(curl -s -X PUT $BASE/expenses/$EID -H "$A" -H "$JSON" -d "{\"amount\":300,\"category_id\":$FOOD,\"description\":\"Big lunch\",\"expense_date\":\"2026-10-04\"}" | jq -r .amount)"

echo "== data isolation (second user)"
TOKEN_B=$(curl -s -X POST $BASE/auth/register -H "$JSON" -d "{\"name\":\"User B\",\"email\":\"b$RAND@test.com\",\"password\":\"password123\"}" | jq -r .token)
B="Authorization: Bearer $TOKEN_B"
check "user B sees no expenses" 0 "$(curl -s $BASE/expenses -H "$B" | jq length)"
check "user B cannot edit A's expense -> 404" 404 "$(code -X PUT $BASE/expenses/$EID -H "$B" -H "$JSON" -d "{\"amount\":1,\"category_id\":$FOOD,\"expense_date\":\"2026-10-04\"}")"
check "user B cannot delete A's expense -> 404" 404 "$(code -X DELETE $BASE/expenses/$EID -H "$B")"
check "user B cannot see A's custom category" 0 "$(curl -s $BASE/categories -H "$B" | jq 'map(select(.name=="Pets")) | length')"

echo "== budgets and dashboard"
check "no budget -> amount null" null "$(curl -s "$BASE/budgets?month=2026-10" -H "$A" | jq -r .amount)"
check "budget of 0 -> 400" 400 "$(code -X PUT $BASE/budgets -H "$A" -H "$JSON" -d '{"month":"2026-10","amount":0}')"
check "set budget" 1000 "$(curl -s -X PUT $BASE/budgets -H "$A" -H "$JSON" -d '{"month":"2026-10","amount":1000}' | jq -r .amount)"
check "update budget (upsert)" 2000 "$(curl -s -X PUT $BASE/budgets -H "$A" -H "$JSON" -d '{"month":"2026-10","amount":2000}' | jq -r .amount)"
check "read budget" 2000 "$(curl -s "$BASE/budgets?month=2026-10" -H "$A" | jq -r .amount)"
curl -s -X PUT $BASE/budgets -H "$A" -H "$JSON" -d '{"month":"2026-10","amount":1000}' > /dev/null
S=$(curl -s "$BASE/dashboard/summary?month=2026-10" -H "$A")
check "summary total_spent" 300 "$(echo "$S" | jq -r .total_spent)"
check "summary remaining" 700 "$(echo "$S" | jq -r .remaining)"
check "summary percent_used" 30 "$(echo "$S" | jq -r .percent_used)"
check "summary alert none" none "$(echo "$S" | jq -r .alert)"
check "summary by_category length" 1 "$(echo "$S" | jq '.by_category | length')"
check "summary daily length" 1 "$(echo "$S" | jq '.daily | length')"
curl -s -X POST $BASE/expenses -H "$A" -H "$JSON" -d "{\"amount\":550,\"category_id\":$FOOD,\"expense_date\":\"2026-10-05\"}" > /dev/null
check "alert warning at 85%" warning "$(curl -s "$BASE/dashboard/summary?month=2026-10" -H "$A" | jq -r .alert)"
curl -s -X POST $BASE/expenses -H "$A" -H "$JSON" -d "{\"amount\":300,\"category_id\":$FOOD,\"expense_date\":\"2026-10-06\"}" > /dev/null
check "alert over above 100%" over "$(curl -s "$BASE/dashboard/summary?month=2026-10" -H "$A" | jq -r .alert)"
check "empty month summary: budget null" null "$(curl -s "$BASE/dashboard/summary?month=2026-01" -H "$A" | jq -r .budget)"

echo "== receipts"
printf '\xff\xd8\xff\xe0fakejpegdata' > /tmp/receipt-test.jpg
echo "just text" > /tmp/receipt-test.txt
printf '%%PDF-1.4 fake' > /tmp/receipt-test.pdf
check "no file -> 400" 400 "$(code -X POST $BASE/expenses/$EID/receipt -H "$A")"
check "text file -> 400" 400 "$(code -X POST $BASE/expenses/$EID/receipt -H "$A" -F "receipt=@/tmp/receipt-test.txt;type=text/plain")"
check "fake jpg (wrong bytes) -> 400" 400 "$(code -X POST $BASE/expenses/$EID/receipt -H "$A" -F "receipt=@/tmp/receipt-test.txt;type=image/jpeg")"
check "user B cannot upload to A's expense -> 404" 404 "$(code -X POST $BASE/expenses/$EID/receipt -H "$B" -F "receipt=@/tmp/receipt-test.jpg;type=image/jpeg")"
check "no receipt yet -> 404" 404 "$(code $BASE/expenses/$EID/receipt -H "$A")"
check "upload jpg" true "$(curl -s -X POST $BASE/expenses/$EID/receipt -H "$A" -F "receipt=@/tmp/receipt-test.jpg;type=image/jpeg" | jq -r .has_receipt)"
check "expense now has_receipt" true "$(curl -s "$BASE/expenses?month=2026-10" -H "$A" | jq -r ".[] | select(.id==$EID) | .has_receipt")"
URL=$(curl -s $BASE/expenses/$EID/receipt -H "$A" | jq -r .url)
check "receipt url returned" true "$([ -n "$URL" ] && [ "$URL" != "null" ] && echo true || echo false)"
check "user B cannot get A's receipt -> 404" 404 "$(code $BASE/expenses/$EID/receipt -H "$B")"
check "replace with pdf" true "$(curl -s -X POST $BASE/expenses/$EID/receipt -H "$A" -F "receipt=@/tmp/receipt-test.pdf;type=application/pdf" | jq -r .has_receipt)"

echo "== delete"
check "delete expense -> 204" 204 "$(code -X DELETE $BASE/expenses/$EID -H "$A")"
check "delete again -> 404" 404 "$(code -X DELETE $BASE/expenses/$EID -H "$A")"
check "unknown route -> 404" 404 "$(code $BASE/nope -H "$A")"
check "invalid JSON -> 400" 400 "$(code -X POST $BASE/auth/login -H "$JSON" -d '{bad json')"

echo
echo "Passed: $PASS   Failed: $FAIL"
[ "$FAIL" -eq 0 ]
