// @maintained-by-ai
// MA-1551: Succubus/Incubus "Etherealness" — formerly a zero-affordance
// plain-bold row (name+description only, all chip gates key off structured
// fields; exact MA-0780 Ghost Ethereality pre-fix twin). NOW rides the SAME
// MA-0655/0780 monster_self_buff seam: automation:{type:"monster_self_buff",
// effect:"ethereal", rounds:4800} (8 hours RAW sustain, §37 hours×600 —
// SEAM ROUND COUNTER, never wall-clock; the only Date.now() in play is the
// cosmetic log timestamp). RAW Etherealness here is At Will → NO
// uses/maxUses authored → MA-0020 gate honestly null (§57); the already-active
// te latch in the REAL targetEffects store is the only gate. Refusal slug
// derives from the ACTION NAME ("Etherealness" → etherealness_refused —
// distinct from the ghost's ethereality_refused, §278); automationDetail
// from the effect key (already_ethereal) — both pinned exact bytes.
// Plane-interaction clauses stay §70.
//
// TWO-CARD ADJUDICATION (#903/#1086): disk carries ONE lane card here —
// index 'succubus-incubus' (name "Succubus/Incubus") owns the Etherealness
// self-buff row. Separate 'succubus'/'incubus' cards have NO Etherealness
// row on disk — their lanes are owned elsewhere (MonsterAction.ma1546
// Charm, MonsterCardHelpers.ma1547 Draining Kiss); no it.each, one by-name
// disk pin, honest.
//
// Maintainer trim: te `ethereal` registry mirror → golden owner
// targetEffectDefinitions.test.js:108 (live-verified #1038; row↔def.effect
// linkage line KEPT per REC #1138). The injected activeTe fixture is gone —
// the real registerTargetEffect/getActiveTargetEffect run on a store-faithful
// runtime (#1137) so the honest double press arms and refuses off REAL store
// bytes (#949); builders verified THROUGH the flow, exact toBe (#993).
// grant-log ghost-copy residuals ("the ghost enters…", `ethereality_refused`
// latch promise) stay verbatim-honest on this shared ethereal branch (#1140)
// — the lane's ACTUAL refusal slug is etherealness_refused, pinned below.
//
// selfBuff family map: base seam → monsterSelfBuff.test.js · ghost own card
// → ghost-ethereality.test.js (#1138) · sprite → sprite-invisibility.test.js
// (#1144) · enlarged/invisible twin copy → monsterSelfBuff.test.js ·
// this lane: succubus/incubus ethereal economy only.
// old→new map: old disk-shape :63-75 + siblings :77-82 + registry mirror
// :88-95 → new disk test (mirror deleted-citing golden :108, linkage kept);
// old first-press :99-131 + prose :133-143 + refusal :145-168 → new honest
// double-press flow test.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  selfBuffRounds,
} from './monsterSelfBuff.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
import { getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
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

const succubus = monstersData.find(m => m.index === 'succubus-incubus');
const ETHEREALNESS_ROW = succubus.actions.find(a => a.name === 'Etherealness');
const ETHEREALNESS_DESC = 'The fiend magically enters the Ethereal Plane from the Material Plane, or vice versa.';

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  logs.length = 0;
  expirations.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-1551 Succubus/Incubus Etherealness disk row (by name) — At Will, honestly ungated', () => {
  it('disk row authors monster_self_buff automation verbatim full keyset, rounds:4800, no uses → MA-0020 gate null; exactly one self-buff row on the card; te linkage rides golden registry', () => {
    expect(succubus?.name).toBe('Succubus/Incubus');
    expect(ETHEREALNESS_ROW.name).toBe('Etherealness');
    // Full-row verbatim (#1142): name/description byte-preserved, NO
    // uses/maxUses authored — At Will on this stat block.
    expect(ETHEREALNESS_ROW).toEqual({
      name: 'Etherealness',
      description: ETHEREALNESS_DESC,
      automation: { type: 'monster_self_buff', effect: 'ethereal', rounds: 4800 },
    });
    expect(isMonsterSelfBuffRow(ETHEREALNESS_ROW)).toBe(true);
    expect(selfBuffRounds(ETHEREALNESS_ROW)).toBe(4800);
    expect(ETHEREALNESS_ROW.uses).toBeUndefined();
    expect(ETHEREALNESS_ROW.maxUses).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(ETHEREALNESS_ROW, {})).toBeNull();
    // Discriminator exactly-once PER CARD (#1086): automation rides
    // Etherealness only — sibling rows (Claw/Charm/Draining Kiss) stay inert.
    expect(succubus.actions.filter(isMonsterSelfBuffRow).map(a => a.name)).toEqual(['Etherealness']);
    // Legendary/lair/reaction disk-honest: no gated uses channel anywhere
    // on this card — the already-active te latch is the ONLY gate (§57/§230).
    expect(succubus.legendary_actions).toEqual([]);
    expect(succubus.lair_actions).toEqual([]);
    expect(succubus.reactions).toEqual([]);
    // Linkage line ONLY (#1138 rec): row key ↔ golden registry row
    // targetEffectDefinitions.test.js:108 (owner: fa-ghost/Spells bytes).
    expect(getEffectDefinition('ethereal')?.effect).toBe(ETHEREALNESS_ROW.automation.effect);
    // Delegate owner MonsterCardHelpers.ma1547-draining-kiss.test.js:20-21
    // re-pins the MA-1547/1550 save-path bytes ON THIS ROW to this lane —
    // they stay intact (§543).
    const kiss = succubus.actions.find(a => a.name === 'Draining Kiss');
    expect(kiss.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
    expect(kiss.save_dc).toBe(15);
    expect(kiss.save_type).toBe('Constitution');
  });
});

describe('MA-1551 honest double press — real te store latch, one merged rounds:4800 clock', () => {
  it('press 1 arms te `ethereal` exact bytes on self with zero spend; PC decoy untouched; press 2 refuses etherealness_refused/already_ethereal with zero extra writes', async () => {
    // Loud PC decoy (#948/#1057): same effect key on another target must
    // neither block the fiend's press nor be disturbed by it.
    store[TE_KEY] = [{ target: 'PC 1', effect: 'ethereal', source: 'Archfey', duration: 'minute' }];
    const setPopupHtml = vi.fn();
    const press = () => resolveMonsterSelfBuffRow({
      action: ETHEREALNESS_ROW,
      monsterName: 'Succubus/Incubus 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps: {},
    });

    const first = await press();
    expect(first).toEqual({ resolved: true, effectKey: 'ethereal', rounds: 4800, remaining: null, thp: null, allyNames: [] });
    // te stamp exact producer bytes (#993): duration:minute from the seam's
    // extraProps overrides register's concentration default; no bolster legs
    // (no temp_hp/ally_radius_ft on this row).
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'ethereal', source: 'Archfey', duration: 'minute' },
      { target: 'Succubus/Incubus 1', effect: 'ethereal', source: 'Succubus/Incubus 1', duration: 'minute', rounds: 4800, actionName: 'Etherealness' },
    ]);
    // Seam round counter (§37 hours×600), never wall-clock: the clock stamp
    // is rounds:4800 with no timestamp/expiresAt field.
    expect(expirations).toEqual([{
      attackerName: 'Succubus/Incubus 1',
      targetName: 'Succubus/Incubus 1',
      campaignName: 'test-campaign',
      rounds: 4800,
      effects: [{ type: 'remove_target_effect', effectKey: 'ethereal', source: 'Succubus/Incubus 1', target: 'Succubus/Incubus 1' }],
    }]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'ethereal_granted', characterName: 'Succubus/Incubus 1', abilityName: 'Etherealness' });
    // Ghost byte-twin grant copy verbatim-honest (#1140): the shared
    // ethereal branch says "the ghost enters…" and promises an
    // `ethereality_refused` latch even on this fiend card — the ACTUAL
    // refusal slug is etherealness_refused (press 2, below). §70 residual.
    expect(logs[0].description).toBe("Succubus/Incubus 1 Etherealness: te `ethereal` armed on itself for 4800 rounds (8 hours) — the ghost enters the Border Ethereal — visible on the Material Plane while on the Border Ethereal and vice versa; plane interaction (can't affect or be affected by anything on the other plane) is GM-enforced (§70 advisory). At Will, no uses limit; a re-cast while ethereal refuses zero-cost via the `ethereality_refused` / already_ethereal latch.");
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('is Ethereal'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Border Ethereal'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('At Will'));
    // Ethereal branch reached (§1035 guard) — never the invisibility else-copy.
    expect(setPopupHtml).not.toHaveBeenCalledWith(expect.stringContaining('turns invisible'));

    // Press 2 — latch read off REAL store bytes, not an injected fixture.
    const second = await press();
    expect(second).toEqual({ resolved: false, reason: 'already-active' });
    // Zero-write census (#1026): te store byte-identical (decoy survivor),
    // one clock only, no uses stores ever written (At Will, zero spend).
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'ethereal', source: 'Archfey', duration: 'minute' },
      { target: 'Succubus/Incubus 1', effect: 'ethereal', source: 'Succubus/Incubus 1', duration: 'minute', rounds: 4800, actionName: 'Etherealness' },
    ]);
    expect(expirations).toHaveLength(1);
    expect(Object.keys(store)).toEqual([TE_KEY]);
    expect(logs.some(e => e.type === 'ability_use')).toBe(false);
    // Fiend-only slug (§278): "Etherealness" → etherealness_refused —
    // distinct from the ghost's ethereality_refused, never re-driven here.
    expect(logs.map(l => l.automationType)).toEqual(['ethereal_granted', 'etherealness_refused']);
    const refusal = logs[1];
    expect(refusal.automationDetail).toBe('already_ethereal');
    expect(refusal.characterName).toBe('Succubus/Incubus 1');
    expect(refusal.description).toBe('Succubus/Incubus 1 is already ethereal — Etherealness refused, zero use spent. Refusal reason: already_ethereal.');
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining('Already Ethereal'));
  });
});
