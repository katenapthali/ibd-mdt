// netlify/functions/get-cases.js
// Fetches cases from Supabase, grouped and sorted for the registry

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  // Fetch all cases ordered by triage then submitted_at
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ibd_cases?select=id,submitted_at,triage,triage_label,mdt_reason,mdt_details,patient_name,dob_raw,gender,mrn,montreal,current_tx,past_biologics,referring_clinician,status,meeting_id,mdt_outcome,ai_analysis&order=triage.asc,submitted_at.desc`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  );

  const text = await res.text();
  if (!res.ok) {
    console.error('Supabase fetch error:', text);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error', detail: text }) };
  }

  return { statusCode: 200, headers, body: text };
};
