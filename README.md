# Dashboard GSMPRO.CL

## Arquitectura y Despliegue en Cloud Run

El Dashboard opera sobre una arquitectura de **microservicios sin servidor** (Serverless) alojada en Google Cloud Run. Está compuesta por:
1. **Frontend / Core Backend (Next.js):** Maneja la UI y las rutas API en `us-east1` (`dashboard-gsmpro-ui`).
2. **Microservicio de IA (Python/FastAPI):** Procesa agentes de Vertex AI para inteligencia de mercado. Corre de forma privada e independiente.

### Autenticación y Seguridad
El microservicio de Python tiene **acceso público bloqueado (No allUsers)**. Para que Next.js se comunique con él, utiliza `google-auth-library` generando un "Identity Token" firmado por su cuenta de servicio en tiempo de ejecución. 

### Política de Variables de Entorno (`env.yaml`)
Para asegurar la inmutabilidad de los despliegues, las credenciales críticas **NUNCA** deben inyectarse directamente en consola con flags como `--set-env-vars`. En su lugar, todas las variables maestras residen en `env.yaml`. 
El despliegue oficial hacia producción siempre se realiza con:
```bash
gcloud run deploy dashboard-gsmpro-ui \
  --source . \
  --region us-east1 \
  --env-vars-file ../env.yaml \
  --project atomic-box-494614-r5
```

## Módulo de atribución — Setup

Para configurar la base de datos necesaria para el módulo de atribución de actividad, sigue estos pasos:

1. Asegúrate de tener configurado tu archivo `.env` en la raíz del proyecto con el `GCP_PROJECT_ID` y las credenciales de Service Account habilitadas.
2. Ejecuta el script de aplicación de DDL, el cual es idempotente:

```bash
node scripts/apply-attribution-ddl.js
```

Esto se encargará de crear los datasets `raw_layer` y `marts_layer` (en la región US) si no existen, y creará/actualizará las siguientes 4 tablas con sus particiones y clusters correspondientes:
- `raw_layer.shopify_staff`
- `raw_layer.shopify_audit_log`
- `raw_layer.shopify_snapshots`
- `marts_layer.activity_log`

Al finalizar, el script verificará e imprimirá en consola las estructuras creadas usando el `INFORMATION_SCHEMA` de BigQuery.

## Audit Log Puller

El Audit Log Puller es el motor de ingesta que extrae la actividad humana de Shopify y la deposita en BigQuery (`raw_layer.shopify_audit_log`). 

### Comandos Disponibles

- `node scripts/sync-audit-log.js`: **Modo Incremental** (Uso normal). Retoma desde el último checkpoint registrado en `audit_log_sync_state`.
- `node scripts/sync-audit-log.js --backfill=7d`: Extrae eventos de los últimos N días, ignorando el checkpoint. Ideal para inicializar la tabla.
- `node scripts/sync-audit-log.js --since=2024-01-01T00:00:00Z`: Extrae eventos desde una fecha y hora específica.
- `node scripts/sync-audit-log.js --dry-run`: Prueba de escritorio. No escribe en la base de datos, solo muestra en consola cuántos eventos y atribuciones lograría.

### Backfill Inicial

Para inicializar la base de datos por primera vez con datos históricos:
```bash
node scripts/sync-audit-log.js --backfill=7d
```

### Monitoreo del Checkpoint

El script mantiene su estado en la tabla `raw_layer.audit_log_sync_state`. Puedes consultar el estado de la sincronización con:
```sql
SELECT last_processed_at, events_processed, last_run_status, last_run_error 
FROM `raw_layer.audit_log_sync_state`
```

### Resolución de staff_ids "unknown"

Si en la vista `raw_layer.v_audit_log_enriched` encuentras registros con `employee_code = 'unknown'`, significa que Shopify reportó actividad de un `staff_id` que no está registrado en tu tabla `shopify_staff`. 
**Solución**: Agrega ese `staff_id` a tu archivo CSV de identidades y vuelve a ejecutar `node scripts/seed-staff-from-csv.js`.

### Cambio de Frecuencia

La frecuencia de ejecución recomendada es cada 6 horas para no agotar la cuota de la API de Shopify. Cuando configures Cloud Scheduler (Tarea K), puedes ajustar el trigger cronológico (ej. `0 */6 * * *` para cada 6 horas).
