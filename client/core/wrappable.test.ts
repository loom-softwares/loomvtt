/*******************************************************************************
 * LoomVTT
 * client/core/wrappable.test.ts
 * 
 * 
 * Tests for the wrappable function wrapper.
 ******************************************************************************/

import { createWrappable } from './wrappable.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

// --- Teste 1: wrap intercepta e modifica o retorno ---
{
  const fn = createWrappable((x: number) => x * 2);
  const result = fn(5);
  assert(result === 10, 'base function works');

  const unsub = fn.wrap((wrapped, x) => wrapped(x) + 1);
  const wrappedResult = fn(5);
  assert(wrappedResult === 11, 'wrap adds 1 to result');

  unsub();
  const afterUnsub = fn(5);
  assert(afterUnsub === 10, 'after unsub, base function is restored');
}

// --- Test 2: multiple wrappers stack in the correct order ---
// Last registered = outermost = runs first
{
  const fn = createWrappable(() => '');

  fn.wrap((wrapped) => wrapped() + 'B');
  fn.wrap((wrapped) => wrapped() + 'A');

  const result = fn();
  // A is outermost (last registered): A → B → base → '' → B → BA
  assert(result === 'BA', 'wrapper order: outermost (A) runs first, calls inner (B), then base');
}

// --- Test 3: selective unregistration works ---
{
  const fn = createWrappable((s: string) => s);

  const unsubB = fn.wrap((wrapped, s) => wrapped(s) + 'B');
  fn.wrap((wrapped, s) => wrapped(s) + 'A');

  const r1 = fn('');
  // A (outer) → B (inner) → base → '' → B → BA
  assert(r1 === 'BA', 'both wrappers active');

  unsubB();
  const r2 = fn('');
  assert(r2 === 'A', 'after unsub B, only A remains');
}

// --- Test 4: not calling wrapped() breaks the chain ---
// Last registered = outermost (runs first).
// If the outer doesn't call wrapped(), the inner never runs.
{
  const fn = createWrappable(() => 'original');

  let ran1 = false;
  fn.wrap((wrapped) => {
    ran1 = true;
    return wrapped();
  });

  let ran2 = false;
  fn.wrap((_wrapped) => {
    ran2 = true;
    return 'overridden';
  });

  // Order: wrapper2 (outer) → wrapper1 → base
  ran1 = false;
  ran2 = false;
  const result = fn();
  assert(result === 'overridden', 'outer broke the chain');
  assert(ran2, 'outer executed');
  assert(!ran1, 'inner did NOT execute (outer did not call wrapped)');
}

// --- Test 5: wrap with multiple args ---
{
  const fn = createWrappable((a: number, b: number) => a + b);

  fn.wrap((wrapped, a, b) => wrapped(a, b) * 2);

  const result = fn(3, 4);
  assert(result === 14, 'wrap with multiple args works (7 * 2)');
}

// --- Test 6: error in one wrapper doesn't crash the others ---
{
  const origError = console.error;
  const errorLogs: unknown[][] = [];
  console.error = (...args: unknown[]) => { errorLogs.push(args); };

  const fn = createWrappable(() => '');

  fn.wrap((wrapped) => wrapped() + 'B');          // inner
  fn.wrap((_wrapped) => { throw new Error('middle'); }); // middle — throws
  fn.wrap((wrapped) => wrapped() + 'C');          // outer (last = outermost)

  // Chain: outer(C) → middle(throws) → inner(B) → base('')
  // Without error: '' → addB → 'B' → addC → 'BC'
  // With error in middle: throw flows to addB → 'B' → addC → 'BC'
  const result = fn();
  assert(result === 'BC', 'result comes from inner layer even with error in middle');

  const result2 = fn();
  assert(result2 === 'BC', 'second call works the same (nothing crashed)');

  assert(errorLogs.length > 0, 'console.error was called with the error');
  assert(errorLogs.some((args) => args.some((a) => typeof a === 'string' && a.includes('wrapper'))), 'identifiable message in log');

  console.error = origError;
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
