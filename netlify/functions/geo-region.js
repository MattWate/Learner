exports.handler = async (event, context) => {
  const country = String(context?.geo?.country?.code || '').toUpperCase();
  const region = country === 'US' ? 'US' : 'ZA';

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, max-age=0'
    },
    body: JSON.stringify({
      country: country || null,
      region,
      city: context?.geo?.city || null,
      timezone: context?.geo?.timezone || null,
      function_runtime: 'lambda-js'
    })
  };
};
