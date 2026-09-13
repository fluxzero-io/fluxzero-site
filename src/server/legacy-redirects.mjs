export const legacyMonitoringPaths = ['/monitoring', '/monitoring/', '/monitoring/index.html', '/monitoring/index.md'];

export function redirectLegacyMonitoring(request) {
    const url = new URL(request.url);
    if (!legacyMonitoringPaths.includes(url.pathname)) return undefined;
    url.pathname = url.pathname.endsWith('.md') ? '/product-insight/index.md' : '/product-insight/';
    return Response.redirect(url.toString(), 302);
}
