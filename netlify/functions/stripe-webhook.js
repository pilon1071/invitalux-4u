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

async function sendWhatsApp(message) {
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
      From: `whatsapp:${from}`,
      To:   `whatsapp:+${to}`,
      Body: message,
    }).toString(),
  });
}

function buildMessage(f, orderId, amountPaid, customerEmail) {
  const line = (label, val) => val ? `${label}: ${val}\n` : '';
  let msg = `✅ *PAGO CONFIRMADO*\n`;
  msg += `📋 Pedido: ${orderId}\n`;
  msg += `💰 ${f['Plan']} — $${amountPaid} USD\n\n`;

  msg += `*EVENTO*\n`;
  msg += line('📌 Evento', f['Evento']);
  msg += line('Tipo', f['Tipo']);
  msg += line('📅 Fecha', f['Fecha Evento']);
  msg += line('👥 Invitados', f['Invitados']);
  msg += line('🎨 Temática', f['Tematica']);
  msg += line('🌈 Colores', f['Colores']);

  if (f['Lugar Recepcion']) {
    msg += `\n*RECEPCIÓN*\n`;
    msg += line('📍', f['Lugar Recepcion']);
    msg += line('Dirección', f['Direccion Recepcion']);
    msg += line('Hora', f['Hora Recepcion']);
  }
  if (f['Lugar Ceremonia']) {
    msg += `\n*CEREMONIA*\n`;
    msg += line('⛪', f['Lugar Ceremonia']);
    msg += line('Dirección', f['Direccion Ceremonia']);
    msg += line('Hora', f['Hora Ceremonia']);
  }
  if (f['Agenda'])       msg += `\n*AGENDA*\n${f['Agenda']}\n`;
  if (f['Padrinos'])     msg += `\n*PADRINOS*\n${f['Padrinos']}\n`;
  if (f['Damas'])        msg += `\nDamas: ${f['Damas']}\n`;
  if (f['Chambelanes'])  msg += `Chambelanes: ${f['Chambelanes']}\n`;
  if (f['Dress Code'])   msg += `\nDress Code: ${f['Dress Code']}\n`;
  if (f['Recomendaciones']) msg += `\n*RECOMENDACIONES*\n${f['Recomendaciones']}\n`;
  if (f['Hoteles'])      msg += `\n*HOTELES*\n${f['Hoteles']}\n`;
  if (f['Notas Extra'])  msg += `\n*NOTAS*\n${f['Notas Extra']}\n`;

  msg += `\n*CLIENTE*\n`;
  msg += line('👤', f['Nombre Cliente']);
  msg += line('📧', f['Email Cliente'] || customerEmail);
  msg += line('📱 WhatsApp', f['WhatsApp Cliente']);

  return msg;
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
      const msg = buildMessage(record.fields, orderId, amountPaid, customerEmail);
      await sendWhatsApp(msg);
    } else {
      const msg = `✅ *PAGO CONFIRMADO*\n📋 ${orderId || 'Sin ID'}\n💰 $${amountPaid} USD\n📧 ${customerEmail}\n\n⚠️ Pedido no encontrado en Airtable. Revisa Netlify Forms.`;
      await sendWhatsApp(msg);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
