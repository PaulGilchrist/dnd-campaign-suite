// @maintained-by-ai
// MA-0895 lane: Goblin Hexer "Jinx" (reactions[0]) — press the gated chip over the
// attacker's pending HIT popup before Done (parry §235 window). Press order census:
// round-latch → uses → pending-identity → save-spec gates FIRST (refusals LOG-ONLY,
// zero-spend, zero-roll, zero-store-write, NO popupHtml — the Done popup survives every
// press, MA-0681 teardown twin); attacker WIS save vs DC 13 rolls INLINE machine-stamped
// (§212 nested-abbrev fold); latch+spend AWAITED before consumer-readable stamps
// (CLA-361) for BOTH legs — a saved Jinx still spends (RAW press-burn, the #1026
// zero-applied WATCH is satisfied by design here: the reaction is the cost, not the hit);
// FAIL stamps campaign.pendingJinx + lastAttack.jinxPending; consumePendingJinxOnResolve
// (handlePlainDamage top, MA-0891 redirect twin, handlePlainDamage.js:1206) converts the
// attack to hit:false + zero damage before Done; SUCCESS rides Done unchanged. At Will
// sentinel (uses:999) + 1/round latch (_jinx_negate_usedRound) + lastAttack.jinxResolved
// are the only fire limits.
// CANON cites: #967 consulted-bytes census, #1095 refusal gate-order it.each shape,
// #1094 press census + disk rows by name, #1035 guards refuse before any roll/store
// write, #1019 store-faithful campaign-keyed writes, #1057 off-lane decoys loud,
// #903 it.each tables, #910 honest titles, #1072 dice exact-if-any (rollD20 injected —
// zero real RNG in this file), #1007 mock-hygiene beforeEach.
// Cross-file owners (do not re-pin here): dispatcher family templates (round latch/uses
// arithmetic/record-only) → MonsterCardHelpers.gated-reaction.test.js; this file owns
// ONLY the jinx_negate arm routing — the lane's sole dispatcher coverage. Legacy gated
// row pins (bandit parry, goblin-boss redirect, azer hellish rebuke) are CITED here by
// MonsterCardHelpers.berserk-lashing.test.js:15 and ...hellish-rebuke.test.js:12 —
// kept in the "arms the gated chip" test below; current position of those cited bytes:
// see old→new map. getAllStoreKeys in the useRuntimeState mock is TRANSITIVELY
// REQUIRED (expirationQueue.js imports it; pulled in via MonsterCardHelpers.js:15).
// Old→new map (15 → 10 tests): legacy RAW fields + automation block → t1; gated arm +
// legacy survivors → t2; five press-refusal its (no_pending/miss-resolved-reacted/
// attacker/round/dead-attacker) → t3 refusal table; identity spell-attack unit → t4 gate
// census (adds uses/spec/order legs); FAILED press → t5 (+CLA-361 write-order pin);
// SUCCESS press → t6; attackerSaveModifier unit → t7 save-spec unit (+spec fallback);
// resolve armed match → t8; resolve inert its → t9 inert table (+zero-write/zero-log);
// dispatcher failed-save routing → t10. Dropped: dispatcher off-window refusal — the
// jinx arm is proven routing by t10 and refusal bytes are owned by t3 (same code path,
// family template cited at gated-reaction.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterJinxRow,
  jinxSaveSpec,
  jinxSaveOutcome,
  attackerSaveModifier,
  jinxIdentityRefusal,
  jinxGate,
  resolveMonsterJinxRow,
  consumePendingJinxOnResolve,
} from './monsterJinx.js';
import { getGatedMonsterReaction, resolveMonsterGatedReaction } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const hexer = monstersData.find(m => m.index === 'goblin-hexer');
const JINX_ROW = hexer.reactions[0];
const banditCaptain = monstersData.find(m => m.index === 'bandit-captain');
const goblinBoss = monstersData.find(m => m.index === 'goblin-boss');
const azerPyromancer = monstersData.find(m => m.index === 'azer-pyromancer');

const HEXER = 'Goblin Hexer 1';
const CAMPAIGN = 'test-campaign';

function pendingHit({ attackerName = 'Bandit 1', targetName = HEXER, ...rest } = {}) {
  return {
    rollType: 'attack',
    attackerName,
    targetName,
    attackName: 'Scimitar',
    d20: 14,
    bonus: 3,
    total: 17,
    targetAc: 13,
    hit: true,
    weaponType: 'melee',
    ...rest,
  };
}

function makeCs({ wisMod = -5, attackerHp = 999 } = {}) {
  return {
    round: 1,
    creatures: [
      { name: HEXER, size: 'Small', currentHp: 999, maxHp: 999 },
      { name: 'Bandit 1', size: 'Medium or Small', currentHp: attackerHp, maxHp: 999, saving_throws: { wis: { modifier: wisMod } }, ability_score_modifiers: { wis: 0 } },
    ],
  };
}

function makeDeps({ roll = 10 } = {}) {
  const store = { reactionUses: {}, latches: {}, campaign: {}, logs: [] };
  const deps = {
    rollD20: vi.fn(() => roll),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
      if (propertyName === 'monsterReactionUses') store.reactionUses = value;
      if (propertyName === '_jinx_negate_usedRound') store.latches.jinx = value;
      if (characterKey === 'campaign') store.campaign[propertyName] = value;
      return Promise.resolve();
    }),
    addEntry: vi.fn((campaignName, entry) => { store.logs.push(entry); return Promise.resolve(); }),
  };
  return { store, deps };
}

function press({ lastAttack = pendingHit(), cs = makeCs(), currentRound = 1, storedUses = {}, usedRound = 0, roll = 10 } = {}) {
  const { store, deps } = makeDeps({ roll });
  return resolveMonsterJinxRow({
    action: JINX_ROW,
    monsterName: HEXER,
    campaignName: CAMPAIGN,
    lastAttack,
    cs,
    currentRound,
    storedUses,
    usedRound,
    latchKey: '_jinx_negate_usedRound',
    deps,
  }).then(result => ({ result, store, deps }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0895 data lock — goblin-hexer reactions[0] consulted bytes', () => {
  it('locks the automation block, the DC/type twins, and the At Will uses sentinel', () => {
    expect(hexer.name).toBe('Goblin Hexer');
    expect(JINX_ROW.name).toBe('Jinx');
    expect(JINX_ROW.automation).toEqual({
      type: 'reaction',
      trigger: 'attacked_by_missable_hit',
      effect: 'jinx_negate',
      saveType: 'WIS',
      saveDc: 13,
    });
    expect(JINX_ROW.save_dc).toBe(13);
    expect(JINX_ROW.save_type).toBe('Wisdom');
    expect(jinxSaveSpec(JINX_ROW)).toEqual({ saveDc: 13, saveType: 'WIS' });
    // reactionMaxUses reads maxUses/uses — 999 sentinel → limit 999, At Will spend log branch.
    expect(JINX_ROW.usage).toBe('At Will');
    expect(JINX_ROW.uses).toBe(999);
    expect(JINX_ROW.maxUses).toBe(999);
    expect(isMonsterJinxRow(JINX_ROW)).toBe(true);
    expect(isMonsterJinxRow(banditCaptain.reactions[0])).toBe(false);
  });

  it('arms the gated chip via GATED_MONSTER_REACTIONS and leaves legacy gated rows byte-unchanged', () => {
    const def = getGatedMonsterReaction(JINX_ROW);
    expect(def).toEqual({ effect: 'jinx_negate', trigger: 'attacked_by_missable_hit', label: 'Jinx', icon: 'fa-eye' });
    expect(getGatedMonsterReaction(banditCaptain.reactions[0])).toEqual({ effect: 'parry', trigger: 'melee_hit', label: 'Parry', icon: 'fa-shield-halved' });
    expect(getGatedMonsterReaction(goblinBoss.reactions[0])).toEqual({ effect: 'redirect_attack', trigger: 'attacked_by_seen', label: 'Redirect Attack', icon: 'fa-right-left' });
    expect(getGatedMonsterReaction(azerPyromancer.reactions[0]).effect).toBe('hellish_rebuke');
    expect(banditCaptain.reactions[0].automation.acBonus).toBe(2);
  });
});

describe('MA-0895 press refusals — every gate refusal zero-spend, zero-roll, log-only (Done popup survives)', () => {
  const PRESS_REFUSALS = [
    { reason: 'no_pending_attack', lastAttack: null },
    { reason: 'miss', lastAttack: pendingHit({ hit: false }) },
    { reason: 'resolved', lastAttack: pendingHit({ damageApplied: true, actualDamage: 7 }) },
    { reason: 'reacted', lastAttack: pendingHit({ jinxResolved: true }) },
    { reason: 'attacker', lastAttack: pendingHit({ attackerName: HEXER }) },
    { reason: 'attacker', lastAttack: pendingHit({ attackerName: null }) },
    { reason: 'round', usedRound: 1 },
    { reason: 'attacker_inactive', cs: makeCs({ attackerHp: 0 }) },
  ];

  it.each(PRESS_REFUSALS)('refuses $reason before any roll — store byte-inert, single honest log', async ({ reason, lastAttack, cs, usedRound }) => {
    const { result, store, deps } = await press({ lastAttack, cs, usedRound });
    expect(result).toMatchObject({ resolved: false, refused: true, reason });
    expect(result.popupHtml ?? null).toBeNull();
    // Guards refuse BEFORE touching dice or store (§1035 reach-branch, MA-0681 teardown twin).
    expect(deps.rollD20).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(store.reactionUses.jinx_negate ?? 0).toBe(0);
    expect(store.latches.jinx ?? 0).toBe(0);
    expect(store.campaign.pendingJinx ?? null).toBeNull();
    expect(deps.addEntry).toHaveBeenCalledTimes(1);
    const [campaignName, entry] = deps.addEntry.mock.calls[0];
    expect(campaignName).toBe(CAMPAIGN);
    expect(entry).toMatchObject({ type: 'automation', automationType: 'jinx_refused', automationDetail: reason, characterName: HEXER });
    expect(entry.description.startsWith(`Jinx refused (${reason}):`)).toBe(true);
  });
});

describe('MA-0895 gate census — round > uses > identity > spec, RAW trigger is any attack roll', () => {
  const gateParams = (overrides = {}) => ({ lastAttack: pendingHit(), monsterName: HEXER, currentRound: 1, storedUses: {}, usedRound: 0, action: JINX_ROW, ...overrides });

  it.each([
    ['plain pending hit passes with authored spec and 999 limit', {}, true, undefined],
    ['spell-attack pendings qualify (no melee-only filter)', { lastAttack: pendingHit({ rollType: 'spell-attack' }) }, true, undefined],
    ['round-latch outranks uses AND identity', { usedRound: 1, storedUses: { jinx_negate: 999 }, lastAttack: null }, false, 'round'],
    ['uses exhaustion outranks identity', { storedUses: { jinx_negate: 999 }, lastAttack: null }, false, 'uses'],
    ['default limit is 1 when no uses/maxUses authored', { action: { name: 'Jinx', automation: { type: 'reaction', effect: 'jinx_negate', saveType: 'WIS', saveDc: 13 } }, storedUses: { jinx_negate: 1 } }, false, 'uses'],
    ['attack targeting someone else is not pending for the hexer', { lastAttack: pendingHit({ targetName: 'Bandit 2' }) }, false, 'no_pending_attack'],
    ['non-attack rollTypes never qualify', { lastAttack: pendingHit({ rollType: 'damage' }) }, false, 'no_pending_attack'],
    ['non-numeric save DC row honestly refuses (spec)', { action: { name: 'Jinx', automation: { type: 'reaction', effect: 'jinx_negate', saveType: 'WIS' } } }, false, 'spec'],
  ])('%s', (_name, overrides, ok, reason) => {
    const gate = jinxGate(gateParams(overrides));
    expect(gate.ok).toBe(ok);
    if (ok) {
      expect(gate).toMatchObject({ used: 0, limit: 999, attackerName: 'Bandit 1', spec: { saveDc: 13, saveType: 'WIS' } });
    } else {
      expect(gate.reason).toBe(reason);
      expect(gate.message).toBeTruthy();
    }
  });

  it('jinxIdentityRefusal tokens match gate reasons one-for-one', () => {
    expect(jinxIdentityRefusal(pendingHit(), HEXER)).toBeNull();
    expect(jinxIdentityRefusal(null, HEXER)).toBe('no_pending_attack');
    expect(jinxIdentityRefusal(pendingHit({ hit: false }), HEXER)).toBe('miss');
    expect(jinxIdentityRefusal(pendingHit({ actualDamage: 3 }), HEXER)).toBe('resolved');
  });
});

describe('MA-0895 press legs — attacker WIS save inline, machine-stamped, latch+spend both legs', () => {
  it('FAILED save (nat10 −5 = 5 < 13): pending-miss stamps AFTER awaited latch+spend, no popupHtml', async () => {
    const { result, store, deps } = await press({ roll: 10 });
    expect(result).toEqual({ resolved: true, success: false, saveTotal: 5, remaining: 998 });
    expect(deps.rollD20).toHaveBeenCalledTimes(1);
    // CLA-361 order: round-latch and uses spend are written BEFORE the consumer-readable
    // lastAttack.jinxPending / campaign.pendingJinx stamps, every write campaign-keyed.
    const writes = deps.setRuntimeValue.mock.calls.map(([characterKey, propertyName, , campaignName]) => ({ characterKey, propertyName, campaignName }));
    expect(writes.map(w => w.propertyName)).toEqual(['_jinx_negate_usedRound', 'monsterReactionUses', 'lastAttack', 'pendingJinx']);
    expect(writes.every(w => w.campaignName === CAMPAIGN)).toBe(true);
    const pending = store.campaign.pendingJinx;
    expect(pending).toMatchObject({ attackerName: 'Bandit 1', targetName: HEXER, by: HEXER, saveDc: 13, saveRoll: 10, saveBonus: -5, saveTotal: 5, consumed: false, attackTotal: 17, targetAc: 13 });
    expect(store.campaign.lastAttack).toMatchObject({ jinxResolved: true, jinxPending: true, jinxSaveResult: 'failure', jinxSaveTotal: 5, hit: true });
    expect(store.latches.jinx).toBe(1);
    expect(store.reactionUses.jinx_negate).toBe(1);
    const saveLog = store.logs.find(l => l.rollType === 'save');
    expect(saveLog).toMatchObject({ type: 'roll', characterName: 'Bandit 1', saveType: 'WIS', saveDc: 13, saveRoll: 10, saveBonus: -5, total: 5, saveResult: 'failure', note: 'jinx_negate_attacker_save' });
    const spendLog = store.logs.find(l => l.type === 'ability_use');
    expect(spendLog.description).toContain('FAILED');
    expect(spendLog.description).toContain('misses instead');
    expect(result.popupHtml ?? null).toBeNull();
  });

  it('SUCCESS save (+19 fold: nat4+19 = 23 ≥ 13): no pending stamp, jinx_saved — reaction still spent (RAW press-burn)', async () => {
    const { result, store } = await press({ roll: 4, cs: makeCs({ wisMod: 19 }) });
    expect(result).toEqual({ resolved: true, success: true, saveTotal: 23, remaining: 998 });
    expect(store.campaign.pendingJinx ?? null).toBeNull();
    expect(store.campaign.lastAttack).toMatchObject({ jinxResolved: true, jinxSaveResult: 'success', jinxSaveTotal: 23 });
    expect(store.campaign.lastAttack.jinxPending ?? false).toBe(false);
    expect(store.latches.jinx).toBe(1);
    expect(store.reactionUses.jinx_negate).toBe(1);
    expect(store.logs.some(l => l.automationType === 'jinx_saved' && l.description.includes('23'))).toBe(true);
    expect(result.popupHtml ?? null).toBeNull();
  });

  it('save-spec units: automation twins win, top-level save_dc/save_type fallbacks fold (#1098), §212 nested-abbrev beats ability_score_modifiers', () => {
    // save_dc fallback with NO save_type authored anywhere → documented 'WIS'
    // default (RAW Jinx is a Wisdom save — the default, never an override).
    expect(jinxSaveSpec({ save_dc: 15, automation: { type: 'reaction', effect: 'jinx_negate' } })).toEqual({ saveDc: 15, saveType: 'WIS' });
    // automation twin outranks a differing top-level twin.
    expect(jinxSaveSpec({ save_dc: 10, save_type: 'CON', automation: { type: 'reaction', effect: 'jinx_negate', saveType: 'WIS', saveDc: 13 } })).toEqual({ saveDc: 13, saveType: 'WIS' });
    // #1098 arm: non-WIS top-level save_type must NOT be silently forced to WIS.
    expect(jinxSaveSpec({ save_dc: 15, save_type: 'CON', automation: { type: 'reaction', effect: 'jinx_negate' } })).toEqual({ saveDc: 15, saveType: 'CON' });
    // spelled-out twin flows through and the save leg folds it to the abbreviation.
    const spellOut = jinxSaveSpec({ save_dc: 13, save_type: 'Wisdom', automation: { type: 'reaction', effect: 'jinx_negate' } });
    expect(spellOut).toEqual({ saveDc: 13, saveType: 'Wisdom' });
    expect(jinxSaveOutcome({ attacker: { saving_throws: { wis: { modifier: -2 }, con: { modifier: 5 } } }, spec: spellOut, rollD20: () => 10 })).toMatchObject({ modifier: -2, total: 8, success: false });
    expect(jinxSaveOutcome({ attacker: { saving_throws: { wis: { modifier: -2 }, con: { modifier: 5 } } }, spec: { saveDc: 13, saveType: 'CON' }, rollD20: () => 10 })).toMatchObject({ modifier: 5, total: 15, success: true });
    expect(jinxSaveSpec({ automation: { type: 'reaction', effect: 'jinx_negate', saveDc: 0 } })).toBeNull();
    expect(jinxSaveSpec({})).toBeNull();
    expect(attackerSaveModifier({ ability_score_modifiers: { wis: 2 } }, 'wis')).toBe(2);
    expect(attackerSaveModifier({ saving_throws: { wis: { modifier: -5 } }, ability_score_modifiers: { wis: 2 } }, 'wis')).toBe(-5);
    expect(attackerSaveModifier(null, 'wis')).toBe(0);
  });

  it('non-jinx rows never reach the spec chain — resolveMonsterJinxRow refuses not-jinx, zero writes', async () => {
    const deps = makeDeps().deps;
    const result = await resolveMonsterJinxRow({ action: banditCaptain.reactions[0], monsterName: 'Bandit Captain 1', campaignName: CAMPAIGN, lastAttack: pendingHit({ targetName: 'Bandit Captain 1' }), cs: makeCs(), currentRound: 1, storedUses: {}, usedRound: 0, latchKey: '_jinx_negate_usedRound', deps });
    expect(result).toEqual({ resolved: false, reason: 'not-jinx' });
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.addEntry).not.toHaveBeenCalled();
  });
});

describe('MA-0895 resolve consumer — Done converts the stamped pending hit to a MISS before damage', () => {
  const armedPending = () => ({
    attackerName: 'Bandit 1',
    targetName: HEXER,
    by: HEXER,
    attackName: 'Scimitar',
    saveType: 'WIS',
    saveDc: 13,
    saveRoll: 10,
    saveBonus: -5,
    saveTotal: 5,
    attackTotal: 17,
    targetAc: 13,
    lastAttackNonce: 'Scimitar:14:17',
    consumed: false,
  });

  function consumeSetup({ pending = armedPending(), lastAttack = pendingHit() } = {}) {
    const store = { campaign: { pendingJinx: pending, lastAttack }, logs: [] };
    const deps = {
      getRuntimeValue: vi.fn((characterKey, propertyName) => (propertyName === 'pendingJinx' || propertyName === 'lastAttack') ? store.campaign[propertyName] : undefined),
      setRuntimeValue: vi.fn((characterKey, propertyName, value) => { store.campaign[propertyName] = value; return Promise.resolve(); }),
      addEntry: vi.fn((campaignName, entry) => { store.logs.push(entry); return Promise.resolve(); }),
    };
    return { store, deps };
  }

  it('matching Done: lastAttack rewritten hit:false + jinx_negated + zero damage over preserved roll bytes, pending cleared, popup honest', async () => {
    const { store, deps } = consumeSetup();
    const context = { attackerName: 'Bandit 1', targetName: HEXER, attackName: 'Scimitar', damageType: 'Slashing' };
    const outcome = await consumePendingJinxOnResolve(CAMPAIGN, context, deps);
    expect(outcome.negated).toBe(true);
    expect(store.campaign.pendingJinx).toBeNull();
    expect(store.campaign.lastAttack).toMatchObject({
      hit: false, jinx_negated: true, negatedBy: HEXER, jinxSaveResult: 'failure', jinxSaveTotal: 5,
      actualDamage: 0, damageApplied: false,
      // merge preserves the original attack roll bytes the popup still shows.
      attackerName: 'Bandit 1', targetName: HEXER, attackName: 'Scimitar', d20: 14, total: 17, targetAc: 13,
    });
    expect(store.logs.some(l => l.automationType === 'jinx_attack_negated' && l.description.includes('NEGATED'))).toBe(true);
    expect(outcome.popupData).toMatchObject({ type: 'auto-miss', computedHit: false, name: 'Scimitar', targetName: HEXER, jinxNegated: true, finalDamage: 0, note: 'attack negated — Jinx' });
  });

  it.each([
    ['no armed pending', null, { attackerName: 'Bandit 1', targetName: HEXER }],
    ['already-consumed pending', { ...armedPending(), consumed: true }, { attackerName: 'Bandit 1', targetName: HEXER }],
    ['attacker mismatch', armedPending(), { attackerName: 'Bandit 2', targetName: HEXER }],
    ['target mismatch', armedPending(), { attackerName: 'Bandit 1', targetName: 'Bandit 2' }],
  ])('byte-inert with %s: null, zero writes, zero logs', async (_name, pending, context) => {
    const { store, deps } = consumeSetup({ pending });
    const before = store.campaign.lastAttack;
    expect(await consumePendingJinxOnResolve(CAMPAIGN, context, deps)).toBeNull();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(store.logs).toHaveLength(0);
    expect(store.campaign.lastAttack).toBe(before);
  });

  // Owner ruling (a) 2026-10-30 (CLOSED-RULING, app-exploration backlog): the
  // identity contract is (attackerName, targetName), NEVER the stamped nonce —
  // a stale pendingJinx riding the next same-attacker same-hexer resolve is
  // the ACCEPTED next-swing contract (redirect twin monsterRedirectAttack.js
  // :258-264; redirect ride pinned in monsterRedirectAttack.test.js). These
  // legs lock BOTH faces: the ride works, and mis-apply beyond the tuple is
  // impossible (attacker/target inert table above).
  it('ruling (a) next-swing ride: a stale stamp (nonce Scimitar:14:17) negates the NEXT same-attacker same-hexer resolve even on divergent roll bytes (fresh d20 8/total 11) — nonce is forensic, identity is the tuple', async () => {
    const { store, deps } = consumeSetup();
    // The original popup died unpressed (abandoned attack); a FRESH swing of
    // the same attacker at the same hexer resolves Done through handlePlainDamage.
    store.campaign.lastAttack = pendingHit({ d20: 8, total: 11, jinxResolved: true, jinxPending: true });
    const context = { attackerName: 'Bandit 1', targetName: HEXER, attackName: 'Scimitar', damageType: 'Slashing' };
    const outcome = await consumePendingJinxOnResolve(CAMPAIGN, context, deps);
    expect(outcome.negated).toBe(true);
    expect(store.campaign.pendingJinx).toBeNull();
    // The miss merges over the NEW swing's preserved roll bytes (d20 8/total 11).
    expect(store.campaign.lastAttack).toMatchObject({
      hit: false, jinx_negated: true, negatedBy: HEXER, actualDamage: 0, damageApplied: false,
      attackerName: 'Bandit 1', targetName: HEXER, d20: 8, total: 11,
    });
    expect(store.logs.some(l => l.automationType === 'jinx_attack_negated')).toBe(true);
  });

  it('one-shot apply: the ride consumes itself — a nulled stamp makes the second resolve byte-inert (no double-negation off one jinx)', async () => {
    const { store, deps } = consumeSetup();
    const context = { attackerName: 'Bandit 1', targetName: HEXER, attackName: 'Scimitar', damageType: 'Slashing' };
    expect((await consumePendingJinxOnResolve(CAMPAIGN, context, deps)).negated).toBe(true);
    const writesAfterFirst = deps.setRuntimeValue.mock.calls.length;
    const logsAfterFirst = store.logs.length;
    expect(await consumePendingJinxOnResolve(CAMPAIGN, context, deps)).toBeNull();
    expect(deps.setRuntimeValue.mock.calls).toHaveLength(writesAfterFirst);
    expect(store.logs).toHaveLength(logsAfterFirst);
    expect(store.campaign.pendingJinx).toBeNull();
  });
});

describe('MA-0895 dispatcher — the jinx_negate arm routes through the pending window', () => {
  it('failed save resolves via resolveMonsterGatedReaction and arms pendingJinx (chip press, not the generic save chip)', async () => {
    const lastAttack = pendingHit();
    const store = { campaign: { lastAttack }, logs: [] };
    const deps = {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => makeCs()),
      rollD20: vi.fn(() => 10),
      getRuntimeValue: vi.fn((characterKey, propertyName) => {
        if (propertyName === 'monsterReactionUses') return {};
        if (propertyName === 'pendingJinx') return store.campaign.pendingJinx ?? null;
        return null;
      }),
      setRuntimeValue: vi.fn(async (characterKey, propertyName, value) => {
        if (propertyName === 'monsterReactionUses') store.reactionUses = value;
        if (propertyName === '_jinx_negate_usedRound') store.latches = { jinx: value };
        if (characterKey === 'campaign') store.campaign[propertyName] = value;
      }),
      addEntry: vi.fn(async (campaignName, entry) => { store.logs.push(entry); }),
    };
    const result = await resolveMonsterGatedReaction({ action: JINX_ROW, monsterName: HEXER, campaignName: CAMPAIGN, deps });
    expect(result).toMatchObject({ resolved: true, success: false, saveTotal: 5, remaining: 998 });
    expect(store.campaign.pendingJinx).toMatchObject({ attackerName: 'Bandit 1', targetName: HEXER, consumed: false });
    expect(store.campaign.lastAttack).toMatchObject({ jinxPending: true, hit: true });
    expect(store.latches.jinx).toBe(1);
    expect(store.reactionUses.jinx_negate).toBe(1);
  });
});
