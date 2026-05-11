import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        // Aplica a todas las rutas
        source: '/(.*)',
        headers: [
          {
            // Previene que extensiones de navegador (BIS, Bitdefender, etc.)
            // modifiquen el MIME type del contenido antes de que React hidrate
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Bloquea que la app sea embebida en iframes externos (seguridad)
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },

};

export default nextConfig;
