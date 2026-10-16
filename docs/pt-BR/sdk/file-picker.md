# File Picker — navegador de mídia (`file-picker.ts`)

Seletor de arquivos de mídia (imagens, vídeo, áudio, fontes, documentos). Exposto como
`Loom.applications.apps.FilePicker.implementation`.

```typescript
import { FilePicker } from './core/file-picker.js';
```

## API

```typescript
interface FilePickerOptions {
  type?: 'image' | 'video' | 'audio' | 'imagevideo' | 'document' | 'font' | 'folder' | 'any';
  current?: string;       // diretório inicial
  callback?: (path: string) => void;
  top?: number;
  left?: number;
  width?: number;         // default 700
  height?: number;        // default 680
  userRole?: number;
  worldId?: string;
  title?: string;         // padrão: string localizada `filePicker.title` ("File Browser" em inglês; "Navegador de Arquivos" em pt-BR)
}

class FilePicker {
  constructor(options?: FilePickerOptions);
  browse(): Promise<string>; // resolve com o caminho escolhido
}
```

## Exemplo

```js
const picker = new FilePicker({
  type: 'image',
  current: '/public',
  title: 'Escolha o retrato',
});

// browse() resolve com o path selecionado (e também chama options.callback)
const path = await picker.browse();
console.log('Selecionado:', path);
```