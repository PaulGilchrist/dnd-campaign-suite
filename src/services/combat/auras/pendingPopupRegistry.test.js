// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';

import { registerPendingPopupSetter, getPendingPopupSetter } from './pendingPopupRegistry.js';

// The module is a pure in-memory Map singleton with no timers — pending
// popups wait indefinitely until consumed. Vitest gives each test file a
// fresh module registry, and each test below uses its own static key and
// consumes everything it registers, so no cross-test contamination.
describe('pendingPopupRegistry', () => {
  it('hands back a registered setter exactly once, then re-arms after consumption', () => {
    const promptId = 'test-lifecycle';
    const setter1 = vi.fn();
    const setter2 = vi.fn();

    registerPendingPopupSetter(promptId, setter1);

    expect(getPendingPopupSetter(promptId)).toBe(setter1);
    // get consumes the entry: second read finds nothing.
    expect(getPendingPopupSetter(promptId)).toBeNull();

    // After consumption the same promptId can stage a new popup.
    registerPendingPopupSetter(promptId, setter2);
    expect(getPendingPopupSetter(promptId)).toBe(setter2);
    expect(getPendingPopupSetter(promptId)).toBeNull();
  });

  it('overwrites with the latest setter when the same promptId is registered twice before consumption', () => {
    const promptId = 'test-overwrite';
    const staleSetter = vi.fn();
    const freshSetter = vi.fn();

    registerPendingPopupSetter(promptId, staleSetter);
    registerPendingPopupSetter(promptId, freshSetter);

    expect(getPendingPopupSetter(promptId)).toBe(freshSetter);
    // Overwrite does not append: consumption is still one-time.
    expect(getPendingPopupSetter(promptId)).toBeNull();
  });

  it('consumes only the requested promptId, leaving other pending popups intact', () => {
    const idA = 'test-key-a';
    const idB = 'test-key-b';
    const setterA = vi.fn();
    const setterB = vi.fn();

    registerPendingPopupSetter(idA, setterA);
    registerPendingPopupSetter(idB, setterB);

    expect(getPendingPopupSetter(idA)).toBe(setterA);
    expect(getPendingPopupSetter(idB)).toBe(setterB);
    expect(getPendingPopupSetter(idA)).toBeNull();
  });

  it('returns null for an unregistered promptId, before and after registration', () => {
    const promptId = 'test-unregistered';

    expect(getPendingPopupSetter(promptId)).toBeNull();
    registerPendingPopupSetter(promptId, vi.fn());
    expect(getPendingPopupSetter(promptId)).not.toBeNull();
    // Consumed above — back to the empty-registry contract.
    expect(getPendingPopupSetter(promptId)).toBeNull();
  });
});
