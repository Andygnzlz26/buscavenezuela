/**
 * BuscaVenezuela — Pages Function Proxy
 * Proxies /api/* requests to the Cloudflare Worker
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Rewrite /api/* to Worker URL
  const workerUrl = env.WORKER_URL || 'https://buscavenezuela-api.workers.dev';
  const targetUrl = workerUrl + url.pathname + url.search;
  
  // Clone headers
  const headers = new Headers(request.headers);
  headers.set('Origin', url.origin);
  
  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? null : await request.blob(),
  });
  
  try {
    const response = await fetch(proxyRequest);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error connecting to API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
