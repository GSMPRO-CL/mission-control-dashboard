#!/bin/bash
echo "Iniciando Dashboard GSMPRO localmente..."
echo "Abre tu navegador en: http://localhost:3000"

# Moverse al directorio raíz y arrancar todos los servicios orquestados
cd "$(dirname "$0")"
npm run dev
