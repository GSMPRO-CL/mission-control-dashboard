# 🚀 GSMPRO Dashboard - Lineamientos del Stack Tecnológico (Revisión Exhaustiva)

Este documento establece las normativas, arquitectura y convenciones técnicas del **Dashboard GSMPRO**. Todos los colaboradores deben apegarse estrictamente a estos principios para garantizar la seguridad, rendimiento y escalabilidad del proyecto a largo plazo.

---

## 🏛 1. Arquitectura Central y Tecnologías (Core Stack)

El proyecto opera bajo un ecosistema Serverless nativo en Google Cloud. **No está permitido introducir nuevos frameworks, bases de datos o servicios de terceros** sin aprobación explícita de arquitectura.

*   **Frontend y Backend For Frontend (BFF):** [Next.js (App Router)](https://nextjs.org/) (Versión 14/15) + TypeScript.
*   **Estilos y UI:** [TailwindCSS](https://tailwindcss.com/) + componentes Shadcn/UI (Recharts para gráficas, Lucide Icons para iconografía).
*   **Base de Datos Única:** Google Cloud [BigQuery](https://cloud.google.com/bigquery). Toda la data se centraliza aquí. (Prohibido estrictamente el uso de PostgreSQL, MySQL, MongoDB, Firebase o Supabase).
*   **Microservicios de Inteligencia Artificial:** Desarrollados en **Python** (ej. `services/product_intelligence/`), utilizando el SDK moderno de Vertex AI/GenAI y alojados como servicios independientes.
*   **Infraestructura y Despliegue:** [Google Cloud Run](https://cloud.google.com/run) mediante contenedores Docker.
*   **Control de Versiones:** GitHub (obligatorio uso de ramas y PRs para despliegues).

---

## 🔐 2. Autenticación y Seguridad (Zero Trust)

Hemos migrado toda la capa de seguridad directamente a la infraestructura de Google. **La introducción de proveedores de Auth de terceros (Supabase, Auth0, Firebase Auth, JWT personalizados) está prohibida.**

1.  **Identity-Aware Proxy (IAP):** Toda la autenticación está delegada a Google Cloud IAP frente al Load Balancer (`dashboard-neg-central1`). IAP protege la aplicación antes de que la petición llegue al contenedor.
2.  **Resolución de Sesión:** La identidad del usuario se resuelve extrayendo la cabecera `x-goog-authenticated-user-email` (o `x-user-email` en desarrollo) en el endpoint centralizado `/api/auth/me`. 
3.  **Gestión de Roles (RBA):** 
    *   Gestionado mediante variables de entorno (`DASHBOARD_ADMIN_EMAILS` en `.env`).
    *   **Admin:** Configurados en `.env` (ej. dominios `proshoproyal.net`, `tanygrowth.com`, `growth.com`). Tienen control total.
    *   **Visualizador (User):** Cualquier cuenta corporativa validada por IAP pero no explícita en `.env` tiene rol de solo lectura.
4.  **Manejo de Secretos:** Prohibido el *hardcoding*. Los tokens (Shopify, Crisp, Klaviyo, Google Ads, RingCentral, SerpApi) deben inyectarse vía Secret Manager en producción y `.env.local` en desarrollo.

---

## 🧩 3. Flujos de Datos e Integraciones Oficiales

El dashboard ingesta y procesa datos exclusivamente de las siguientes plataformas autorizadas, utilizando sus SDKs o APIs oficiales:

*   **E-Commerce:** Shopify (Priorizando GraphQL API para performance, REST API para *fallbacks*).
*   **Marketing y Tráfico:** Google Ads API, Google Search Console, Meta Ads (vía BigQuery Transfer o API), Klaviyo.
*   **Inteligencia de Mercado:** SerpApi (Scraping de Google Shopping/Search orgánico).
*   **Servicio al Cliente:** Crisp.chat (Mensajería) y RingCentral (Telefonía).

---

## 🏗 4. Principios de Desarrollo "Fullstack" y Orquestación

Las soluciones deben ser estructurales y contemplar todas las capas del ecosistema. 

1.  **Orquestación de Trabajos en Segundo Plano (Cron Jobs):**
    *   Los scripts de sincronización (`scripts/sync-*.js`) y los endpoints de cron (`/api/cron/...`) deben ser programados exclusivamente usando **Google Cloud Scheduler**.
    *   Prohibido usar librerías de *cron* internas de Node.js que bloqueen el *event loop* o generen consumo pasivo.
2.  **Delegación de Transformaciones a BigQuery (Capa SQL):**
    *   Toda lógica pesada de JOIN, limpieza de datos y cálculos de KPI complejos (CTRs, Márgenes, Atribución) debe residir en **vistas (Views) o tablas consolidadas de BigQuery** (`scripts/sql/views/`).
    *   El BFF (Next.js) debe limitarse a hacer `SELECT` simples sobre vistas optimizadas, enviando datos estructurados directamente a React.
3.  **Cero "Parches" React/UI (No Band-Aids):** 
    *   Si un dato no cuadra, el desarrollador **debe auditar la vista de BigQuery o el script de ingesta (Node.js/Python)**. Queda prohibido inventar "datos simulados" o "multiplicadores quemados" en el frontend.
4.  **Prevención de Inyecciones SQL:** 
    *   Todas las llamadas a BigQuery desde el backend (Node.js/Python) deben utilizar **consultas parametrizadas** (`@param`). Prohibida la concatenación directa de variables en cadenas SQL.

---

## 📦 5. Despliegue, CI/CD y Observabilidad

1.  **Pipelines de CI/CD:** Los despliegues a producción deben seguir un proceso estricto de control de versiones y revisión (Pull Request -> Build Docker -> Deploy a Cloud Run). Se desaconsejan despliegues manuales desde entornos locales que salten el registro de GitHub.
2.  **Despliegue Inmutable:** Todo cambio a producción exige un nuevo build del contenedor Docker (`npm run build` -> `docker build` -> `gcloud run deploy`). No se hacen cambios en caliente ni se altera el código en producción directamente.
3.  **Observabilidad y Monitoreo:**
    *   Todo error crítico del backend, fallo de ingesta o error de UI debe registrarse y monitorearse utilizando **Google Cloud Logging** y **Error Reporting**.
    *   Prohibido el uso de herramientas de observabilidad de terceros no integradas al ecosistema Google sin justificación arquitectónica.
4.  **Registro Histórico (Auditoría y Timelines):** Todas las migraciones DDL (`scripts/sql/raw_layer.*.sql`, etc.) y decisiones arquitectónicas deben quedar registradas en el repositorio (`project_timeline.md`).

---

## 💻 6. Estándares de Código y Desarrollo Local

1.  **Manejo de Estados Globales (Frontend):** 
    *   Priorizar `React Context` para estados globales simples (ej. UI, temas, info de usuario básico).
    *   Para estados globales complejos de datos en el dashboard, utilizar **Zustand** por su ligereza. Se prohíbe el uso de Redux debido al exceso de *boilerplate*.
2.  **Entornos de Desarrollo Aislados:** 
    *   El entorno local debe utilizar un archivo `.env.local` configurado con cuentas de prueba (`LOCAL_TEST_USER`) o secretos de staging. Prohibido apuntar el entorno local de desarrollo a los datasets de BigQuery de producción si hay operaciones destructivas.
3.  **Calidad de Código y Linters:**
    *   Es imperativo que el código pase el build local (`npm run build`) y la validación estricta de TypeScript (`tsc --noEmit`) antes de cualquier subida a producción.
4.  **Revisión Estructural (Cero "Cajas Negras"):**
    *   Cualquier código o fragmento autogenerado por agentes de IA debe ser inspeccionado. El código debe ser comprensible y mantenible por el equipo humano.

> [!CAUTION]
> **Lección Aprendida (Deuda Técnica por Supabase):** 
> La introducción de dependencias externas redundantes a GCP (ej. dependencias de Supabase sin uso real de sus características BaaS) generó severos conflictos de caché Webpack (`@supabase/ssr`), bloqueó compilaciones y complicó la delegación de roles. Queda **terminantemente prohibido** instalar paquetes de "Backend as a Service" comerciales (Supabase, Firebase, Auth0, Prisma ORM). Somos un ecosistema 100% nativo de Google Cloud Platform / BigQuery / Cloud Run.
