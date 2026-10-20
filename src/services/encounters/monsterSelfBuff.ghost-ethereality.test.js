// @maintained-by-ai
// MA-0780: Ghost "Ethereality" — formerly a zero-affordance inert row, NOW
// rides the MA-0655/0658 monster_self_buff seam: automation:{type:
// "monster_self_buff", effect:"ethereal", rounds:4800} (8 hours, §37
// hours×600 rounds-clock — seam-enforced, never wall-clock). RAW Ethereality
// has NO uses limit on this stat block → no uses/maxUses authored → the
// MA-0020 gate is honestly null (At Will ungated, §57); the already-active
// te latch in the REAL targetEffects store is the only gate.
//
// Maintainer trim: te `ethereal` registry bytes → golden owner
// targetEffectDefinitions.test.js:108 (#1012); enlarged/invisible twin grant
// copy → monsterSelfBuff.test.js:419 + sea-hag-illusory-appearance.test.js:196
// (delete-citing owners, #1136). The injected activeTe fixture is gone — the
// real registerTargetEffect/getActiveTargetEffect run on a store-faithful
// runtime (#1137) so the honest double press arms and refuses off REAL
// store bytes (#949), te stamped exact bytes toBe (#993), logs exact toBe.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  selfBuffRounds,
} from './monsterSelfBuff.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
import monstersData from '../../../public/data/monsters.json';

const { store, logs, expirations } = vi.hoisted(() => ({ store: {}, logs: [], expirations: [] }));
const TE_KEY = 'campaign|targetEffects|test-campaign';

// Store-faithful runtime (#1137): plain KV semantics only — the REAL
// registerTargetEffect/getActiveTargetEffect from targetEffectDefinitions.js
// run on top of it, so the already-active latch is store-backed, not an
// injected fixture (#949).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (scope, key, campaign) => store[`${scope}|${key}|${campaign}`],
  setRuntimeValue: (scope, key, value, campaign) => {
    store[`${scope}|${key}|${campaign}`] = value;
    return Promise.resolve();
  },
  getAllStoreKeys: () => [],
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: (campaign, entry) => {
    logs.push(entry);
    return Promise.resolve();
  },
}));
// addExpiration recorder: the expirationQueue consumer lane owns its own
// tests; here the exact clock stamp IS the contract.
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: (entry) => { expirations.push(entry); },
  KEY: 'pendingExpirations',
}));

const ghost = monstersData.find(m => m.index === 'ghost');
const ETHEREALITY_ROW = ghost.actions.find(a => a.name === 'Ethereality');
const ETH_REAL_DESC = "The ghost casts the <strong>Ethereality</strong> spell, requiring no spell components and using Charisma as the spellcasting ability. The ghost is visible on the Material Plane while on the Border Ethereal and vice versa, but it can't affect or be affected by anything on the other plane.";

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  logs.length = 0;
  expirations.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-0780 Ghost Ethereality disk row (by name) — At Will, honestly ungated', () => {
  it('ghost Ethereality authors monster_self_buff automation verbatim, rounds:4800, no uses → MA-0020 gate null', () => {
    expect(ghost?.name).toBe('Ghost');
    expect(ETHEREALITY_ROW.name).toBe('Ethereality');
    expect(ETHEREALITY_ROW.description).toBe(ETH_REAL_DESC);
    expect(ETHEREALITY_ROW.spellcasting_ability).toBe('Charisma');
    expect(ETHEREALITY_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'ethereal', rounds: 4800 });
    expect(isMonsterSelfBuffRow(ETHEREALITY_ROW)).toBe(true);
    expect(selfBuffRounds(ETHEREALITY_ROW)).toBe(4800);
    expect(ETHEREALITY_ROW.uses).toBeUndefined();
    expect(ETHEREALITY_ROW.maxUses).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(ETHEREALITY_ROW, {})).toBeNull();
  });
});

describe('MA-0780 honest double press — real te store latch, one merged rounds:4800 clock', () => {
  it('press 1 arms te `ethereal` exact bytes on self with zero spend; PC decoy untouched; press 2 refuses already_ethereal with zero extra writes', async () => {
    // Loud PC decoy (#948/#1057): same effect key on another target must
    // neither block the ghost's press nor be disturbed by it.
    store[TE_KEY] = [{ target: 'PC 1', effect: 'ethereal', source: 'Archfey', duration: 'minute' }];
    const setPopupHtml = vi.fn();
    const press = () => resolveMonsterSelfBuffRow({
      action: ETHEREALITY_ROW,
      monsterName: 'Ghost 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps: {},
    });

    const first = await press();
    expect(first).toEqual({ resolved: true, effectKey: 'ethereal', rounds: 4800, remaining: null, thp: null, allyNames: [] });
    // te stamp exact producer bytes (#993): duration:minute overridden, no
    // bolster legs (no temp_hp/ally_radius_ft on this row).
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'ethereal', source: 'Archfey', duration: 'minute' },
      { target: 'Ghost 1', effect: 'ethereal', source: 'Ghost 1', duration: 'minute', rounds: 4800, actionName: 'Ethereality' },
    ]);
    expect(expirations).toEqual([{
      attackerName: 'Ghost 1',
      targetName: 'Ghost 1',
      campaignName: 'test-campaign',
      rounds: 4800,
      effects: [{ type: 'remove_target_effect', effectKey: 'ethereal', source: 'Ghost 1', target: 'Ghost 1' }],
    }]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'ethereal_granted', characterName: 'Ghost 1', abilityName: 'Ethereality' });
    expect(logs[0].description).toBe("Ghost 1 Ethereality: te `ethereal` armed on itself for 4800 rounds (8 hours) — the ghost enters the Border Ethereal — visible on the Material Plane while on the Border Ethereal and vice versa; plane interaction (can't affect or be affected by anything on the other plane) is GM-enforced (§70 advisory). At Will, no uses limit; a re-cast while ethereal refuses zero-cost via the `ethereality_refused` / already_ethereal latch.");
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Border Ethereal'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('At Will'));

    // Press 2 — latch read off REAL store bytes, not an injected fixture.
    const second = await press();
    expect(second).toEqual({ resolved: false, reason: 'already-active' });
    // Zero-write census (#1026): te store byte-identical (decoy survivor),
    // one clock only, no uses stores ever written.
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'ethereal', source: 'Archfey', duration: 'minute' },
      { target: 'Ghost 1', effect: 'ethereal', source: 'Ghost 1', duration: 'minute', rounds: 4800, actionName: 'Ethereality' },
    ]);
    expect(expirations).toHaveLength(1);
    expect(Object.keys(store)).toEqual([TE_KEY]);
    expect(logs.some(e => e.type === 'ability_use')).toBe(false);
    // Ghost-only slug (§278): "Ethereality" → ethereality_refused.
    expect(logs.map(l => l.automationType)).toEqual(['ethereal_granted', 'ethereality_refused']);
    const refusal = logs[1];
    expect(refusal.automationDetail).toBe('already_ethereal');
    expect(refusal.description).toBe('Ghost 1 is already ethereal — Ethereality refused, zero use spent. Refusal reason: already_ethereal.');
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining('Already Ethereal'));
  });
});
