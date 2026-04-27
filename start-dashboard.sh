#!/bin/bash
echo "Iniciando Dashboard GSMPRO localmente..."
echo "Abre tu navegador en: http://localhost:3000"

# Moverse al directorio del dashboard y arrancar el servidor
cd "$(dirname "$0")/dashboard"
npm run dev
