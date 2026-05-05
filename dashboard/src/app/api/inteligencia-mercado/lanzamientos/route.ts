import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // URL del servicio Python (FastAPI). Por ahora en localhost, luego de despliegue se usa una env variable
    const pythonServiceUrl = process.env.PYTHON_AI_SERVICE_URL || 'http://127.0.0.1:8000/api/v1/releases';
    
    console.log(`Llamando al servicio Python en: ${pythonServiceUrl}`);
    const response = await fetch(pythonServiceUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // cache: 'no-store' // Para evitar que Next.js cachee si queremos resultados frescos siempre
    });

    if (!response.ok) {
      console.error("Error desde el servicio Python", await response.text());
      return NextResponse.json(
        { error: 'Error comunicándose con el servicio de Inteligencia.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in AI releases proxy:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor proxy.' },
      { status: 500 }
    );
  }
}
