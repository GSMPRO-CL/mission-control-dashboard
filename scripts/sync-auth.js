const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno del archivo .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'atomic-box-494614-r5';
const BACKEND_SERVICE = 'dashboard-backend';

console.log('🔄 Iniciando sincronización de políticas IAP...');

// Obtener correos del .env
const rawEmails = [
  ...(process.env.DASHBOARD_ADMIN_EMAILS || '').split(','),
  ...(process.env.DASHBOARD_USER_EMAILS || '').split(',')
];

// Limpiar correos y eliminar duplicados y vacíos
const emails = [...new Set(
  rawEmails.map(e => e.trim().toLowerCase()).filter(e => e.length > 0)
)];

if (emails.length === 0) {
  console.error('❌ No se encontraron correos en DASHBOARD_ADMIN_EMAILS o DASHBOARD_USER_EMAILS.');
  process.exit(1);
}

console.log(`📧 Correos a sincronizar (${emails.length}):`, emails);

// Crear la política JSON
const policy = {
  bindings: [
    {
      role: 'roles/iap.httpsResourceAccessor',
      members: emails.map(email => `user:${email}`)
    }
  ]
};

const policyPath = path.join(__dirname, '..', 'iap-policy-sync.json');

try {
  fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2));
  
  console.log(`🚀 Aplicando nueva política a GCP (Proyecto: ${PROJECT_ID})...`);
  const cmd = `gcloud iap web set-iam-policy --resource-type=backend-services --service=${BACKEND_SERVICE} --project=${PROJECT_ID} ${policyPath}`;
  
  execSync(cmd, { stdio: 'inherit' });
  
  console.log('✅ Sincronización de IAP completada con éxito.');
  console.log('🔓 Los siguientes usuarios ahora tienen acceso validado y activo:');
  emails.forEach(e => console.log(`   - ${e}`));
  
} catch (error) {
  console.error('❌ Error al sincronizar la política IAP:', error.message);
  process.exit(1);
} finally {
  // Limpiar archivo temporal
  if (fs.existsSync(policyPath)) {
    fs.unlinkSync(policyPath);
  }
}
