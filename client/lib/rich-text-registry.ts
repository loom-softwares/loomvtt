/*******************************************************************************
 * LoomVTT
 * client/lib/rich-text-registry.ts
 ******************************************************************************/

import { Schema, type NodeSpec, type MarkSpec } from 'prosemirror-model';
import type OrderedMap from 'orderedmap';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { EditorState } from 'prosemirror-state';
import { EditorView, type DirectEditorProps } from 'prosemirror-view';
import { exampleSetup } from 'prosemirror-example-setup';
import { DOMParser as PMDomParser, DOMSerializer } from 'prosemirror-model';

type NodeExtender = (nodes: OrderedMap<NodeSpec>) => OrderedMap<NodeSpec>;
type MarkExtender = (marks: OrderedMap<MarkSpec>) => OrderedMap<MarkSpec>;

const nodeExtenders: NodeExtender[] = [];
const markExtenders: MarkExtender[] = [];
let cachedSchema: Schema | null = null;

export const RichTextRegistry = {
  addNodes(fn: NodeExtender): void {
    nodeExtenders.push(fn);
    cachedSchema = null;
  },
  addMarks(fn: MarkExtender): void {
    markExtenders.push(fn);
    cachedSchema = null;
  },
};

function getSchema(): Schema {
  if (cachedSchema) return cachedSchema;

  let nodes = addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block');
  let marks = basicSchema.spec.marks;
  for (const ext of nodeExtenders) nodes = ext(nodes as any) as any;
  for (const ext of markExtenders) marks = ext(marks as any) as any;

  cachedSchema = new Schema({ nodes, marks });
  return cachedSchema;
}

export interface RichTextEditorHandle {
  view: EditorView;
  getHTML(): string;
  destroy(): void;
}

export function mountRichTextEditor(
  el: HTMLElement,
  initialHTML: string,
  rootNode?: ShadowRoot | Document
): RichTextEditorHandle {
  const schema = getSchema();

  const parseEl = document.createElement('div');
  parseEl.innerHTML = initialHTML || '<p></p>';
  const doc = PMDomParser.fromSchema(schema).parse(parseEl);

  const state = EditorState.create({
    doc,
    plugins: exampleSetup({ schema, menuBar: true }),
  });

  const root = rootNode ?? (el.getRootNode() as ShadowRoot | Document);

  // 'root' as a function satisfies ProseMirror's internal execution;
  // the cast resolves the property omission in the @types/prosemirror-view definitions.
  const viewProps: DirectEditorProps & { root?: (view: EditorView) => Document | ShadowRoot } = {
    state,
    root: () => root,
  };

  const view = new EditorView(el, viewProps as DirectEditorProps);

  return {
    view,
    getHTML(): string {
      const serializer = DOMSerializer.fromSchema(schema);
      const frag = serializer.serializeFragment(view.state.doc.content);
      const wrapper = document.createElement('div');
      wrapper.appendChild(frag);
      return wrapper.innerHTML;
    },
    destroy(): void {
      view.destroy();
    },
  };
}