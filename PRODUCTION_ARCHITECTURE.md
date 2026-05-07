# PRODUCCIÓN — Arquitectura de Despliegue

## ⚠️ CRÍTICO — Leer antes de cualquier despliegue

La app **SIEMPRE** debe desplegarse al servicio `dashboard-gsmpro-ui` en `us-east1`.
**NO** desplegar a `dashboard-gsmpro` (us-central1) — ese servicio no es el backend del dominio.

## Arquitectura Completa

```
dashboard.gsmpro.com
    └── Load Balancer (IP pública: 34.54.140.5)
         └── Backend Service: dashboard-backend
              └── NEG (Serverless): dashboard-neg
                   └── Cloud Run: dashboard-gsmpro-ui (us-east1)  ← BACKEND REAL
                        └── IAP (Identity-Aware Proxy)
```

## Comando de Despliegue Correcto

```bash
cd /home/prllc/Escritorio/DashboardGSMPRO

gcloud run deploy dashboard-gsmpro-ui \
  --source ./dashboard \
  --region us-east1 \
  --env-vars-file env.yaml \
  --project atomic-box-494614-r5 \
  --quiet
```

## Servicios Cloud Run en el Proyecto

| Servicio | Región | Rol | Dominio |
|---|---|---|---|
| `dashboard-gsmpro-ui` | us-east1 | **Backend principal** | `dashboard.gsmpro.com` vía LB+IAP |
| `dashboard-gsmpro` | us-central1 | Servicio secundario/legado | Sin dominio directo |
| `gsmpro-product-intelligence` | us-central1 | Agente de lanzamientos | Interno |

## Rollback de Emergencia

```bash
# Listar revisiones disponibles
gcloud run revisions list --service=dashboard-gsmpro-ui --region=us-east1 --project=atomic-box-494614-r5

# Hacer rollback a una revisión anterior
gcloud run services update-traffic dashboard-gsmpro-ui \
  --to-revisions=<REVISION_NAME>=100 \
  --region us-east1 \
  --project atomic-box-494614-r5
```

## Verificación Post-Deploy

```bash
# Debe retornar HTTP/2 302 → redirección a Google OAuth (IAP funcionando)
curl -sI https://dashboard.gsmpro.com | head -3
```
