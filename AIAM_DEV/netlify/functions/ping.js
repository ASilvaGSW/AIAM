/**
 * Simple health check — GET /.netlify/functions/ping
 * Use this to verify Netlify Functions work after deploy or with `netlify dev`.
 */
exports.handler = async function () {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      message: "Netlify Functions are running",
      timestamp: new Date().toISOString(),
    }),
  };
};
