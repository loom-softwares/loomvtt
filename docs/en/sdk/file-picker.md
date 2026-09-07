# File Picker — media browser (`file-picker.ts`)

Media file selector (images, video, audio, fonts, documents). Exposed as
`Loom.applications.apps.FilePicker.implementation`.

```typescript
import { FilePicker } from './core/file-picker.js';
```

## API

```typescript
interface FilePickerOptions {
  type?: 'image' | 'video' | 'audio' | 'imagevideo' | 'document' | 'font' | 'folder' | 'any';
  current?: string;       // initial directory
  callback?: (path: string) => void;
  top?: number;
  left?: number;
  width?: number;         // default 700
  height?: number;        // default 680
  userRole?: number;
  worldId?: string;
  title?: string;         // default 'Texture Browser'
}

class FilePicker {
  constructor(options?: FilePickerOptions);
  browse(): Promise<string>; // resolves with the chosen path
}
```

## Example

```js
const picker = new FilePicker({
  type: 'image',
  current: '/public',
  title: 'Choose the portrait',
});

// browse() resolves with the selected path (and also calls options.callback)
const path = await picker.browse();
console.log('Selected:', path);
```
