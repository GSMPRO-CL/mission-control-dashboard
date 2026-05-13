import type { AuthUser, AuthProvider } from '../types'

/**
 * Provider: Google Identity-Aware Proxy (IAP)
 * 
 * Este proveedor interactúa con el endpoint interno /api/auth/me, el cual
 * se encarga de decodificar las cabeceras IAP del Load Balancer de Google Cloud.
 */

export const iapProvider: AuthProvider = {
  async getUser(): Promise<AuthUser | null> {
    try {
      // En Server Components esto no funciona directamente con rutas absolutas sin dominio,
      // pero para Client Components sí.
      // Si estamos en entorno servidor, devolver null y dejar que el middleware / API 
      // proteja las rutas. O idealmente usar import { headers } en el server, pero 
      // para simplificar el provider universal usamos fetch client-side.
      const isServer = typeof window === 'undefined';
      
      if (isServer) {
        // En Server Components de Next.js es mejor no hacer fetch a nuestra propia API local
        // sin la URL base completa. Por diseño del dashboard actual, la UI usa getUser() 
        // mayormente desde Client Components (ej. Sidebar).
        return null; 
      }

      const res = await fetch('/api/auth/me');
      if (!res.ok) return null;
      
      const { user } = await res.json();
      return user;
    } catch (e) {
      console.error('Error fetching IAP user:', e);
      return null;
    }
  },

  async signOut(): Promise<void> {
    // IAP no tiene un endpoint de signOut estándar fácil.
    // La sesión depende de la cookie de Google (_gcp_iap_session).
    // Para desloguearse, habría que borrar esa cookie y/o redirigir a una URL especial de IAP,
    // o al login principal de Google. Por ahora, forzamos un refesh para limpiar estado local.
    if (typeof window !== 'undefined') {
      window.location.href = '/_gcp_iap/clear_login_cookie';
    }
  }
}
