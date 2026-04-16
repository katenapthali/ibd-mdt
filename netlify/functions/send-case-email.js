// netlify/functions/send-case-email.js
// Sends formatted case summary email via Resend

const FROM_ADDRESS = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
const FROM_NAME = 'IBD MDT — John Hunter Hospital';

function buildEmailHtml(c) {
  const ai = c.ai_analysis || {};
  const da = ai.disease_activity || {};
  const risk = ai.risk || {};

  const activityColour = { Active: '#c0392b', Quiescent: '#0F7B5A', Uncertain: '#a06c00' }[da.overall] || '#575761';
  const riskColour = { High: '#c0392b', Moderate: '#a06c00', Low: '#0F7B5A' }[risk.level] || '#575761';

  const bloods = c.bloods || {};
  const bloodParts = [];
  if (bloods.albumin) bloodParts.push(`Alb ${bloods.albumin} g/L`);
  if (bloods.crp)     bloodParts.push(`CRP ${bloods.crp} mg/L`);
  if (bloods.hb)      bloodParts.push(`Hb ${bloods.hb} g/L`);
  if (bloods.fcal)    bloodParts.push(`FCalp ${bloods.fcal} µg/g`);
  if (bloods.wcc)     bloodParts.push(`WCC ${bloods.wcc}`);
  if (bloods.egfr)    bloodParts.push(`eGFR ${bloods.egfr}`);

  const submittedDate = c.submitted_at
    ? new Date(c.submitted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  function row(label, value) {
    if (!value) return '';
    return `<tr>
      <td style="padding:5px 12px 5px 0;font-size:12px;color:#7A7A9A;font-weight:600;white-space:nowrap;vertical-align:top;width:160px;">${label}</td>
      <td style="padding:5px 0;font-size:12px;color:#2c2c35;font-weight:500;line-height:1.5;">${value}</td>
    </tr>`;
  }

  function section(title, content) {
    return `
    <div style="margin-bottom:20px;">
      <div style="font-size:10px;font-weight:700;color:#648381;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:6px;border-bottom:1.5px solid #d4ead2;margin-bottom:10px;">${title}</div>
      ${content}
    </div>`;
  }

  function tableSection(title, rows) {
    const rowsHtml = rows.filter(Boolean).join('');
    if (!rowsHtml) return '';
    return section(title, `<table style="border-collapse:collapse;width:100%">${rowsHtml}</table>`);
  }

  function badge(text, colour) {
    return `<span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;background:${colour}18;color:${colour};border:1px solid ${colour}40;">${text}</span>`;
  }

  function listItems(arr) {
    if (!arr || !arr.length) return '';
    return '<ul style="margin:6px 0 0 16px;padding:0;">' +
      arr.map(i => `<li style="font-size:12px;color:#2c2c35;padding:2px 0;line-height:1.6;">${i}</li>`).join('') +
      '</ul>';
  }

  // AI sections
  let aiContent = '';
  if (ai.case_summary) {
    aiContent += section('AI Case Summary',
      `<p style="font-size:13px;color:#2c2c35;line-height:1.7;margin:0;">${ai.case_summary}</p>`
    );
  }

  if (da.overall) {
    let daHtml = `<p style="margin:0 0 8px;">${badge(da.overall, activityColour)}</p>`;
    if (da.rationale) daHtml += `<p style="font-size:12px;color:#2c2c35;line-height:1.6;margin:0 0 8px;">${da.rationale}</p>`;
    if (da.red_flags?.length) {
      daHtml += `<div style="background:#fdf0ee;border-left:3px solid #c0392b;border-radius:0 4px 4px 0;padding:8px 12px;margin-top:8px;">`;
      da.red_flags.forEach(f => {
        daHtml += `<div style="font-size:11px;color:#c0392b;font-weight:600;padding:2px 0;">⚑ ${f}</div>`;
      });
      daHtml += '</div>';
    }
    aiContent += section('Disease Activity', daHtml);
  }

  if (risk.level) {
    let riskHtml = `<p style="margin:0 0 8px;">${badge(risk.level + ' risk', riskColour)}`;
    if (risk.steroid_dependent) riskHtml += ` ${badge('Steroid dependent', '#a06c00')}`;
    riskHtml += '</p>';
    if (risk.factors?.length) riskHtml += listItems(risk.factors);
    if (risk.surgical_risk) riskHtml += `<p style="font-size:11px;color:#7A7A9A;margin:8px 0 0;">${risk.surgical_risk}</p>`;
    aiContent += section('Clinical Risk', riskHtml);
  }

  if (ai.biologic_positioning?.rationale || ai.biologic_positioning?.tried?.length) {
    let bioHtml = '';
    if (ai.biologic_positioning.tried?.length) {
      bioHtml += `<p style="font-size:11px;font-weight:700;color:#575761;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">Tried</p>`;
      bioHtml += listItems(ai.biologic_positioning.tried);
    }
    if (ai.biologic_positioning.available?.length) {
      bioHtml += `<p style="font-size:11px;font-weight:700;color:#575761;margin:10px 0 4px;text-transform:uppercase;letter-spacing:0.05em;">Available</p>`;
      bioHtml += listItems(ai.biologic_positioning.available);
    }
    if (ai.biologic_positioning.rationale) {
      bioHtml += `<p style="font-size:12px;color:#2c2c35;line-height:1.6;margin:8px 0 0;">${ai.biologic_positioning.rationale}</p>`;
    }
    aiContent += section('Biologic Positioning', bioHtml);
  }

  if (ai.treatment_options?.length) {
    const priorityColour = { 'First-line':'#0F7B5A','Second-line':'#648381','Consider':'#a06c00','Avoid':'#c0392b' };
    let txHtml = '';
    ai.treatment_options.forEach(t => {
      const pc = priorityColour[t.priority] || '#575761';
      txHtml += `<div style="background:#f8fdf7;border:1px solid #d4ead2;border-radius:6px;padding:10px 12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;">
          <strong style="font-size:13px;color:#2c2c35;">${t.option}</strong>
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:${pc}18;color:${pc};border:1px solid ${pc}40;">${t.priority}</span>
        </div>
        ${t.rationale ? `<p style="font-size:12px;color:#2c2c35;margin:0 0 5px;line-height:1.6;">${t.rationale}</p>` : ''}
        ${t.considerations ? `<p style="font-size:11px;color:#7A7A9A;margin:0;line-height:1.5;">${t.considerations}</p>` : ''}
      </div>`;
    });
    aiContent += section('Treatment Options', txHtml);
  }

  if (ai.mdt_discussion_points?.length) {
    let dHtml = '<ol style="margin:0 0 0 16px;padding:0;">';
    ai.mdt_discussion_points.forEach(p => {
      dHtml += `<li style="font-size:12px;color:#2c2c35;padding:3px 0;line-height:1.6;">${p}</li>`;
    });
    dHtml += '</ol>';
    aiContent += section('MDT Discussion Points', dHtml);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f7f2;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f7f2;padding:32px 16px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#324f4d;border-radius:12px 12px 0 0;padding:24px 28px 20px;">
    <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">IBD Multidisciplinary Team</div>
    <div style="font-size:20px;font-weight:800;color:white;letter-spacing:-0.02em;margin-bottom:3px;">Case Summary</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.6);">John Hunter Hospital · Hunter New England Health</div>
    ${submittedDate ? `<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:8px;">Submitted ${submittedDate}</div>` : ''}
  </td></tr>

  <!-- TRIAGE BANNER -->
  ${c.triage_label ? `<tr><td style="background:${c.triage === 1 ? '#fdecea' : c.triage === 2 ? '#fff8e6' : '#e8f2f1'};padding:10px 28px;border-left:1px solid #d4ead2;border-right:1px solid #d4ead2;">
    <span style="font-size:12px;font-weight:700;color:${c.triage === 1 ? '#b71c1c' : c.triage === 2 ? '#a06c00' : '#4a6260'};">Triage: ${c.triage_label}</span>
  </td></tr>` : ''}

  <!-- BODY -->
  <tr><td style="background:white;padding:24px 28px;border:1px solid #d4ead2;border-top:none;">

    ${tableSection('Patient', [
      row('Name', c.patient_name),
      row('Date of birth', c.dob_raw),
      row('Gender', c.gender),
      row('MRN', c.mrn),
    ])}

    ${tableSection('Referral', [
      row('Referring clinician', c.referring_clinician),
      row('Reason', c.mdt_reason ? c.mdt_reason.replace(/;/g, ', ') : ''),
      c.mdt_details ? row('Details', c.mdt_details) : '',
      row('Setting', c.location),
    ])}

    ${tableSection('IBD Phenotype', [
      row('Montreal', c.montreal),
      c.phenotype_detail ? row('Detail', c.phenotype_detail) : '',
      row('Current treatment', c.current_tx ? c.current_tx.replace(/;/g, ', ') : ''),
      c.past_biologics ? row('Past biologics', c.past_biologics) : '',
      c.surgery && c.surgery !== 'No prior surgery' ? row('Surgery', c.surgery_notes || c.surgery) : '',
      c.eim && c.eim !== 'None' ? row('EIM', c.eim.replace(/;/g, ', ')) : '',
    ])}

    ${bloodParts.length ? section('Blood Tests' + (bloods.date ? ` (${bloods.date})` : ''),
      `<p style="font-size:12px;color:#2c2c35;margin:0;line-height:1.8;">${bloodParts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</p>`
    ) : ''}

    ${c.endo_findings ? section('Endoscopy', `<p style="font-size:12px;color:#2c2c35;margin:0;line-height:1.6;">${c.endo_findings}</p>`) : ''}

    ${c.imaging_report ? section('Imaging', `<p style="font-size:12px;color:#2c2c35;margin:0;line-height:1.6;">${c.imaging_report}</p>`) : ''}

    ${c.mdt_outcome ? section('MDT Outcome',
      `<p style="font-size:13px;color:#2c2c35;line-height:1.7;margin:0;background:#f0faf0;border-left:3px solid #8ACB88;padding:10px 14px;border-radius:0 6px 6px 0;">${c.mdt_outcome}</p>`
    ) : ''}

    <!-- AI ANALYSIS -->
    ${aiContent ? `
    <div style="background:#0f1419;border-radius:8px;padding:16px 18px;margin-top:4px;">
      <div style="font-size:10px;font-weight:700;color:#8ACB88;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;display:flex;align-items:center;gap:6px;">
        <span style="width:6px;height:6px;background:#8ACB88;border-radius:50%;display:inline-block;"></span>
        Claude AI Clinical Analysis
      </div>
      <div style="color:#c9d1d9;">${aiContent.replace(/style="([^"]*color:#2c2c35[^"]*)"/g, 'style="$1color:#c9d1d9"').replace(/style="([^"]*color:#7A7A9A[^"]*)"/g, 'style="$1color:#6a7a8a"').replace(/background:#f8fdf7/g,'background:rgba(255,255,255,0.05)').replace(/border:1px solid #d4ead2/g,'border:1px solid rgba(255,255,255,0.08)').replace(/background:#f2f7f2/g,'background:rgba(255,255,255,0.03)').replace(/border-bottom:1.5px solid #d4ead2/g,'border-bottom:1.5px solid rgba(255,255,255,0.1)').replace(/color:#648381/g,'color:#8ACB88')}</div>
    </div>` : ''}

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#575761;border-radius:0 0 12px 12px;padding:14px 28px;">
    <p style="font-size:11px;color:rgba(255,255,255,0.45);margin:0;line-height:1.7;">
      This summary was generated by the IBD MDT clinical system at John Hunter Hospital, Hunter New England Local Health District.<br>
      For clinical use only. AI-generated content is for MDT preparation and does not replace clinical judgement.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
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

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'RESEND_API_KEY not configured' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { to, case_data } = body;
  if (!to) return { statusCode: 400, headers, body: JSON.stringify({ error: 'to email required' }) };
  if (!case_data) return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_data required' }) };

  const patientName = case_data.patient_name || 'Unknown patient';
  const montreal = case_data.montreal ? ` — ${case_data.montreal}` : '';
  const subject = `IBD MDT Case Summary: ${patientName}${montreal}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: buildEmailHtml(case_data),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Resend error:', text);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Email send failed', detail: text }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
