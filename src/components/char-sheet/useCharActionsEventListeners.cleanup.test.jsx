// @maintained-by-ai
// Leak pins for the damage-type-choice/skip window listeners in
// useCharActionsEventListeners (⚠ defect, maintenance ledger run2 #5,
// test-maintain-bugs.md:82). Pre-fix the effect registered both listeners
// with NO cleanup return: every re-render of an active popup stacked a fresh
// pair, stale closures survived dismissal/unmount, and a post-setPopupHtml(null)
// click re-rolled a dead choice. These pins hold the corrected contract:
// exact add/remove ledger pairs (#1348), replace-not-stack on reopen,
// zero handler effect after dismissal, and zero handler effect after unmount
// (the original intent of the prior post-unmount brittleness test deleted in
// the maintained pass — restored here honestly at the hook seam).
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import useCharActionsEventListeners from './useCharActionsEventListeners.js';

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const CHOICE_EVENTS = ['damage-type-choice', 'damage-type-skip'];

function choicePopup(id) {
  return {
    type: 'damage_type_choice',
    name: `Blessed Strikes ${id}`,
    bonusFormula: '1d6',
    bonusRolls: [id],
    bonusTotal: id,
    usedKey: `used_key_${id}`,
    currentRound: 1,
    targetName: 'Goblin',
    attackerName: 'TestCharacter',
  };
}

// Harness: the popupHtml prop is the dismissal/reopen seam. Rerendering with
// a new popup value mirrors how setPopupHtml flows through DiceRollContext
// into CharActions and re-runs the effect under test.
function Harness({ popupHtml, handlers }) {
  useCharActionsEventListeners({ ...handlers, popupHtml });
  return null;
}

// Exact ledger: records every add/remove of the two choice events (delegating
// to the real implementation so dispatch still reaches live listeners) and
// tracks the net open count per event type.
function trackChoiceLedger() {
  const ledger = { adds: [], removes: [], open: {} };
  const realAdd = window.addEventListener.bind(window);
  const realRemove = window.removeEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
    if (CHOICE_EVENTS.includes(type)) {
      ledger.adds.push({ type, fn });
      ledger.open[type] = (ledger.open[type] || 0) + 1;
    }
    return realAdd(type, fn, opts);
  });
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
    if (CHOICE_EVENTS.includes(type)) {
      ledger.removes.push({ type, fn });
      ledger.open[type] = (ledger.open[type] || 0) - 1;
    }
    return realRemove(type, fn, opts);
  });
  return ledger;
}

const addsFor = (ledger, type) => ledger.adds.filter((l) => l.type === type);
const removesFor = (ledger, type) => ledger.removes.filter((l) => l.type === type);

function makeHandlers() {
  return {
    setPopupHtml: vi.fn(),
    setModalState: vi.fn(),
    rollDamage: vi.fn(),
    playerName: 'TestCharacter',
    campaignName: 'test-campaign',
    setRuntimeValue: vi.fn(),
  };
}

function flush() {
  return act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCharActionsEventListeners damage-type-choice listener ledger', () => {
  it('mount -> choose -> dismiss -> reopen -> unmount: exact add/remove pairs, one live listener per event, no post-dismissal fire', async () => {
    const ledger = trackChoiceLedger();
    const handlers = makeHandlers();
    const popup1 = choicePopup(1);

    const view = render(<Harness popupHtml={popup1} handlers={handlers} />);

    // Open: exactly one registration per event, never stacked.
    expect(addsFor(ledger, 'damage-type-choice')).toHaveLength(1);
    expect(addsFor(ledger, 'damage-type-skip')).toHaveLength(1);
    expect(ledger.open['damage-type-choice']).toBe(1);
    expect(ledger.open['damage-type-skip']).toBe(1);

    // Choose on the live popup: rolls once, latches once, dismisses once.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('damage-type-choice', { detail: { chosenType: 'Radiant' } }));
    });
    expect(handlers.rollDamage).toHaveBeenCalledTimes(1);
    expect(handlers.rollDamage).toHaveBeenCalledWith({
      name: 'Blessed Strikes 1', formula: '1d6', total: 1, rolls: [1], modifier: 0,
      context: expect.objectContaining({ damageType: 'Radiant', targetName: 'Goblin', attackerName: 'TestCharacter' }),
    });
    expect(handlers.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(handlers.setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'used_key_1', 1, 'test-campaign');
    expect(handlers.setPopupHtml).toHaveBeenCalledTimes(1);
    expect(handlers.setPopupHtml).toHaveBeenCalledWith(null);

    // Dismissal applied (popupHtml -> null): BOTH listeners are removed with
    // the exact identities that were added. The :64 order bug is closed here —
    // by the time dismissal lands, the handler is gone, so a late click can
    // never fire a choice against a null popup.
    const addedChoice = addsFor(ledger, 'damage-type-choice')[0].fn;
    const addedSkip = addsFor(ledger, 'damage-type-skip')[0].fn;
    await act(async () => { view.rerender(<Harness popupHtml={null} handlers={handlers} />); });
    expect(removesFor(ledger, 'damage-type-choice').map((l) => l.fn)).toContain(addedChoice);
    expect(removesFor(ledger, 'damage-type-skip').map((l) => l.fn)).toContain(addedSkip);
    expect(ledger.open['damage-type-choice']).toBe(0);
    expect(ledger.open['damage-type-skip']).toBe(0);

    // Post-dismissal dispatch: zero handler effect.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('damage-type-choice', { detail: { chosenType: 'Necrotic' } }));
      window.dispatchEvent(new CustomEvent('damage-type-skip'));
    });
    await flush();
    expect(handlers.rollDamage).toHaveBeenCalledTimes(1);
    expect(handlers.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(handlers.setPopupHtml).toHaveBeenCalledTimes(1);

    // Reopen: registers a FRESH pair (replace-not-stack) — still one live
    // listener per event type across the whole session.
    const popup2 = choicePopup(2);
    await act(async () => { view.rerender(<Harness popupHtml={popup2} handlers={handlers} />); });
    expect(ledger.open['damage-type-choice']).toBe(1);
    expect(ledger.open['damage-type-skip']).toBe(1);

    // One dispatch fires exactly one handler, holding the FRESH closure state
    // (pre-fix, the stacked stale copy re-rolled popup1 here too).
    await act(async () => {
      window.dispatchEvent(new CustomEvent('damage-type-choice', { detail: { chosenType: 'Necrotic' } }));
    });
    expect(handlers.rollDamage).toHaveBeenCalledTimes(2);
    expect(handlers.rollDamage).toHaveBeenLastCalledWith({
      name: 'Blessed Strikes 2', formula: '1d6', total: 2, rolls: [2], modifier: 0,
      context: expect.objectContaining({ damageType: 'Necrotic' }),
    });

    // Unmount: ledger closes balanced — every add has a matching remove.
    view.unmount();
    expect(ledger.open['damage-type-choice']).toBe(0);
    expect(ledger.open['damage-type-skip']).toBe(0);
    expect(addsFor(ledger, 'damage-type-choice')).toHaveLength(removesFor(ledger, 'damage-type-choice').length);
    expect(addsFor(ledger, 'damage-type-choice')).toHaveLength(2);
    expect(addsFor(ledger, 'damage-type-skip')).toHaveLength(removesFor(ledger, 'damage-type-skip').length);
  });

  it('stale-popup click after unmount fires nothing (restored intent of the deleted post-unmount brittleness test, run2 #5)', async () => {
    const ledger = trackChoiceLedger();
    const handlers = makeHandlers();

    const view = render(<Harness popupHtml={choicePopup(1)} handlers={handlers} />);
    expect(addsFor(ledger, 'damage-type-choice')).toHaveLength(1);

    view.unmount();
    expect(ledger.open['damage-type-choice']).toBe(0);
    expect(ledger.open['damage-type-skip']).toBe(0);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('damage-type-choice', { detail: { chosenType: 'Radiant' } }));
      window.dispatchEvent(new CustomEvent('damage-type-skip'));
    });
    await flush();

    expect(handlers.rollDamage).not.toHaveBeenCalled();
    expect(handlers.setRuntimeValue).not.toHaveBeenCalled();
    expect(handlers.setPopupHtml).not.toHaveBeenCalled();
  });

  it('three open/dismiss cycles never stack: adds == removes == cycles, each click rolls only its own live popup', async () => {
    const ledger = trackChoiceLedger();
    const handlers = makeHandlers();
    const view = render(<Harness popupHtml={null} handlers={handlers} />);

    for (let id = 1; id <= 3; id++) {
      const popup = choicePopup(id);
      await act(async () => { view.rerender(<Harness popupHtml={popup} handlers={handlers} />); });
      expect(ledger.open['damage-type-choice']).toBe(1);
      expect(ledger.open['damage-type-skip']).toBe(1);

      await act(async () => {
        window.dispatchEvent(new CustomEvent('damage-type-choice', { detail: { chosenType: 'Radiant' } }));
      });
      // One roll per dispatch, with THIS cycle's popup args.
      expect(handlers.rollDamage).toHaveBeenCalledTimes(id);
      expect(handlers.rollDamage).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: `Blessed Strikes ${id}`, total: id })
      );

      await act(async () => { view.rerender(<Harness popupHtml={null} handlers={handlers} />); });
      expect(ledger.open['damage-type-choice']).toBe(0);
      expect(ledger.open['damage-type-skip']).toBe(0);
    }

    expect(addsFor(ledger, 'damage-type-choice')).toHaveLength(3);
    expect(removesFor(ledger, 'damage-type-choice')).toHaveLength(3);
    expect(addsFor(ledger, 'damage-type-skip')).toHaveLength(3);
    expect(removesFor(ledger, 'damage-type-skip')).toHaveLength(3);

    view.unmount();
  });
});
