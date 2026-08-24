// netlify/functions/test-conexion.js
// Función de diagnóstico temporal: prueba si esta función puede conectarse
// a internet en general, llamando a una API pública sencilla (no Anthropic).
// Se puede borrar una vez resuelto el problema.

exports.handler = async () => {
  try {
    const res = await fetch('https://api.github.com/zen', {
      headers: { 'User-Agent': 'netlify-test' }
    });
    const text = await res.text();
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, status: res.status, respuesta: text })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message || String(err) })
    };
  }
};
