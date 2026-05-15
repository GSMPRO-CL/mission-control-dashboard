import { NextResponse } from 'next/server';
import { exec }         from 'child_process';
import { promisify }    from 'util';
import path             from 'path';

const execAsync = promisify(exec);

/**
 * POST /api/cron/sync-crisp
 *
 * Endpoint protegido por CRON_SECRET_TOKEN para ser invocado
 * por Cloud Scheduler (o manualmente desde el dashboard).
 *
 * Ejecuta en secuencia:
 *   1. sync-crisp-incremental.js          → conversaciones nuevas/actualizadas
 *   2. sync-crisp-messages-incremental.js → mensajes nuevos + NLP pendiente
 *
 * Headers requeridos:
 *   x-cron-token: <CRON_SECRET_TOKEN>
 */
export async function POST(request: Request) {
  // ── Autenticación ─────────────────────────────────────────────────────────
  const token = request.headers.get('x-cron-token');
  if (!token || token !== process.env.CRON_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scriptsDir = path.resolve(process.cwd(), '..', 'scripts');
  const results: Record<string, string> = {};
  const startTime = Date.now();

  // ── Paso 1: Sync conversaciones ───────────────────────────────────────────
  try {
    const { stdout, stderr } = await execAsync(
      `node sync-crisp-v2.js`,
      { cwd: scriptsDir, timeout: 5 * 60 * 1000 } // 5 min max
    );
    results.conversations = stdout || stderr || 'OK';
  } catch (err: any) {
    results.conversations = `ERROR: ${err.message}`;
    // No abortamos — intentamos también los mensajes
  }

  // ── Paso 2: Sync mensajes + NLP ───────────────────────────────────────────
  try {
    const { stdout, stderr } = await execAsync(
      `node sync-crisp-messages-incremental.js`,
      { cwd: scriptsDir, timeout: 10 * 60 * 1000 } // 10 min max
    );
    results.messages = stdout || stderr || 'OK';
  } catch (err: any) {
    results.messages = `ERROR: ${err.message}`;
  }

  const elapsedMs = Date.now() - startTime;
  const hasErrors = Object.values(results).some(v => v.startsWith('ERROR'));

  return NextResponse.json({
    success:   !hasErrors,
    elapsedMs,
    timestamp: new Date().toISOString(),
    results,
  }, { status: hasErrors ? 207 : 200 });
}

// GET para health-check del scheduler
export async function GET(request: Request) {
  const token = request.headers.get('x-cron-token');
  if (!token || token !== process.env.CRON_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
