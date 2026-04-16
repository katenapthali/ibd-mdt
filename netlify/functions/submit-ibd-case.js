// netlify/functions/submit-ibd-case.js
// No npm dependencies — uses fetch to call Supabase REST API directly

function parseDob(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

function parseTriage(label) {
  if (!label) return null;
  const n = parseInt(label.charAt(0));
  return (n >= 1 && n <= 4) ? n : null;
}

function parseBool(val) {
  if (!val) return null;
  return val.toLowerCase() === 'yes';
}

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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase env vars not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const dobRaw = body.dob || null;

  const record = {
    submitted_at:        new Date().toISOString(),
    submitter_email:     body.submitter_email     || null,
    triage:              parseTriage(body.triage),
    triage_label:        body.triage              || null,
    mdt_reason:          body.mdt_reason          || null,
    mdt_details:         body.mdt_details         || null,
    location:            body.location            || null,
    referral_type:       body.referral_type       || null,
    referring_clinician: body.referring_clinician || null,
    clinician_email:     body.clinician_email     || null,
    patient_name:        body.patient_name        || null,
    dob:                 parseDob(dobRaw),
    dob_raw:             dobRaw,
    gender:              body.gender              || null,
    mrn:                 body.mrn                 || null,
    montreal:            body.montreal            || null,
    phenotype_detail:    body.phenotype_detail    || null,
    comorbidities:       body.comorbidities       || null,
    comorbid_other:      body.comorbid_other      || null,
    bmi:                 body.bmi ? parseFloat(body.bmi) : null,
    ecog:                body.ecog                || null,
    current_tx:          body.current_tx          || null,
    current_tx_notes:    body.current_tx_notes    || null,
    past_tx:             body.past_tx             || null,
    past_tx_notes:       body.past_tx_notes       || null,
    past_biologics:      body.past_biologics      || null,
    biologic_cessation:  body.biologic_cessation  || null,
    surgery:             body.surgery             || null,
    surgery_notes:       body.surgery_notes       || null,
    eim:                 body.eim                 || null,
    eim_notes:           body.eim_notes           || null,
    endo_findings:       body.endo_findings       || null,
    endo_images_review:  parseBool(body.endo_images),
    histology:           body.histology           || null,
    histo_notes:         body.histo_notes         || null,
    ius_done:            parseBool(body.ius_done),
    ius_findings:        body.ius_findings        || null,
    ius_bwt:             body.ius_bwt ? parseFloat(body.ius_bwt) : null,
    ius_notes:           body.ius_notes           || null,
    bloods: {
      date:       body.bloods_date   || null,
      albumin:    body.albumin       || null,
      crp:        body.crp          || null,
      wcc:        body.wcc          || null,
      hb:         body.hb           || null,
      platelets:  body.platelets    || null,
      fcal:       body.fcal         || null,
      alt:        body.alt          || null,
      ast:        body.ast          || null,
      alp:        body.alp          || null,
      ggt:        body.ggt          || null,
      bilirubin:  body.bilirubin    || null,
      urea:       body.urea         || null,
      creatinine: body.creatinine   || null,
      egfr:       body.egfr         || null,
      other:      body.other_bloods || null,
    },
    imaging_modalities:  body.imaging_modalities  || null,
    imaging_provider:    body.imaging_provider    || null,
    imaging_report:      body.imaging_report      || null,
    status:              'submitted',
    ai_analysis:         null,
  };

  // Call Supabase REST API directly — no SDK needed
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ibd_cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(record),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error('Supabase error:', text);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error', detail: text }) };
  }

  const data = JSON.parse(text);
  const id = Array.isArray(data) ? data[0]?.id : data?.id;

  return { statusCode: 200, headers, body: JSON.stringify({ success: true, id }) };
};
