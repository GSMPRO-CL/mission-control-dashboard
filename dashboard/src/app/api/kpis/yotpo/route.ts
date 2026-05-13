import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      throw new Error('GCP_PROJECT_ID is not configured');
    }
    
    const bigquery = new BigQuery({ projectId });
    
    // Yotpo summary query
    const query = `
      SELECT 
        COUNT(review_id) as total_reviews,
        COUNTIF(status = 'published') as published_reviews,
        COUNTIF(status = 'pending') as pending_reviews,
        AVG(IF(status = 'published', score, NULL)) as average_rating,
        COUNTIF(status = 'published' AND score = 5) as stars_5,
        COUNTIF(status = 'published' AND score = 4) as stars_4,
        COUNTIF(status = 'published' AND score = 3) as stars_3,
        COUNTIF(status = 'published' AND score = 2) as stars_2,
        COUNTIF(status = 'published' AND score = 1) as stars_1
      FROM \`${projectId}.ecommerce_data.raw_yotpo_reviews\`
    `;

    const [rows] = await bigquery.query(query);
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No Yotpo data found' }, { status: 404 });
    }

    const data = rows[0];
    
    // Basic sentiment score approximation based on positive vs negative ratings
    const totalPositives = data.stars_5 + data.stars_4;
    const sentimentScore = data.published_reviews > 0 ? Math.round((totalPositives / data.published_reviews) * 100) : 0;
    
    const yotpoData = {
      averageRating: data.average_rating ? Number(data.average_rating).toFixed(1) : "0.0",
      totalReviews: data.total_reviews || 0,
      publishedReviews: data.published_reviews || 0,
      pendingReviews: data.pending_reviews || 0,
      sentimentScore: sentimentScore,
      ratingDistribution: [
        { name: '5 Estrellas', value: data.stars_5 || 0, color: '#f59e0b' },
        { name: '4 Estrellas', value: data.stars_4 || 0, color: '#fbbf24' },
        { name: '3 Estrellas', value: data.stars_3 || 0, color: '#fcd34d' },
        { name: '2 Estrellas', value: data.stars_2 || 0, color: '#f87171' },
        { name: '1 Estrella', value: data.stars_1 || 0, color: '#ef4444' }
      ]
    };

    return NextResponse.json({ success: true, data: yotpoData });
  } catch (error: any) {
    console.error('API Yotpo Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
