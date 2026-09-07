import { RichTextRegistry } from './rich-text-registry.js';

RichTextRegistry.addNodes((nodes) => nodes.append({
  docLink: {
    attrs: { docType: {}, docId: {}, label: {} },
    inline: true,
    group: 'inline',
    toDOM: (node) => ['a', {
      class: 'doc-link',
      'data-doc-type': node.attrs.docType,
      'data-doc-id': node.attrs.docId,
      href: '#',
    }, node.attrs.label],
    parseDOM: [{
      tag: 'a.doc-link',
      getAttrs: (dom) => ({
        docType: (dom as HTMLElement).dataset.docType,
        docId: (dom as HTMLElement).dataset.docId,
        label: dom.textContent,
      }),
    }],
  },
  inlineRoll: {
    attrs: { formula: {}, label: { default: null } },
    inline: true,
    group: 'inline',
    toDOM: (node) => ['span', {
      class: 'inline-roll',
      'data-formula': node.attrs.formula,
    }, node.attrs.label || node.attrs.formula],
    parseDOM: [{
      tag: 'span.inline-roll',
      getAttrs: (dom) => ({
        formula: (dom as HTMLElement).dataset.formula,
        label: dom.textContent,
      }),
    }],
  },
}));
