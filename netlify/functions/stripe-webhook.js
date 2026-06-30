const crypto = require('crypto');

function verifyStripeSignature(payload, sig, secret) {
  const parts  = sig.split(',');
  const ts     = parts.find(p => p.startsWith('t=')).slice(2);
  const sigs   = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const expected = crypto.createHmac('sha256', secret)
    .update(`${ts}.${payload}`, 'utf8').digest('hex');
  const age = Math.floor(Date.now() / 1000) - parseInt(ts);
  if (age > 300) throw new Error('Webhook timestamp too old');
  return sigs.some(s => {
    try { return crypto.timingSafeEqual(Buffer.from(s, 'hex'), Buffer.from(expected, 'hex')); }
    catch { return false; }
  });
}

async function airtableFetch(path, options = {}) {
  const res = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}${path}`,
    { ...options, headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json', ...(options.headers || {}) } }
  );
  return res.json();
}

async function findRecord(orderId) {
  const encoded = encodeURIComponent(`{Pedido ID}="${orderId}"`);
  const data = await airtableFetch(`?filterByFormula=${encoded}`);
  return data.records?.[0] || null;
}

async function markPagado(recordId) {
  await airtableFetch(`/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: { Estado: 'Pagado' } }),
  });
}

const WHATSAPP_TEMPLATE_SID = 'HX963cdd2b50c07421b138b4a3f41933dd';

async function sendWhatsApp(variables) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM;
  const to    = process.env.WHATSAPP_TO;
  if (!sid || !token || !from || !to) return;

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
    },
    body: new URLSearchParams({
      From:             `whatsapp:${from}`,
      To:               `whatsapp:+${to.replace(/^\+/, '')}`,
      ContentSid:       WHATSAPP_TEMPLATE_SID,
      ContentVariables: JSON.stringify(variables),
    }).toString(),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  try {
    if (!verifyStripeSignature(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET)) {
      return { statusCode: 400, body: 'Invalid signature' };
    }
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const stripeEvent = JSON.parse(event.body);

  if (stripeEvent.type === 'checkout.session.completed') {
    const session       = stripeEvent.data.object;
    const orderId       = session.client_reference_id;
    const amountPaid    = (session.amount_total / 100).toFixed(2);
    const customerEmail = session.customer_details?.email || '';

    const record = orderId ? await findRecord(orderId) : null;

    if (record) {
      await markPagado(record.id);
      const f = record.fields;
      await sendWhatsApp({
        '1': orderId,
        '2': f['Plan']            || '',
        '3': amountPaid,
        '4': f['Nombre Cliente']  || customerEmail,
        '5': f['WhatsApp Cliente']|| '',
        '6': f['Evento']          || '',
        '7': f['Fecha Evento']    || '',
      });
    } else {
      await sendWhatsApp({
        '1': orderId || 'Sin ID',
        '2': 'Desconocido',
        '3': amountPaid,
        '4': customerEmail,
        '5': '',
        '6': 'No encontrado en Airtable',
        '7': '',
      });
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
