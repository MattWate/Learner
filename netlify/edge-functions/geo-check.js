export default async function handler(request, context) {
  const country = String(context.geo?.country?.code || '').toUpperCase();
  const region = country === 'US' ? 'US' : 'ZA';

  return new Response(JSON.stringify({
    country: country || null,
    region,
    city: context.geo?.city || null,
    subdivision: context.geo?.subdivision?.code || null,
    timezone: context.geo?.timezone || null,
    ip: context.ip || null,
    runtime: 'netlify-edge'
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store, max-age=0'
    }
  });
}
