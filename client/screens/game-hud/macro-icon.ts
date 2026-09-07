import { createWrappable } from '../../core/wrappable.js';

interface MacroForIcon {
  id: string;
  name: string;
  imgUrl: string;
}

function renderMacroIcon(macro: MacroForIcon): string {
  if (macro.imgUrl) {
    return `<img src="${macro.imgUrl}" alt="${macro.name}" class="macro-icon">`;
  }
  // No icon defined: shows a generic icon instead of the name written over
  // the slot (unreadable, breaks over the map background). The name still
  // appears in the slot's `title` (tooltip on hover).
  return `<i class="fa-solid fa-bolt macro-icon-fallback"></i>`;
}

export const renderMacroIconWrap = createWrappable(renderMacroIcon);
