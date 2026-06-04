export default async (request, context) => {
  const response = await context.next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();
  const scriptTag = '<script src="/usage-limit-override.js"></script>';

  if (html.includes('/usage-limit-override.js')) {
    return new Response(html, response);
  }

  const updatedHtml = html.includes('</body>')
    ? html.replace('</body>', `  ${scriptTag}\n</body>`)
    : `${html}\n${scriptTag}`;

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
};

export const config = {
  path: '/app.html'
};
