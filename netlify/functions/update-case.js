// netlify/functions/update-case.js
// Updates MDT outcome and status for a case

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { id, mdt_outcome, status, meeting_date, ai_analysis } = body;
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };

  const update = {
    updated_at: new Date().toISOString(),
  };
  if (mdt_outcome !== undefined) update.mdt_outcome = mdt_outcome;
  if (status) update.status = status;
  if (meeting_date) update.mdt_outcome_date = meeting_date;
  if (ai_analysis) { update.ai_analysis = ai_analysis; update.ai_analysed_at = new Date().toISOString(); }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/ibd_cases?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(update),
  });

  if (!res.ok) {
    const text = await res.text();
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Update failed', detail: text }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
