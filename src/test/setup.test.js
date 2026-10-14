import { describe, it, expect, afterEach } from 'vitest';
import { clearActiveInstances, setApplyBusy, isApplyBusy } from '../components/char-sheet/modals/shared/areaEffectModalInstances.js';

describe('areaEffectModalInstances — applyBusy flag management', () => {
  afterEach(() => {
    clearActiveInstances();
  });

  it('starts as not busy', () => {
    expect(isApplyBusy()).toBe(false);
  });

  it('clearActiveInstances resets busy state even when already true', () => {
    setApplyBusy(true);
    expect(isApplyBusy()).toBe(true);
    clearActiveInstances();
    expect(isApplyBusy()).toBe(false);
  });
});
