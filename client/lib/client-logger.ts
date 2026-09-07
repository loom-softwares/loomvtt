/**
 * Client logger for LoomVTT, inspired by the classic VTT console aesthetic.
 * Supports multiple stylized log levels and banner display on bootstrap.
 */

interface ClientLogger {
  (message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  banner(): void;
}

// Base color styles corresponding to the Grimdark Design System
const styles = {
  tag: 'background: #E49A42; color: #0f0d0b; font-weight: bold; font-family: "Segoe UI", sans-serif; padding: 2px 6px; border-radius: 3px 0 0 3px;',
  divider: 'background: #2d2825; color: #a89880; font-family: "Segoe UI", sans-serif; padding: 2px 6px; border-radius: 0 3px 3px 0; margin-right: 8px;',
  text: 'color: inherit;',
  info: 'color: #3a7abf; font-weight: bold; margin-right: 4px;',
  success: 'color: #4a8c5c; font-weight: bold; margin-right: 4px;',
  warn: 'color: #F0B060; font-weight: bold; margin-right: 4px;',
  error: 'color: #c94040; font-weight: bold; margin-right: 4px;',
  debug: 'color: #6b5a48; font-style: italic; margin-right: 4px;'
};

const clogFn = (message: string, ...args: unknown[]) => {
  clog.info(message, ...args);
};

export const clog = Object.assign(clogFn, {
  info(message: string, ...args: unknown[]) {
    console.log(
      `%cLoomVTT%cINFO%c ${message}`,
      styles.tag,
      styles.divider,
      styles.info,
      ...args
    );
  },

  success(message: string, ...args: unknown[]) {
    console.log(
      `%cLoomVTT%cOK%c ${message}`,
      styles.tag,
      styles.divider,
      styles.success,
      ...args
    );
  },

  warn(message: string, ...args: unknown[]) {
    console.warn(
      `%cLoomVTT%cWARN%c ${message}`,
      styles.tag,
      styles.divider,
      styles.warn,
      ...args
    );
  },

  error(message: string, ...args: unknown[]) {
    console.error(
      `%cLoomVTT%cERROR%c ${message}`,
      styles.tag,
      styles.divider,
      styles.error,
      ...args
    );
  },

  debug(message: string, ...args: unknown[]) {
    // Only shows debug if debug localStorage is enabled or in dev mode
    const isDev = import.meta.env?.DEV;
    const isDebugEnabled = localStorage.getItem('loomvtt.debug') === 'true';
    if (isDev || isDebugEnabled) {
      console.debug(
        `%cLoomVTT%cDEBUG%c ${message}`,
        styles.tag,
        styles.divider,
        styles.debug,
        ...args
      );
    }
  },

  banner() {
    const ascii = `
  _        ____   ____  __  __
 | |      / __ \\ / __ \\|  \\/  |
 | |     | |  | | |  | | \\  / |
 | |     | |  | | |  | | |\\/| |
 | |____ | |__| | |__| | |  | |
 |______| \\____/ \\____/|_|  |_|
 V I R T U A L   T A B L E T O P
`;
    console.log(
      `%c${ascii}\n%c v0.0.1 - Powered by LoomVTT %c`,
      'color: #E49A42; font-weight: bold; font-family: monospace; font-size: 13px; text-shadow: 1px 1px 0px #1a1714;',
      'background: #1a1714; color: #f0e6d3; font-family: "Inter", sans-serif; font-size: 12px; padding: 4px 10px; border-radius: 4px;',
      'background: transparent;'
    );
  }
}) as ClientLogger;

// Catch unhandled global errors to display with LoomVTT branding
window.addEventListener('error', (event) => {
  clog.error(`Uncaught error at line ${event.lineno}:${event.colno} of ${event.filename}`, event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  clog.error('Unhandled promise rejection:', event.reason);
});

export default clog;
