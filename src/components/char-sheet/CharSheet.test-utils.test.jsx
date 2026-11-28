// @maintained-by-ai 2026-11-27
// ---------------------------------------------------------------------------
// Contract pins for CharSheet.test-utils.jsx fixture factories.
//
// Consumer grep (2026-11-27): 15 CharSheet-family test files import this
// module. Export face matches consumer imports exactly — no consumer
// imports a name this module does not export. Notably `mockPlayerSummary`
// has ZERO import consumers (only createDefaultProps references it
// internally): dead-export candidate for de-export, reported not fixed.
// No exports mirror baseCombatActions/formatUtils/spellSectionUtils/
// spellDamageUtils/useSpellCastExecutor — the #1974 cross-generation
// mirror concern does not apply to this module.
//
// Most of this util is pure object literals whose shapes are exercised by
// every consumer test that renders CharSheet (createMockStore → runtime
// store double in 11 files; createSharedPopupReturnValue's Provider
// passthrough in every render harness) — testing those here would just
// echo the literals. Pinned directly: the two default+override merge
// factories, and the setPopup → resetTestState round-trip (3 consumers
// import setPopup and pair it with resetTestState in beforeEach; nothing
// else would fail if the mutate-or-clear pair broke).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';

import {
  createDefaultProps,
  createMockPlayerStats,
  resetTestState,
  createSharedPopupReturnValue,
  setPopup,
} from './CharSheet.test-utils.jsx';

describe('createDefaultProps', () => {
  it('shallow-merges overrides over safe defaults with fresh mocks per call', () => {
    const props = createDefaultProps();
    expect(props.campaignName).toBe('test-campaign');
    expect(props.playerSummary).toMatchObject({ name: 'Test Character', rules: '5e' });
    // Call-and-assert (#245 sharpen): the default is a live, assertable mock —
    // consumers spy on save clicks; a non-function or no-op default breaks this.
    props.onSaveClick('save-click');
    expect(props.onSaveClick).toHaveBeenCalledTimes(1);
    expect(props.onSaveClick).toHaveBeenCalledWith('save-click');
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

describe('setPopup + resetTestState round-trip', () => {
  it('setPopup stages popup state that resetTestState restores, leaving a live, cleared setter', () => {
    const popup = createSharedPopupReturnValue();
    // Factory baseline: consumers seed beforeEach from this shape.
    expect(popup.popupHtml).toBeNull();
    expect(popup.value).toEqual({});
    // Provider must render its children directly — every render harness
    // wraps CharSheet in it, so a non-passthrough blanks the tree.
    expect(popup.Provider({ children: 'child' })).toBe('child');

    // setPopup is the only mutator 3 consumers import to stage state.
    const html = { type: 'old' };
    setPopup(popup, html);
    expect(popup.popupHtml).toBe(html);
    popup.setPopupHtml('called');
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
