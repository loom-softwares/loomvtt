/**
 * Executes 'script' type macros in a sandboxed iframe — never in the context
 * of the main page. `sandbox="allow-scripts"` WITHOUT `allow-same-origin` gives
 * the iframe an opaque origin: no access to cookies/localStorage/app DOM, and
 * since the auth cookie is httpOnly + sameSite=lax, no fetch from inside the
 * iframe carries credentials. Do not remove `allow-same-origin` from the
 * "do not add" list — it is what guarantees the complete isolation.
 */

export interface ScriptMacroHandlers {
  onRoll: (formula: string) => void;
  onChat: (content: string) => void;
  onError?: (message: string) => void;
}

const TIMEOUT_MS = 5000;

export function runScriptMacro(code: string, handlers: ScriptMacroHandlers): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.style.display = 'none';

  const escaped = JSON.stringify(code);

  iframe.srcdoc = `
    <script>
      window.Loom = {
        roll: function (formula) { parent.postMessage({ __loomMacro: true, type: 'roll', formula: String(formula) }, '*'); },
        chatSay: function (content) { parent.postMessage({ __loomMacro: true, type: 'chat', content: String(content) }, '*'); },
      };
      try {
        (function () {
          const userCode = ${escaped};
          new Function(userCode)();
        })();
      } catch (e) {
        parent.postMessage({ __loomMacro: true, type: 'error', message: String(e && e.message || e) }, '*');
      }
    <\/script>
  `;

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    window.removeEventListener('message', onMessage);
    clearTimeout(timer);
    iframe.remove();
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || data.__loomMacro !== true) return;

    if (data.type === 'roll') handlers.onRoll(data.formula);
    else if (data.type === 'chat') handlers.onChat(data.content);
    else if (data.type === 'error') handlers.onError?.(data.message);

    cleanup();
  };

  window.addEventListener('message', onMessage);
  const timer = setTimeout(() => {
    handlers.onError?.('Macro exceeded execution time limit');
    cleanup();
  }, TIMEOUT_MS);

  document.body.appendChild(iframe);
}
