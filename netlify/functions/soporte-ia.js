// netlify/functions/soporte-ia.js
//
// Recibe la dificultad reportada por un miembro del equipo, genera un
// informe con IA real (Claude) y te lo envía automáticamente por correo
// vía Formspree. Solo responde si el código de acceso del equipo es correcto.
//
// Variables de entorno necesarias (se configuran en Netlify, nunca en el código):
//   ANTHROPIC_API_KEY   -> tu clave de console.anthropic.com
//   TEAM_PASSCODE        -> el código que le das a tu equipo para usar esta página
//   FORMSPREE_ENDPOINT   -> el mismo endpoint de Formspree que ya usas (o uno nuevo)

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

  // 1) Generar el informe con Claude
  let informe = 'No se pudo generar el informe automático — revisa el mensaje original abajo.';
  try {
    const https = require('https');
    const payload = JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1600,
      thinking: { type: 'disabled' },
      system: `Eres un estratega experto en construcción de negocios de venta directa y marketing de influencia (específicamente Beauty Influencers de Farmasi), ayudando a un líder de equipo a preparar la mejor respuesta posible para alguien de su equipo que reportó una dificultad.

Tu informe debe ser profundo, específico y accionable — nunca genérico ni motivacional vacío. Ajusta la profundidad y el tipo de estrategia al nivel real de la persona (alguien recién empezando necesita fundamentos; alguien que ya genera ingresos necesita optimización y escala). Usa exactamente esta estructura, en español:

## DIAGNÓSTICO
Analiza qué está pasando realmente, no solo lo superficial. Distingue el síntoma (lo que la persona reporta) de la causa raíz probable (por qué está pasando esto). Sé específico sobre el contexto de su nivel y tiempo en el negocio.

## CAUSA RAÍZ
2-4 frases identificando la causa de fondo — no la queja en sí, sino lo que la está generando (falta de sistema, falta de habilidad específica, bloqueo mental, falta de estructura, expectativas desalineadas, etc).

## PLAN DE ACCIÓN POR FASES
- **Ahora mismo (esta semana):** 2-3 acciones concretas e inmediatas, con pasos específicos, no ideas vagas.
- **Corto plazo (próximas 2-4 semanas):** cómo consolidar el avance.
- **Si esto se repite o no mejora:** una señal de alerta y qué hacer entonces.

## GUION SUGERIDO
Un fragmento de mensaje o líneas concretas que el líder podría decirle o escribirle a esta persona — palabras reales, no solo "anímala".

## RECURSOS O CONTENIDO A COMPARTIR
Si aplica, qué tipo de contenido, formato o ejemplo concreto le ayudaría (ej: un guion de reel, una plantilla de mensaje, un ejemplo de publicación).

## PRIORIDAD
Alta / Media / Baja, y si esto amerita una llamada 1 a 1 o basta con un mensaje — con la razón en una frase.

Sé denso en valor, específico, y trata cada caso como si fuera el más importante que vas a resolver hoy. Nunca rellenes con frases genéricas de motivación ("¡tú puedes!", "no te rindas") — cada línea debe aportar algo accionable.`,
      messages: [{
        role: 'user',
        content: `Miembro del equipo: ${nombre}
Nivel actual: ${nivel || 'No especificado'}
Tiempo trabajando en el negocio: ${tiempoEnEsto || 'No especificado'}

Dificultad reportada:
${dificultad}`
      }]
    });

    const data = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload)
          },
          timeout: 20000
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, json: JSON.parse(raw) });
            } catch (e) {
              reject(new Error('Respuesta no es JSON válido: ' + raw.slice(0, 300)));
            }
          });
        }
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout de 20s alcanzado llamando a Anthropic'));
      });
      req.on('error', (e) => reject(e));
      req.write(payload);
      req.end();
    });

    if (data.status !== 200) {
      console.error('Anthropic API respondió con error:', data.status, JSON.stringify(data.json));
    } else {
      const textBlock = data.json?.content?.find((b) => b.type === 'text');
      if (textBlock?.text) {
        informe = textBlock.text;
      } else {
        console.error('Respuesta de Anthropic sin bloque de texto:', JSON.stringify(data.json));
      }
    }
  } catch (err) {
    console.error('Fallo al llamar a la API de Anthropic:', err.message || err);
    // si la IA falla, igual seguimos y te llega el mensaje original sin procesar
  }

  // 2) Enviarte todo por correo vía Formspree
  try {
    const fsRes = await fetch(process.env.FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        tipo: 'Consulta de equipo',
        nombre,
        nivel: nivel || 'No especificado',
        tiempo_en_el_negocio: tiempoEnEsto || 'No especificado',
        dificultad_original: dificultad,
        informe_ia: informe,
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
