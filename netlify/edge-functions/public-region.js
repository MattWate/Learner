export default async function handler(request, context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const country = String(context.geo?.country?.code || '').toUpperCase();
  const region = country === 'US' ? 'US' : 'ZA';
  let html = await response.text();

  if (region === 'US') {
    html = html
      .replace(/R69(?=<span[^>]*>\/mo<\/span>)/g, '$5.99')
      .replace(/R99(?=<span[^>]*>\/mo<\/span>)/g, '$7.99')
      .replace(/R149(?=<span[^>]*>\/mo<\/span>)/g, '$10.99');
  }

  html = html.replace('</head>', `<meta name="learnergenie-region" content="${region}"><meta name="learnergenie-country" content="${country || 'UNKNOWN'}">\n</head>`);

  const headers = new Headers(response.headers);
  headers.set('x-learnergenie-region', region);
  headers.set('x-learnergenie-country', country || 'UNKNOWN');
  headers.set('cache-control', 'private, no-store, max-age=0');
  headers.set('vary', 'accept-encoding');
  return new Response(html, { status: response.status, headers });
}
