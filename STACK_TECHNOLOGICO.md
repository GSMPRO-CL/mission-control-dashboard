# 🚀 GSMPRO Dashboard - Lineamientos del Stack Tecnológico

Este documento establece las normativas, arquitectura y convenciones técnicas del **Dashboard GSMPRO**. Todos los colaboradores deben apegarse estrictamente a estos principios para garantizar la seguridad, rendimiento y escalabilidad del proyecto a largo plazo.

---

## 🏛 1. Arquitectura Central y Tecnologías

El proyecto opera bajo un ecosistema Serverless nativo en Google Cloud. **No está permitido introducir nuevos frameworks, bases de datos o servicios de terceros** sin aprobación explícita de arquitectura.

*   **Frontend y Backend (BFF):** [Next.js (App Router)](https://nextjs.org/) + TypeScript.
*   **Estilos y UI:** [TailwindCSS](https://tailwindcss.com/) + Shadcn/UI (Lucide Icons).
*   **Base de Datos Principal:** Google Cloud [BigQuery](https://cloud.google.com/bigquery). (Prohibido el uso de PostgreSQL, MySQL, MongoDB, Firebase o Supabase para datos del Dashboard).
*   **Infraestructura y Despliegue:** [Google Cloud Run](https://cloud.google.com/run) mediante contenedores Docker.
*   **Almacenamiento de Código:** GitHub.

---

## 🔐 2. Autenticación y Seguridad (Zero Trust)

Hemos migrado toda la capa de seguridad directamente a la infraestructura de Google. **La introducción de proveedores de Auth de terceros (Supabase, Auth0, Firebase Auth) está estrictamente prohibida.**

1.  **Identity-Aware Proxy (IAP):** Toda la autenticación está delegada a Google Cloud IAP frente al Load Balancer. IAP protege la aplicación antes de que la petición llegue al contenedor.
2.  **Resolución de Sesión:** La identidad del usuario se resuelve extrayendo la cabecera `x-goog-authenticated-user-email` en el endpoint `/api/auth/me`. 
3.  **Roles y Permisos:** 
    *   La asignación de roles se gestiona internamente mediante variables de entorno (`DASHBOARD_ADMIN_EMAILS`).
    *   **Admin:** Control total de preferencias.
    *   **Visualizador (User):** Cualquier usuario que pase IAP pero no sea admin, adquiere rol de solo lectura nativo.
4.  **Manejo de Secretos:** Prohibido el *hardcoding* (quemar contraseñas o tokens en el código fuente). Todos los tokens (Shopify, Crisp, Klaviyo, Google Ads) deben ser inyectados vía variables de entorno (`.env.local` en desarrollo, Secret Manager en producción).

---

## 🧩 3. Principios de Desarrollo "Fullstack"

Las soluciones deben ser estructurales y contemplar todas las capas del ecosistema. 

*   **Cero "Parches" (No Band-Aids):** Si un dato en la UI (Frontend) no se muestra correctamente, se debe auditar la ruta de origen: Consulta en BigQuery -> Respuesta del API Route -> Renderizado en React. **No se deben crear variables simuladas ni ocultar errores por CSS/React.**
*   **Desacoplamiento Absoluto:** Los módulos (Ventas, Inteligencia de Mercado, Tráfico) deben leer de vistas SQL pre-optimizadas en BigQuery, en lugar de procesar lógica pesada de cálculo dentro de Next.js.
*   **Prevención de Inyecciones SQL:** Todas las consultas a BigQuery en el Backend deben utilizar **consultas parametrizadas**. Queda prohibido concatenar *strings* directamente en las sentencias SQL.

---

## 🔄 4. Flujo de Trabajo y Sincronización

*   **APIs y Microservicios:** Cualquier ingesta de datos externa (ej. Shopify, RingCentral, Crisp) debe utilizar Jobs automatizados (Cloud Scheduler + API Routes en Next.js / Python en Cloud Run).
*   **Auditoría y Trazabilidad:** Mantener un registro de los cambios estructurales. Las migraciones y scripts SQL deben almacenarse en la carpeta `scripts/sql/` para control de versiones.
*   **Despliegue Inmutable:** Cada cambio a producción requiere construir una nueva imagen Docker (build) y desplegarla sin afectar el entorno vivo (*Zero-Downtime Deployment*). No se realizan cambios directos en el servidor en caliente.

> [!CAUTION]
> **Lección Aprendida (Caso Supabase):** 
> La introducción de dependencias externas redundantes a la infraestructura de GCP generó conflictos de compilación, deudas técnicas y riesgos de seguridad. Cualquier intento de instalar paquetes como `@supabase/supabase-js`, `firebase` u ORMs pesados (Prisma) será considerado una violación de este stack tecnológico. Todo se maneja vía SDK oficiales de Google Cloud (`@google-cloud/bigquery`, etc.).
