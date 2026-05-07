import { NextResponse } from 'next/server';
import { getExtensions, getExtensionCallLog } from '@/lib/ringcentral';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') ?? new Date(new Date().setDate(1)).toISOString();
    const dateTo   = searchParams.get('dateTo')   ?? new Date().toISOString();

    // 1. Obtener todas las extensiones activas
    const extensionsRes = await getExtensions();
    const extensions    = (extensionsRes.records ?? []) as any[];

    // 2. Obtener call log de cada extensión en paralelo
    const callLogResults = await Promise.allSettled(
      extensions.map(ext => getExtensionCallLog(String(ext.id), dateFrom, dateTo))
    );

    // 3. Consolidar todos los registros
    const allCalls: any[] = [];
    for (let i = 0; i < callLogResults.length; i++) {
      const result = callLogResults[i];
      if (result.status === 'fulfilled') {
        const records = result.value.records ?? [];
        // Enriquecer cada registro con el nombre de la extensión
        records.forEach((call: any) => {
          allCalls.push({ ...call, _extensionName: extensions[i].name, _extensionId: extensions[i].id });
        });
      }
    }

    // Deduplicar por sessionId (una llamada puede aparecer en múltiples extensiones si hubo transferencia)
    const seen = new Set<string>();
    const calls = allCalls.filter(c => {
      if (seen.has(c.sessionId)) return false;
      seen.add(c.sessionId);
      return true;
    });

    // ── KPIs Globales ─────────────────────────────────────────────────────────
    const totalCalls    = calls.length;
    const inbound       = calls.filter(c => c.direction === 'Inbound');
    const outbound      = calls.filter(c => c.direction === 'Outbound');
    const answered      = calls.filter(c => c.result === 'Call connected');
    const missed        = calls.filter(c => c.result === 'Missed');
    const answerRate    = totalCalls > 0 ? Math.round((answered.length / totalCalls) * 100) : 0;

    const avgDurationSec = answered.length > 0
      ? answered.reduce((s: number, c: any) => s + (c.duration ?? 0), 0) / answered.length
      : 0;
    const avgDurationMin = Math.round(avgDurationSec / 60 * 10) / 10;

    // ── Rendimiento por agente ─────────────────────────────────────────────────
    const agentMap = new Map<string, {
      name: string; total: number; answered: number; missed: number; totalDuration: number;
    }>();

    for (const call of calls) {
      // El agente responsable es quien originó o recibió la llamada en la extensión
      const extId   = call._extensionId ? String(call._extensionId) : 'unknown';
      const extName = call._extensionName ?? 'Sin asignar';
      if (!agentMap.has(extId)) {
        agentMap.set(extId, { name: extName, total: 0, answered: 0, missed: 0, totalDuration: 0 });
      }
      const a = agentMap.get(extId)!;
      a.total++;
      if (call.result === 'Call connected') { a.answered++; a.totalDuration += call.duration ?? 0; }
      if (call.result === 'Missed') a.missed++;
    }

    const agentStats = Array.from(agentMap.values())
      .map(a => ({
        name:        a.name,
        total:       a.total,
        answered:    a.answered,
        missed:      a.missed,
        answerRate:  a.total > 0 ? Math.round((a.answered / a.total) * 100) : 0,
        avgDuration: a.answered > 0 ? Math.round(a.totalDuration / a.answered / 60 * 10) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── Distribución por hora ─────────────────────────────────────────────────
    const byHour = Array.from({ length: 24 }, (_, h) => ({
      hour:  `${String(h).padStart(2, '0')}:00`,
      calls: calls.filter(c => new Date(c.startTime).getHours() === h).length,
    }));

    // ── Tendencia diaria ──────────────────────────────────────────────────────
    const dayMap = new Map<string, { date: string; total: number; answered: number; missed: number }>();
    for (const call of calls) {
      const d = call.startTime?.split('T')[0] ?? '';
      if (!d) continue;
      if (!dayMap.has(d)) dayMap.set(d, { date: d, total: 0, answered: 0, missed: 0 });
      const r = dayMap.get(d)!;
      r.total++;
      if (call.result === 'Call connected') r.answered++;
      if (call.result === 'Missed') r.missed++;
    }
    const dailyTrend = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalCalls,
          inboundCalls:  inbound.length,
          outboundCalls: outbound.length,
          answeredCalls: answered.length,
          missedCalls:   missed.length,
          answerRate,
          avgDurationMin,
        },
        agentStats,
        byHour,
        dailyTrend,
      },
    });
  } catch (error: any) {
    const isConfig = error.message?.includes('not configured');
    return NextResponse.json(
      { success: false, error: error.message, unconfigured: isConfig },
      { status: isConfig ? 503 : 500 }
    );
  }
}
