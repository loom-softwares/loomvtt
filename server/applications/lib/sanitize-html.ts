/**
 * Sanitização de HTML rico vindo de campos que o ProseMirror gera no client
 * (journal pages, descrição de roll table, etc). O editor é confiável, mas as
 * rotas que salvam esse HTML aceitam o campo direto do corpo da requisição —
 * sem isso, um usuário com permissão de edição (ex: Proprietário numa página
 * de journal, uma concessão normal de colaboração) pode mandar <script>/on*=
 * manualmente e rodar código na sessão de quem abrir a página depois (o GM,
 * tipicamente).
 */
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'em', 'u', 's', 'strike', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img', 'span', 'div',
];

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  '*': ['style', 'class'],
};

export function sanitizeRichText(html: string): string {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'data'],
    allowProtocolRelative: false,
    // ProseMirror as vezes gera style inline (cor, alinhamento) — deixa passar
    // so as propriedades inofensivas, nunca url()/expression().
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/],
        'text-align': [/^left$|^right$|^center$|^justify$/],
        'font-weight': [/^bold$|^normal$|^\d+$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}
