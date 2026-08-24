// netlify/functions/soporte-ia.js
//
// Recibe la dificultad reportada por un miembro del equipo y te la envía
// directo por correo vía Formspree, para que la revises y respondas tú
// mismo. Solo responde si el código de acceso del equipo es correcto.
//
// Variables de entorno necesarias (se configuran en Netlify, nunca en el código):
//   TEAM_PASSCODE        -> el código que le das a tu equipo para usar esta página
//   FORMSPREE_ENDPOINT   -> el mismo endpoint de Formspree que ya usas

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Solicitud inválida' }) };
  }

  const { nombre, dificultad, passcode, nivel, tiempoEnEsto } = body;

  if (!passcode || passcode !== process.env.TEAM_PASSCODE) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Código de acceso incorrecto' }) };
  }
  if (!nombre || !dificultad) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos' }) };
  }

  // Enviarte todo por correo vía Formspree, para que lo trates tú directamente.
  try {
    const fsRes = await fetch(process.env.FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        tipo: 'Consulta de equipo',
        nombre,
        nivel: nivel || 'No especificado',
        tiempo_en_el_negocio: tiempoEnEsto || 'No especificado',
        dificultad: dificultad,
        _subject: `Consulta de equipo: ${nombre}`
      })
    });
    if (!fsRes.ok) {
      const fsErrText = await fsRes.text();
      console.error('Formspree respondió con error:', fsRes.status, fsErrText);
      return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo enviar el informe' }) };
    }
  } catch (err) {
    console.error('Fallo al llamar a Formspree:', err.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo enviar el informe' }) };
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
