/*******************************************************************************
 * LoomVTT
 * client/core/wrappable.ts
 * 
 * 
 * Utility for wrapping functions for interception.
 ******************************************************************************/

type AnyFn = (...args: any[]) => any;

export interface Wrappable<Fn extends AnyFn> {
  (...args: Parameters<Fn>): ReturnType<Fn>;
  wrap(wrapper: (wrapped: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>): () => void;
  addWrapper(wrapper: (wrapped: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>): () => void;
}

export function createWrappable<Fn extends AnyFn>(baseFn: Fn): Wrappable<Fn> {
  const wrappers: Array<(wrapped: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>> = [];
  let current: Fn = baseFn;

  function rebuild(): void {
    current = wrappers.reduce<Fn>((acc, w) => {
      return ((...args: Parameters<Fn>) => {
        try {
          return w(acc, ...args);
        } catch (err) {
          console.error('[Loom.wrap] wrapper threw an error, falling back to previous layer:', err);
          return acc(...args);
        }
      }) as Fn;
    }, baseFn);
  }

  const callable = ((...args: Parameters<Fn>) => current(...args)) as Wrappable<Fn>;

  callable.wrap = (wrapper) => {
    wrappers.push(wrapper);
    rebuild();
    return () => {
      const idx = wrappers.indexOf(wrapper);
      if (idx >= 0) wrappers.splice(idx, 1);
      rebuild();
    };
  };
  callable.addWrapper = callable.wrap;

  return callable;
}
