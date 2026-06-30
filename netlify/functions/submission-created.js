// Triggered automatically by Netlify when invitalux-order form is submitted.
// Saves the order to Airtable with status "Pendiente".
exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { payload } = body;

  if (payload.form_name !== 'invitalux-order') {
    return { statusCode: 200, body: 'Not our form' };
  }

  const d = payload.data;

  const fields = {
    'Pedido ID':          d.orderId        || '',
    'Estado':             'Pendiente',
    'Plan':               d.plan           || '',
    'Evento':             d.eventName      || '',
    'Tipo':               d.eventType      || '',
    'Invitados':          parseInt(d.guestCount) || 0,
    'Tematica':           d.eventTheme     || '',
    'Colores':            d.eventColors    || '',
    'Padrinos':           d.padrinos       || '',
    'Damas':              d.damas          || '',
    'Chambelanes':        d.chambelanes    || '',
    'Dress Code':         d.dressCode      || '',
    'Recomendaciones':    d.recommendations|| '',
    'Hoteles':            d.hotels         || '',
    'Lugar Ceremonia':    d.ceremonyVenue  || '',
    'Direccion Ceremonia':d.ceremonyAddress|| '',
    'Hora Ceremonia':     d.ceremonyTime   || '',
    'Lugar Recepcion':    d.receptionVenue || '',
    'Direccion Recepcion':d.receptionAddress || '',
    'Hora Recepcion':     d.receptionTime  || '',
    'Agenda':             d.agenda         || '',
    'Notas Extra':        d.extraNotes     || '',
    'Nombre Cliente':     d.contactName    || '',
    'Email Cliente':      d.contactEmail   || '',
    'WhatsApp Cliente':   d.contactPhone   || '',
    'Fecha Pedido':       new Date().toISOString().split('T')[0],
  };

  if (d.eventDate) fields['Fecha Evento'] = d.eventDate;

  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Skip if record with this orderId already exists (prevents duplicates on Netlify retries)
  const existing = await fetch(
    `https://api.airtable.com/v0/${base}/${table}?filterByFormula=${encodeURIComponent(`{Pedido ID}="${d.orderId}"`)}`,
    { headers }
  ).then(r => r.json());

  if (existing.records?.length > 0) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
  }

  await fetch(`https://api.airtable.com/v0/${base}/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fields }),
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
