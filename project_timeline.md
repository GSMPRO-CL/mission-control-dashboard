# Timeline Histórico de Acciones - Dashboard GSMPRO

Este documento es una bitácora inmutable de todas las acciones significativas, configuraciones, refactorizaciones y comandos ejecutados durante el desarrollo del Dashboard GSMPRO.

---

### [2026-05-11] - Estandarización Tecnológica y Migración a IAP

*   **QUÉ:** Revisión exhaustiva y actualización del documento `STACK_TECHNOLOGICO.md`.
*   **POR QUÉ:** Para establecer normativas estrictas de arquitectura, seguridad (Zero Trust con IAP), y principios de desarrollo Fullstack (uso exclusivo de BigQuery y orquestación con Cloud Scheduler), prohibiendo el uso de "Backend as a Service" (Supabase/Firebase) que generen deuda técnica y conflictos de dependencias.
*   **QUÉ:** Migración Estructural de Supabase a IAP.
*   **POR QUÉ:** Para acoplarse a la arquitectura nativa de Google Cloud, eliminando las librerías de `@supabase/supabase-js` y `@supabase/ssr` que generaban conflictos en la caché de compilación.
*   **QUÉ:** Refactorización de Capa de Autenticación (`Auth Factory`).
*   **POR QUÉ:** Se implementó `src/lib/auth/providers/iap.ts` para decodificar las cabeceras inyectadas por el Load Balancer de Google IAP, y se eliminó el código legacy de Supabase, incluyendo las rutas estáticas `/login`, `/signup`, `/pending`, `/admin` y `/settings`.
*   **QUÉ:** Creación de API Route `/api/auth/me`.
*   **POR QUÉ:** Para centralizar la resolución de la identidad del usuario y manejar de forma segura las cabeceras asíncronas de Google IAP (ej. `x-goog-authenticated-user-email`).
*   **QUÉ:** Actualización de `Sidebar.tsx` y `LayoutShell.tsx`.
*   **POR QUÉ:** Para remover enlaces obsoletos y solucionar la lógica de `signOut` evitando redirecciones erróneas a páginas eliminadas.
*   **QUÉ:** Configuración de Roles Internos.
*   **POR QUÉ:** Se definió el acceso mediante variables de entorno en `.env` (ej. `DASHBOARD_ADMIN_EMAILS`) incluyendo los correos `j.calderon@proshoproyal.net`, `sales@proshoproyal.net`, `sva.comercial12@proshoproyal.net`, y `dariel@tanygrowth.com`, así como los dominios `proshoproyal.net`, `tanygrowth.com`, `growth.com`.
