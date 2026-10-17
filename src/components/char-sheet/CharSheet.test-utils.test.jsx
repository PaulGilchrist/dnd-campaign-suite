// @maintained-by-ai
// ---------------------------------------------------------------------------
// Contract pins for CharSheet.test-utils.jsx fixture factories.
//
// Most of this util is pure object literals or one-line assignments
// (createMockStore, mockPlayerSummary, createSharedPopupReturnValue,
// setPopup, Provider passthrough) whose shapes are exercised by every
// consumer test that renders CharSheet — testing them here just echoes
// the literals and adds no confidence. Only the two default+override
// merge factories and the multi-step resetTestState helper carry
// derivation logic worth pinning directly.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';

import {
  createDefaultProps,
  createMockPlayerStats,
  resetTestState,
  createSharedPopupReturnValue,
} from './CharSheet.test-utils.jsx';

describe('createDefaultProps', () => {
  it('shallow-merges overrides over safe defaults with fresh mocks per call', () => {
    const props = createDefaultProps();
    expect(props.campaignName).toBe('test-campaign');
    expect(props.playerSummary).toMatchObject({ name: 'Test Character', rules: '5e' });
    expect(typeof props.onSaveClick).toBe('function');
    // Each call must mint independent mocks, or call-count assertions
    // in consumer tests would leak between tests.
    expect(props.onSaveClick).not.toBe(createDefaultProps().onSaveClick);

    const customFn = vi.fn();
    const overridden = createDefaultProps({ campaignName: 'other', onSaveClick: customFn });
    expect(overridden.campaignName).toBe('other');
    expect(overridden.onSaveClick).toBe(customFn);
    // Unspecified defaults survive the override spread.
    expect(overridden.playerSummary).toBe(props.playerSummary);
    expect(overridden.characters).toEqual([]);
  });
});

describe('createMockPlayerStats', () => {
  it('provides the baseline stats consumers derive from and lets overrides win', () => {
    const stats = createMockPlayerStats();
    expect(stats).toMatchObject({
      name: 'Test Character',
      level: 5,
      hitPoints: { current: 40, max: 40 },
      rules: '5e',
      class: { name: 'Fighter' },
      speed: 30,
    });
    expect(stats.abilities[0]).toMatchObject({ name: 'Strength', bonus: 2 });
    expect(Array.isArray(stats.actions)).toBe(true);

    const overridden = createMockPlayerStats({ name: 'Custom', level: 10, rules: '2024' });
    expect(overridden.name).toBe('Custom');
    expect(overridden.level).toBe(10);
    expect(overridden.rules).toBe('2024');
    // Partial overrides keep the rest of the baseline intact.
    expect(overridden.hitPoints).toEqual({ current: 40, max: 40 });
    expect(overridden.class).toEqual({ name: 'Fighter' });
  });
});

describe('resetTestState', () => {
  it('restores popup state to pristine and leaves a live, cleared setter', () => {
    const popup = createSharedPopupReturnValue();
    popup.setPopupHtml('called');
    popup.popupHtml = { type: 'old' };
    popup.value = { old: 'data' };

    resetTestState(popup);

    expect(popup.popupHtml).toBeNull();
    expect(popup.value).toEqual({});
    expect(popup.setPopupHtml).toHaveBeenCalledTimes(0);
    // The setter must still be a working mock after reset — consumer
    // tests assert on it in subsequent it() blocks.
    popup.setPopupHtml('after-reset');
    expect(popup.setPopupHtml).toHaveBeenCalledTimes(1);
    expect(popup.setPopupHtml).toHaveBeenCalledWith('after-reset');
  });
});
