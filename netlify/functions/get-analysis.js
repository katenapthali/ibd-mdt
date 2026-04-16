// netlify/functions/get-analysis.js
// Polls Supabase for the AI analysis result

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Not configured' }) };

  const id = event.queryStringParameters?.id;
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ibd_cases?id=eq.${id}&select=ai_analysis,status`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );

  const text = await res.text();
  if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'DB error' }) };

  const rows = JSON.parse(text);
  const row = rows[0];
  if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Case not found' }) };

  return { statusCode: 200, headers, body: JSON.stringify({ 
    ready: row.status === 'analysed' && row.ai_analysis !== null,
    analysis: row.ai_analysis,
    status: row.status
  })};
};
