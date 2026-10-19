// @maintained-by-ai
// Lane: useSpellCastExecutor.castAction — the cast TRIGGER seam. Owns what the
// executor DISPATCHES at the chokepoint: exact executeSpellCast payload (spell,
// metaCtx, options incl. extraMeta spread and cachedPosRef positions), the
// LOS pre-check wiring (blocked ⇒ zero dispatch, zero popup), the cachedPosRef
// clearing matrix (success / reject / sync non-promise — ownership pinned by the
// header of useSpellCastExecutor.returnValue.test.js), and rejection logging that
// names the cast spell.
//
// NOT owned here (stronger maintained siblings — do not duplicate):
//   result routing popup/modal/fallback → useSpellCastExecutor.automationPopup.test.js
//   bare modalName key-map routing     → useSpellCastExecutor.modalRouting.test.js
//   unknown modalName guard             → useSpellCastExecutor.modalName.test.js
//   raw {type:popup} (CLA-389)        → useSpellCastExecutor.rawPopup.test.js
//   heal popup bytes / targetName gate → useSpellCastExecutor.healResult.test.js
//   verbatim rejection logging + recovery → useSpellCastExecutor.errorHandling.test.js
//   return contract / ref identity      → useSpellCastExecutor.returnValue.test.js
//   useCallback dep sensitivity         → useSpellCastExecutor.stability.test.js
//   assertCanAct wiring / internals     → actionGateSites.test.js / assertCanAct tests
//   line-of-sight gate internals        → lineOfSightGate.test.js
//
// old → new map (20 → 8):
//   invocation payload + extraMeta spread + ref extraction + null-ref
//     → it.each 'full cast payload' (populated / null ref, exact args)
//   popup / modal / modal-fallback / bare-modalName / heal / rawTotal /
//   falsy-silent / no-fields-silent / automationPopup priority ×2
//     → REMOVED (owned by automationPopup, modalRouting, modalName, rawPopup,
//        healResult siblings — each covered there with wider tables)
//   ref cleared (success / reject) → it.each clear; non-promise preserved → kept
//   console.error Fireball + no-popup-on-throw → REMOVED (errorHandling sibling);
//   distinct-spell-name log → it 'names the cast spell, verbatim'
//   ADDED: it.each LOS pre-check blocked/allowed (seam was unpinned)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

// Seam fake for the LOS gate: default enforced=false keeps every non-LOS test
// on the synchronous fast path (byte-identical to the live module off state).
// Gate internals are owned by lineOfSightGate.test.js.
vi.mock('../../services/combat/lineOfSightGate.js', () => ({
  isLineOfSightEnforced: vi.fn(() => false),
  checkLineOfSight: vi.fn(),
}));

import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { isLineOfSightEnforced, checkLineOfSight } from '../../services/combat/lineOfSightGate.js';
import { renderHook, act } from '@testing-library/react';
import { useSpellCastExecutor } from './useSpellCastExecutor.js';

const ATTACKER_POS = { x: 10, y: 20 };
const TARGET_POS = { x: 30, y: 40 };

function makeProps(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: { name: 'TestCaster' },
    getTargetInfo: vi.fn(),
    campaignName: 'TestCampaign',
    mapName: 'TestMap',
    characters: [],
    setPopupHtml: vi.fn(),
    extraMeta: {},
    ...overrides,
  };
}

async function castOnce(props, spell = { name: 'Fireball' }, metaCtx = {}) {
  const { result } = renderHook(() => useSpellCastExecutor(props));
  await act(async () => {
    await result.current.castAction(spell, metaCtx);
  });
  return result;
}

describe('useSpellCastExecutor.castAction — trigger seam', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    isLineOfSightEnforced.mockReturnValue(false);
    // Rejections are expected in some cases here; verbatim-log assertions are
    // owned by useSpellCastExecutor.errorHandling.test.js.
    consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // The cast chokepoint dispatches executeSpellCast exactly once with the full
  // consumer-exact options object: props verbatim, extraMeta spread, positions
  // from cachedPosRef (undefined when the cache is empty).
  it.each([
    ['populated position cache', { attackerPos: ATTACKER_POS, targetPos: TARGET_POS }, ATTACKER_POS, TARGET_POS],
    ['empty position cache', null, undefined, undefined],
  ])('dispatches executeSpellCast once with the full cast payload (%s)', async (_label, refValue, expectedFrom, expectedTo) => {
    const props = makeProps({
      extraMeta: { customFlag: true },
      cachedPosRef: { current: refValue },
    });
    executeSpellCast.mockResolvedValue(null);
    const spell = { name: 'Fireball' };
    const metaCtx = { slotLevel: 2 };

    await castOnce(props, spell, metaCtx);

    expect(executeSpellCast).toHaveBeenCalledTimes(1);
    expect(executeSpellCast).toHaveBeenCalledWith(spell, metaCtx, {
      rollAttack: props.rollAttack,
      rollDamage: props.rollDamage,
      playerStats: props.playerStats,
      getTargetInfo: props.getTargetInfo,
      attackerPos: expectedFrom,
      targetPos: expectedTo,
      customFlag: true,
      campaignName: 'TestCampaign',
      mapName: 'TestMap',
      characters: [],
    });
  });

  // L5-003 §8.2: enforced RANGED casts run the LOS pre-check BEFORE the slot-
  // charging chokepoint — a blocked cast must never reach executeSpellCast.
  it.each([
    ['blocked', { allowed: false }],
    ['allowed', { allowed: true }],
  ])('LOS pre-check runs before dispatch and %s the cast', async (_label, losOutcome) => {
    isLineOfSightEnforced.mockReturnValue(true);
    checkLineOfSight.mockResolvedValue(losOutcome);
    const props = makeProps({ cachedPosRef: { current: { attackerPos: ATTACKER_POS, targetPos: TARGET_POS } } });

    await castOnce(props, { name: 'Fireball', range: '150 feet' }, { targetName: 'Goblin' });

    expect(checkLineOfSight).toHaveBeenCalledTimes(1);
    expect(checkLineOfSight).toHaveBeenCalledWith({
      campaignName: 'TestCampaign',
      attackerName: 'TestCaster',
      targetName: 'Goblin',
      range: '150 feet',
      setPopupHtml: props.setPopupHtml,
      source: 'useSpellCastExecutor',
      fromPos: ATTACKER_POS,
      toPos: TARGET_POS,
    });
    expect(executeSpellCast).toHaveBeenCalledTimes(losOutcome.allowed ? 1 : 0);
    if (!losOutcome.allowed) {
      expect(props.setPopupHtml).not.toHaveBeenCalled();
    }
  });

  // Clearing matrix (owned here — see returnValue.test.js header): any real
  // promise settles the ref to null.
  it.each([
    ['resolved cast', () => executeSpellCast.mockResolvedValue(null)],
    ['rejected cast', () => executeSpellCast.mockRejectedValue(new Error('Cast failed'))],
  ])('clears cachedPosRef after %s', async (_label, mockImpl) => {
    const ref = { current: { attackerPos: ATTACKER_POS, targetPos: TARGET_POS } };
    mockImpl();

    await castOnce(makeProps({ cachedPosRef: ref }));

    expect(ref.current).toBeNull();
  });

  it('keeps cachedPosRef when executeSpellCast returns a non-promise synchronously', async () => {
    const ref = { current: { attackerPos: ATTACKER_POS } };
    executeSpellCast.mockReturnValue(undefined);

    await castOnce(makeProps({ cachedPosRef: ref }));

    expect(ref.current).toEqual({ attackerPos: ATTACKER_POS });
  });

  // The rejection log line must name the SPELL THAT WAS CAST (debug triage of
  // multi-spell turns). Distinct name here; verbatim value types owned by
  // errorHandling.test.js.
  it('logs rejection verbatim, naming the cast spell', async () => {
    const err = new Error('Cast failed');
    executeSpellCast.mockRejectedValue(err);

    await castOnce(makeProps(), { name: 'Burning Hands' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useSpellCastExecutor] executeSpellCast error for Burning Hands:',
      err,
    );
  });
});
