export default async function handler(request, context) {
  const country = String(context.geo?.country?.code || '').toUpperCase();
  const region = country === 'US' ? 'US' : 'ZA';

  return new Response(JSON.stringify({
    country: country || null,
    region,
    city: context.geo?.city || null,
    timezone: context.geo?.timezone || null
  }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, max-age=0'
    }
  });
}
