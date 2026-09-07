/*******************************************************************************
 * LoomVTT
 * client/core/file-picker.ts
 * 
 * 
 * Utility for opening the file picker interface.
 ******************************************************************************/

import { FilePickerWindow } from '../windows/file-picker-window.js';
import { windowManager } from '../core/window-manager.js';

export interface FilePickerOptions {
  type?: 'image' | 'video' | 'audio' | 'imagevideo' | 'document' | 'font' | 'folder' | 'any';
  current?: string;
  callback?: (path: string) => void;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  userRole?: number;
  worldId?: string;
  title?: string;
}

export class FilePicker {
  private options: FilePickerOptions;
  private windowId: string;

  constructor(options: FilePickerOptions = {}) {
    this.options = {
      type: 'image',
      current: '',
      callback: undefined,
      top: undefined,
      left: undefined,
      width: 700,
      height: 680,
      userRole: 0,
      worldId: '',
      title: 'Navegador de Texturas',
      ...options
    };
    this.windowId = `file-picker-${Date.now()}`;
  }

  async browse(): Promise<string> {
    return new Promise((resolve) => {
      const onPick = (path: string) => {
        this.options.callback?.(path);
        // `select-file+confirm` closes naturally via FilePickerWindow.onAction,
        // but double-click bypasses that and must close the window here to avoid getting stuck.
        windowManager.close(this.windowId);
        resolve(path);
      };

      const windowOptions = {
        onSelect: onPick,
        onDoubleClick: onPick,
        currentDir: this.options.current,
        scope: 'world' as const,
        worldId: this.options.worldId,
      };

      // Position the window if top/left are provided
      if (this.options.top !== undefined || this.options.left !== undefined) {
        const style: Record<string, string> = {};
        if (this.options.top !== undefined) style.top = `${this.options.top}px`;
        if (this.options.left !== undefined) style.left = `${this.options.left}px`;

        // Add positioning as a separate option
        (windowOptions as any).positionStyle = style;
      }

      // windowManager.open espera a CLASSE (ele mesmo faz `new WindowClass(props)`),
      // Requires the window class constructor, not an already built instance.
      void windowManager.open(this.windowId, FilePickerWindow, windowOptions);
    });
  }
}