export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();
  const scriptTag = '<script src="/usage-limit-override.js"></script>';

  if (html.includes('/usage-limit-override.js')) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: safeHtmlHeaders(response.headers)
    });
  }

  const updatedHtml = html.includes('</body>')
    ? html.replace('</body>', `  ${scriptTag}\n</body>`)
    : `${html}\n${scriptTag}`;

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: safeHtmlHeaders(response.headers)
  });
};

function safeHtmlHeaders(originalHeaders) {
  const headers = new Headers(originalHeaders);

  // The previous version reused response headers after changing the body.
  // That can leave content-length/content-encoding inconsistent and cause the browser to hang.
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-cache');

  return headers;
}

export const config = {
  path: '/app.html'
};
