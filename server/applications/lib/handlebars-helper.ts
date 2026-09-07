/**
 * handlebars-helper.ts
 *
 * Optional utility module for addons/rulesets that want to use Handlebars
 * inside an isolated mount point (e.g. the customContainer in ProfileView).
 *
 * ⚠️  The CORE does NOT import Handlebars.
 *     Addons must load handlebars themselves and ensure `window.Handlebars`
 *     is available before calling any function here.
 *
 * Usage in an addon:
 *   import Handlebars from 'handlebars';
 *   (window as any).Handlebars = Handlebars;
 *   import { compileTemplate, renderToContainer, bindTemplateToStore } from
 *     '<core-path>/lib/handlebars-helper';
 */

// Type for reactive stores

// ---------------------------------------------------------------------------
// Internal — runtime access to Handlebars (injected by the addon)
// ---------------------------------------------------------------------------

type HBSDelegate = (data: object, options?: object) => string;

interface HandlebarsRuntime {
  compile(source: string, options?: object): HBSDelegate;
  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void;
  escapeExpression(value: unknown): string;
}

/**
 * Returns `window.Handlebars` if the addon loaded it, or throws a descriptive
 * error so developers know exactly what is missing.
 */
function getHandlebars(): HandlebarsRuntime {
  const hbs = (window as any).Handlebars as HandlebarsRuntime | undefined;
  if (!hbs) {
    throw new Error(
      '[handlebars-helper] window.Handlebars is not defined.\n' +
      'Your addon must import Handlebars and assign it to window.Handlebars ' +
      'before calling any function in this module.\n' +
      'Example:\n' +
      '  import Handlebars from "handlebars";\n' +
      '  (window as any).Handlebars = Handlebars;'
    );
  }
  return hbs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compiles a Handlebars template string and returns a reusable delegate.
 * Cache the returned delegate — don't compile on every render.
 *
 * @param source  Raw Handlebars template string, e.g. `"<h2>{{name}}</h2>"`
 * @returns       A compiled template function
 */
export function compileTemplate(source: string): HBSDelegate {
  return getHandlebars().compile(source);
}

/**
 * Renders a compiled Handlebars template with `data` and injects the
 * resulting HTML into `container.innerHTML`.
 *
 * @param container  Target HTMLElement (the isolated mount point)
 * @param template   A compiled delegate returned by `compileTemplate`
 * @param data       Plain object passed to the template
 */
export function renderToContainer(
  container: HTMLElement,
  template: HBSDelegate,
  data: object
): void {
  container.innerHTML = template(data);
}

/**
 * Subscribes to a reactive store and re-renders the template every
 * time the store value changes.  Returns the unsubscribe function so you can
 * clean up when the addon unmounts.
 *
 * @param container  Target HTMLElement (the isolated mount point)
 * @param template   A compiled delegate returned by `compileTemplate`
 * @param store      Any reactive store
 * @returns          Unsubscribe function — call it on addon cleanup
 *
 * @example
 * const unsub = bindTemplateToStore(el, tpl, RPG.cast.store);
 * // later, on cleanup:
 * unsub();
 */
export function bindTemplateToStore(
  container: HTMLElement,
  template: HBSDelegate,
  store: any
): () => void {
  return store.subscribe((data: any) => {
    container.innerHTML = template(data);
  });
}

/**
 * Convenience: compile + bind in one call.
 * Returns the unsubscribe function.
 *
 * @param container     Target HTMLElement
 * @param templateSource Raw Handlebars template string
 * @param store         Reactive store
 */
export function mountHandlebarsView(
  container: HTMLElement,
  templateSource: string,
  store: any
): () => void {
  const template = compileTemplate(templateSource);
  return bindTemplateToStore(container, template, store);
}
