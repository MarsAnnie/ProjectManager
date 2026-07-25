#!/bin/bash
set -e

echo "Waiting for MySQL..."
while ! mysqladmin ping -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASSWORD}" --silent; do
    sleep 2
done

echo "MySQL is ready. Starting FastAPI..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000
