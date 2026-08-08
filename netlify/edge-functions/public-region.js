export default async function handler(request, context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const country = String(context.geo?.country?.code || '').toUpperCase();
  const region = country === 'US' ? 'US' : 'ZA';
  let html = await response.text();

  if (region === 'US') {
    html = html
      .replace('R69<span class="text-sm text-slate-500">/mo</span>', '$5.99<span class="text-sm text-slate-500">/mo</span>')
      .replace('R99<span class="text-sm text-slate-500">/mo</span>', '$7.99<span class="text-sm text-slate-500">/mo</span>')
      .replace('R149<span class="text-sm text-slate-500">/mo</span>', '$10.99<span class="text-sm text-slate-500">/mo</span>');
  }

  html = html.replace('</head>', `<meta name="learnergenie-region" content="${region}">\n</head>`);
  const headers = new Headers(response.headers);
  headers.set('x-learnergenie-region', region);
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  return new Response(html, { status: response.status, headers });
}

export const config = { path: '/' };
