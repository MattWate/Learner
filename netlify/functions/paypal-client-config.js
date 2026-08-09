exports.handler = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ error: 'PayPal checkout is not configured.' })
    };
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    body: JSON.stringify({ clientId })
  };
};
