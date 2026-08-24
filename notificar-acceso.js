// netlify/functions/notificar-acceso.js
//
// Se dispara justo cuando alguien confirma su horario en Calendly (después
// de pasar el cuestionario). Le envía un correo de bienvenida con el acceso
// a la página de ayuda (soporte-equipo.html), que tú le explicarás en la llamada.
//
// Variables de entorno necesarias:
//   RESEND_API_KEY   -> tu clave de resend.com (tiene plan gratis)
//   SITE_URL          -> la URL donde publicaste el sitio, ej: https://tusitio.netlify.app
//   FROM_EMAIL        -> el correo remitente (al inicio puedes usar onboarding@resend.dev
//                        mientras verificas tu propio dominio en Resend)

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Solicitud inválida' }), { status: 400 });
  }

  const { nombre, email } = body;
  if (!email) {
    return new Response(JSON.stringify({ error: 'Falta el correo' }), { status: 400 });
  }

  const enlaceAyuda = `${process.env.SITE_URL}/soporte-equipo.html`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: '¡Nos vemos en la llamada! Aquí tienes tu acceso',
        html: `
          <div style="font-family:sans-serif; max-width:480px; margin:0 auto; padding:24px; background:#000000; color:#faf3e0;">
            <p style="color:#d4a017; font-size:12px; letter-spacing:2px; text-transform:uppercase;">Beauty Influencer System</p>
            <h2 style="color:#faf3e0;">¡Listo, ${nombre || ''}!</h2>
            <p>Tu llamada ya quedó agendada. Antes de que hablemos, quiero dejarte esto a mano:</p>
            <p style="margin:24px 0;">
              <a href="${enlaceAyuda}" style="background:#d4a017; color:#1a1408; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">Tu acceso aquí</a>
            </p>
            <p>Te explico cómo usarlo en la llamada. Nos vemos pronto.</p>
          </div>
        `
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: 'No se pudo enviar el correo', detail: errText }), { status: 500 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'No se pudo enviar el correo' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};
