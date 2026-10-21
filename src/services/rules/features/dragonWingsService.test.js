// @maintained-by-ai
// BUG CLA-099 lane: dragonWingsService.js retirement seam ITSELF — the two
// exported faces the sibling lanes delegate here verbatim:
//   dragonWingsHandler.test.js:5-6 — "Service internals (endDragonWingsBuff
//     writes, log copy, isDragonWingsBuff, formatWingsDuration) are owned by
//     dragonWingsService.test.js";
//   restRules-constants.cla099-dragon-wings.test.js:11 — "Activation is owned
//     by dragonWingsHandler/dragonWingsService.test.js" (flag TRUE-write is the
//     handler's; this lane pins the flag FALSE-clear at :40);
//   clearExpirationEffects.dragon-wings-expiry.test.js:16 — "Activation-side
//     lives in dragonWingsHandler/dragonWingsService tests".
// CHKEPOINT NOTE (#1357-class audit, 2026-10-20): the expiry dispatch
// (clearExpirationEffects.js:418-431) INLINE-DUPLICATES this service instead of
// calling endDragonWingsBuff(name, camp, 'expired') — same 'dragonWingsActive'
// false-write, same expired-log bytes (:427 ≡ service END_LOG_TEXT.expired :17).
// Consequence: NO production producer calls endDragonWingsBuff with 'expired'
// (live call-sites: CharSummary.jsx:320 retract, dragonWingsHandler.js:129
// retract). The 'expired' pins below stay as the export-contract + drift
// detector against that copy; a byte edit on either side fails two files loudly.
// Buff row is DISK-DERIVED, not transcribed: 2024 classes.json:11316 automation
// row { type:'dragon_wings', duration:'1_hour', flySpeed:60, hover:true } plus
// the service's own name/effect constants (pinned as bytes in test 1 against the
// literals the expiry inline and rest lane read).
// Latch pair contract: handler writes active=true (:85)/uses=usesAfter (:84);
// rest lane nulls via batch; THIS service writes active=false ONLY (:40) and
// never touches dragonWingsUses — retirement never refunds the use (header :5-7).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = { AberrantSorcerer: {} };

// Mock 1:1 with the service's two imports; store-fake keeps read-after-write
// semantics real (no behavior mocked away).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[name]?.[key] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => { store[name] = { ...store[name], [key]: value }; }),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import {
  endDragonWingsBuff,
  isDragonWingsBuff,
  formatWingsDuration,
  DRAGON_WINGS_BUFF_NAME,
  DRAGON_WINGS_EFFECT,
  DRAGON_WINGS_USES_KEY,
  DRAGON_WINGS_ACTIVE_KEY,
} from './dragonWingsService.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';

// Disk-derived standing buff (see header: classes.json:11316 row bytes).
const WINGS_BUFF = { name: 'Dragon Wings', effect: 'dragon_wings', duration: '1_hour', flySpeed: 60, hover: true };
const BLESS = { name: 'Bless', effect: 'bless' };

describe('CLA-099 dragonWingsService', () => {
  beforeEach(() => {
    // clearAllMocks only (NOT restoreAllMocks — it would strip the store-fake
    // and addEntry's mockResolvedValue implementations from the module mocks).
    vi.clearAllMocks();
    for (const k of Object.keys(store)) delete store[k];
    store.AberrantSorcerer = {};
  });

  it('exports the exact bytes the sibling lanes read as literals', () => {
    // clearExpirationEffects.js:419-427 and restRules LONG_REST_RESOURCES match
    // these against their own literals; drift here silently orphans their rows.
    expect(DRAGON_WINGS_BUFF_NAME).toBe('Dragon Wings');
    expect(DRAGON_WINGS_EFFECT).toBe('dragon_wings');
    expect(DRAGON_WINGS_USES_KEY).toBe('dragonWingsUses');
    expect(DRAGON_WINGS_ACTIVE_KEY).toBe('dragonWingsActive');
  });

  it('matches only the Dragon Wings buff — REAL near-miss disk names isolate each side', () => {
    expect(isDragonWingsBuff(WINGS_BUFF)).toBe(true);
    // 'Draconic Flight': real buff name (races.json:244, draconicFlightService.js:10) — name side must fail
    expect(isDragonWingsBuff({ name: 'Draconic Flight', effect: 'dragon_wings' })).toBe(false);
    // CLA-096's real effect byte (fly_speed_equals_walk_speed) — effect side must fail
    expect(isDragonWingsBuff({ name: 'Dragon Wings', effect: 'fly_speed_equals_walk_speed' })).toBe(false);
    expect(isDragonWingsBuff(null)).toBe(false);
    expect(isDragonWingsBuff(undefined)).toBe(false);
  });

  it('formats every enum branch and passes non-enums through untouched', () => {
    expect(formatWingsDuration('1_hour')).toBe('1 hour');       // CLA-099 F6 raw-enum fix
    expect(formatWingsDuration('2_hours')).toBe('2 hours');
    expect(formatWingsDuration('10_minutes')).toBe('10 minutes');
    expect(formatWingsDuration('3_rounds')).toBe('3 rounds');
    expect(formatWingsDuration('concentration')).toBe('concentration');
    expect(formatWingsDuration('')).toBe('');
  });

  it('retracts: strips the buff, clears the flag false, logs the exact envelope, refunds no use', () => {
    store.AberrantSorcerer.activeBuffs = [WINGS_BUFF, BLESS];
    store.AberrantSorcerer.dragonWingsActive = true;   // byte-written true by handler.js:85
    store.AberrantSorcerer.dragonWingsUses = 0;

    const removed = endDragonWingsBuff('AberrantSorcerer', campaignName, 'retracted');

    expect(removed).toBe(true);
    expect(store.AberrantSorcerer.activeBuffs).toEqual([BLESS]);        // foreign buff survives
    expect(store.AberrantSorcerer.dragonWingsActive).toBe(false);       // latch false-clear
    expect(setRuntimeValue).toHaveBeenCalledTimes(2);                        // ONE spread buff write + flag
    expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', 'activeBuffs', [BLESS], campaignName);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('AberrantSorcerer', 'dragonWingsUses', expect.anything(), campaignName);
    expect(store.AberrantSorcerer.dragonWingsUses).toBe(0);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'AberrantSorcerer',
      abilityName: 'Dragon Wings',
      description: 'AberrantSorcerer dismisses the draconic wings — Dragon Wings deactivated.',
      timestamp: expect.any(Number),
    });
  });

  it('expired reason (export contract vs the inline expiry copy): exact log bytes, strip to [], flag cleared', () => {
    store.AberrantSorcerer.activeBuffs = [WINGS_BUFF];
    store.AberrantSorcerer.dragonWingsActive = true;

    const removed = endDragonWingsBuff('AberrantSorcerer', campaignName, 'expired');

    expect(removed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', 'activeBuffs', [], campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', 'dragonWingsActive', false, campaignName);
    // Bytes MUST stay identical to clearExpirationEffects.js:427 inline copy — that
    // handler is the live 'expired' producer; divergence must fail both lanes visibly.
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'AberrantSorcerer',
      abilityName: 'Dragon Wings',
      description: 'AberrantSorcerer\'s draconic wings dissolve — Dragon Wings\' duration has expired.',
      timestamp: expect.any(Number),
    });
  });

  it('unknown reason falls back to the retract copy — never silent, never a crash', () => {
    store.AberrantSorcerer.activeBuffs = [WINGS_BUFF];

    const removed = endDragonWingsBuff('AberrantSorcerer', campaignName, 'gm-adjudicated');

    expect(removed).toBe(true);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      description: 'AberrantSorcerer dismisses the draconic wings — Dragon Wings deactivated.',
    }));
  });

  it('no-op without a standing wings buff: no buff-write, no log — flag still cleared (even on a fresh store)', () => {
    store.AberrantSorcerer.activeBuffs = [BLESS];
    store.AberrantSorcerer.dragonWingsActive = true;

    expect(endDragonWingsBuff('AberrantSorcerer', campaignName, 'retracted')).toBe(false);
    // Fresh character: getRuntimeValue returns null — the Array.isArray guard must not crash.
    expect(endDragonWingsBuff('FreshSorcerer', campaignName, 'retracted')).toBe(false);

    expect(store.AberrantSorcerer.activeBuffs).toEqual([BLESS]);   // foreign row verbatim, unwritten
    expect(addEntry).not.toHaveBeenCalled();
    // exactly two writes, both the unconditional flag clear; 'activeBuffs' never written
    expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(setRuntimeValue.mock.calls.every(c => c[1] === 'dragonWingsActive' && c[2] === false)).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('FreshSorcerer', 'dragonWingsActive', false, campaignName);
    expect(store.FreshSorcerer.dragonWingsActive).toBe(false);
  });

  it('log rejection is swallowed with the prefixed console.error — retirement still succeeds', async () => {
    store.AberrantSorcerer.activeBuffs = [WINGS_BUFF];
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('log down');
    addEntry.mockRejectedValueOnce(err);

    const removed = endDragonWingsBuff('AberrantSorcerer', campaignName, 'retracted');
    await Promise.resolve(); // drain the service's .catch microtask
    const logged = errSpy.mock.calls;
    errSpy.mockRestore();

    expect(removed).toBe(true);
    expect(store.AberrantSorcerer.activeBuffs).toEqual([]);
    expect(logged).toEqual([['[dragonWingsService] Error:', err]]);
  });
});
