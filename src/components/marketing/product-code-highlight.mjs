// Keep the established IntelliJ-style palette without changing code whitespace.
export function highlightKotlin(source) {
    const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const keywords = new Set(['data', 'class', 'val', 'var', 'fun', 'if', 'throw', 'return', 'companion', 'object']);
    return source.replace(/"(?:\\.|[^"\\])*"|@[\w:]+|\b\d+\b|\b\w+\b|[<>&]/g, (token, offset) => {
        let kind;
        if (token.startsWith('"')) kind = 'string';
        else if (token.startsWith('@')) kind = 'annotation';
        else if (/^\d/.test(token)) kind = 'number';
        else if (keywords.has(token)) kind = 'keyword';
        else if (['null', 'true', 'false'].includes(token)) kind = 'literal';
        else if (/^[A-Z_]+$/.test(token)) kind = 'field';
        else if (/^[A-Z]/.test(token)) kind = 'type';
        else if (/^\s*[(<]/.test(source.slice(offset + token.length))) {
            kind = /fun\s+$/.test(source.slice(0, offset)) ? 'method' : 'call';
        }
        return kind ? `<span class="tok-${kind}">${escape(token)}</span>` : escape(token);
    });
}
