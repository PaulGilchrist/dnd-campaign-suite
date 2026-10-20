// @maintained-by-ai
// MA-1488 lane: Spectator "Spell Reflection" gated reaction — disk row
// automation {type:"reaction", effect:"spell_reflection", dcSuccess:"none"}
// arms the chip; press runs round-latch → two-faced spell identity → uses →
// caster-active → latch+spend AWAITED (CLA-361) → caster DEX save vs DC 12
// (createSaveListener seam, cites conditionSaveService CANON #1005) → 3d6
// Force, computeDamageAfterSave 'none' pays ZERO on success (MV-20 half-leak
// kill) → lastAttack identity stamp → spend log. Refusals log-only, popupHtml
// NEVER, zero-write (§235d).
//
// Cites: two-faced trigger is THIS file's contract (target-swap/redirect
// semantics own #1000; absorption-vs-reflection axis owned archlich #1087 —
// verified distinct, its disk row has NO automation and is used here only as
// a loud byte-inert decoy #948). thunderbird #2018 owns the advisory-decoy
// shape; getGatedMonsterReaction(spell_reflection) arm-key owned HERE.
// Round-latch-before-identity order cites turnState seams #1070/#0013 shape
// (round is a round counter, never wall-clock — no timers, per app MANDATE).
// Refusal-zero-write census is the #1133 exemplar shape; stamp re-press
// double-fire refusal is the store-backed replaces-not-stacks #949 shape;
// attacker-vs-caster identity distinguishability #1022/#1036 shape.
//
// old → new map (11 → 6):
//  old1 disk-byte-pin + old2 chip-arm + old3 spec-read → T1 row/arms/spec
//  old4 both-faces-accept → T3 (fold-press + alt spell-origin stamps)
//  old5 non-trigger-refusals + old6 gate-order + old9 refusal-zero-spend → T4 it.each census
//  old7 miss-full-press → T2 | old8 save-success-zero → T3
//  old10 re-press-reacted → T5 | old11 byte-inert → T6 (+archlich decoy)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMonsterSpellReflectionRow,
  spellReflectionIdentityRefusal,
  spellReflectionSpec,
  resolveMonsterSpellReflectionRow,
} from './monsterSpellReflection.js';
import { getGatedMonsterReaction } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
import { setRuntimeValue as moduleSetRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry as moduleAddEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const SPECTATOR = 'Spectator 1';
const CASTER = 'AberrantSorcerer';
const LATCH_KEY = '_spell_reflection_usedRound';

// Disk rows BY NAME, programmatic (#1086): the spectator row is the contract,
// the archlich "Spell Absorption" row (distinct mechanic #1087, no automation
// on disk) is the near-miss decoy.
const REFLECT_ROW = monstersData.find(m => m.index === 'spectator').reactions.find(r => r.name === 'Spell Reflection');
const ABSORPTION_DECOY = monstersData.find(m => m.index === 'archlich').reactions.find(r => r.name === 'Spell Absorption');

function spellAttackMiss({ targetName = SPECTATOR, attackerName = CASTER, ...rest } = {}) {
  return {
    rollType: 'spell-attack',
    attackerName,
    targetName,
    attackName: 'Fire Bolt',
    d20: 5,
    bonus: 6,
    total: 11,
    targetAc: 14,
    hit: false,
    damageSchool: 'evocation',
    timestamp: 1,
    ...rest,
  };
}

function spellSaveSuccess({ targetName = SPECTATOR, attackerName = CASTER, ...rest } = {}) {
  return {
    rollType: 'spell-save',
    attackerName,
    targetName,
    attackName: 'Fireball',
    saveType: 'DEX',
    saveDc: 12,
    saveResult: 'success',
    damageSchool: 'evocation',
    timestamp: 1,
    ...rest,
  };
}

function makeCs({ casterActive = true } = {}) {
  return {
    round: 3,
    creatures: [
      { name: SPECTATOR, type: 'npc', size: 'Medium', currentHp: 45 },
      { name: CASTER, type: 'player', currentHp: casterActive ? 41 : 0 },
    ],
  };
}

function makeDeps() {
  const store = { latches: {}, uses: {}, campaign: {}, logs: [] };
  const setRV = vi.fn((key, prop, value) => {
    if (prop === LATCH_KEY) store.latches[key] = value;
    if (prop === 'monsterReactionUses') store.uses[key] = value;
    if (key === 'campaign') store.campaign[prop] = value;
    return Promise.resolve();
  });
  const log = vi.fn((campaign, entry) => { store.logs.push(entry); return Promise.resolve(); });
  const createSaveListener = vi.fn((campaign, config) => ({
    promptId: 'p1',
    promise: Promise.resolve({ success: false, roll: 4, saveBonus: 0, total: 4, saveDc: config.saveDc, saveType: config.saveType }),
  }));
  const rollExpression = vi.fn(() => ({ total: 11, rolls: [3, 4, 4] }));
  const applyDamageToTarget = vi.fn(() => Promise.resolve({ ok: true }));
  return { store, setRV, log, createSaveListener, rollExpression, applyDamageToTarget };
}

function resolveCall(deps = makeDeps()) {
  const call = (lastAttack, { cs = makeCs(), currentRound = 3, storedUses = {}, usedRound = 2, saveSuccess = false, action = REFLECT_ROW } = {}) => {
    deps.createSaveListener.mockImplementationOnce((campaign, config) => ({
      promptId: 'p1',
      promise: Promise.resolve({ success: saveSuccess, roll: saveSuccess ? 16 : 4, saveBonus: 0, total: saveSuccess ? 16 : 4, saveDc: config.saveDc, saveType: config.saveType }),
    }));
    return resolveMonsterSpellReflectionRow({
      action,
      monsterName: SPECTATOR,
      campaignName: CAMPAIGN,
      lastAttack,
      cs,
      currentRound,
      storedUses,
      usedRound,
      latchKey: LATCH_KEY,
      deps: { setRuntimeValue: deps.setRV, addEntry: deps.log, createSaveListener: deps.createSaveListener, rollExpression: deps.rollExpression, applyDamageToTarget: deps.applyDamageToTarget },
    });
  };
  return { ...deps, call };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-1488 disk row arms the gated chip', () => {
  it('disk row carries the effect-keyed automation, dc_success "none" half-leak kill, and spec numerics the press reads', () => {
    expect(REFLECT_ROW.automation).toMatchObject({ type: 'reaction', trigger: 'spell_miss_or_save_success', effect: 'spell_reflection' });
    expect(REFLECT_ROW.automation.dcSuccess).toBe('none'); // the old default "half" is the MV-20 leak
    expect(spellReflectionSpec(REFLECT_ROW).spec).toEqual({ saveDc: 12, formula: '3d6', saveType: 'DEX', damageType: 'Force', dcSuccess: 'none' });
    expect(REFLECT_ROW.usage).toBe('At Will');
    expect(REFLECT_ROW.uses).toBe(999);

    expect(isMonsterSpellReflectionRow(REFLECT_ROW)).toBe(true);
    expect(isMonsterSpellReflectionRow({ name: 'Spell Reflection' })).toBe(false); // pre-fix ungated save-shell shape must NOT arm
    expect(isMonsterSpellReflectionRow(ABSORPTION_DECOY)).toBe(false); // archlich absorption is a distinct mechanic #1087

    expect(getGatedMonsterReaction(REFLECT_ROW)).toEqual({ effect: 'spell_reflection', trigger: 'spell_miss_or_save_success', label: 'Spell Reflection', icon: 'fa-arrows-turn-right' });
    expect(getGatedMonsterReaction({ name: 'Spell Reflection' })).toBeNull();

    expect(spellReflectionSpec({ automation: { type: 'reaction', effect: 'spell_reflection', damageExpression: '3d6' } }).reason).toBe('spec'); // never a baked DC
    expect(spellReflectionSpec({ automation: { type: 'reaction', effect: 'spell_reflection', save_dc: 12 } }).reason).toBe('spec'); // never a baked formula
  });
});

describe('MA-1488 press flow', () => {
  it('miss face + FAILED save: pre-resolve latch+spend, caster DEX prompt vs DC 12 dc_success none, full 3d6 hp_change, identity stamp, spend log, popupHtml never', async () => {
    const { store, call, createSaveListener, applyDamageToTarget } = resolveCall();
    const result = await call(spellAttackMiss());
    expect(result.ok).toBe(true);
    expect(result.saveSuccess).toBe(false);
    expect(result.finalDamage).toBe(11);
    expect(result.remaining).toBe(998);

    expect(createSaveListener.mock.calls[0][1]).toMatchObject({ targetName: CASTER, attackerName: SPECTATOR, saveType: 'DEX', saveDc: 12, dcSuccess: 'none', damageFormula: '3d6', damageType: 'Force', sourceName: 'Spell Reflection' });

    expect(store.latches[SPECTATOR]).toBe(3);
    expect(store.uses[SPECTATOR].spell_reflection).toBe(1);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][1]).toBe(CASTER);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(11);

    expect(store.campaign.lastAttack).toMatchObject({ spellReflectionResolved: true, reflectedBy: SPECTATOR, reflectionTarget: CASTER, reflectionSaveSuccess: false, reflectionDamage: 11 });
    expect(store.logs.some(l => l.type === 'roll' && l.rollType === 'damage' && l.name === 'Spell Reflection Damage')).toBe(true);
    expect(store.logs.some(l => l.type === 'ability_use' && l.characterName === SPECTATOR)).toBe(true);
    expect(store.logs.every(l => l.popupHtml === undefined)).toBe(true);
  });

  it('save SUCCESS pays ZERO (top-level face and AoE targetResults fold) — spend still honest, no dice applied', async () => {
    const top = resolveCall();
    const r1 = await top.call(spellSaveSuccess(), { saveSuccess: true });
    expect(r1.ok).toBe(true);
    expect(r1.saveSuccess).toBe(true);
    expect(r1.finalDamage).toBe(0);
    expect(top.applyDamageToTarget).not.toHaveBeenCalled();
    expect(top.store.uses[SPECTATOR].spell_reflection).toBe(1);
    expect(top.store.campaign.lastAttack).toMatchObject({ reflectionSaveSuccess: true, reflectionDamage: 0 });
    const rollLog = top.store.logs.find(l => l.type === 'roll' && l.rollType === 'damage');
    expect(rollLog.description).toContain('SUCCEEDED');
    expect(rollLog.description).toContain('0 damage');

    // AoE twin (§893 fold): Fireball aimed at the party, spectator folds save.
    const aoe = resolveCall();
    const r2 = await aoe.call(spellSaveSuccess({ targetName: 'Party of 4', saveResult: undefined, targetResults: [{ targetName: 'Bandit 1', saveResult: 'failure' }, { targetName: SPECTATOR, saveResult: 'success' }] }), { saveSuccess: true });
    expect(r2.ok).toBe(true);
    expect(r2.finalDamage).toBe(0);
    expect(aoe.applyDamageToTarget).not.toHaveBeenCalled();

    // Alt spell-origin stamps (byte-mirror OR faces) are admitted too.
    expect(spellReflectionIdentityRefusal({ attackType: 'spell', targetName: SPECTATOR, hit: false, attackerName: CASTER }, SPECTATOR)).toBeNull();
    expect(spellReflectionIdentityRefusal({ rollType: 'attack', damageSchool: 'necrotic', targetName: SPECTATOR, hit: false, attackerName: CASTER }, SPECTATOR)).toBeNull();
  });

  it.each([
    { name: 'nothing pending', lastAttack: null, ctx: {}, reason: 'no_pending_attack' },
    { name: 'weapon-form attack', lastAttack: { rollType: 'attack', targetName: SPECTATOR, hit: false, attackerName: CASTER }, ctx: {}, reason: 'spell' }, // admit-gate: only spell-origin answers
    { name: 'spell aimed elsewhere', lastAttack: spellAttackMiss({ targetName: 'Bandit 1' }), ctx: {}, reason: 'trigger' },
    { name: 'spell hit', lastAttack: spellAttackMiss({ hit: true, actualDamage: 7 }), ctx: {}, reason: 'outcome' },
    { name: 'save failed', lastAttack: spellSaveSuccess({ saveResult: 'failure' }), ctx: {}, reason: 'outcome' },
    { name: 'AoE fold failed', lastAttack: spellSaveSuccess({ targetName: 'Party of 4', saveResult: undefined, targetResults: [{ targetName: SPECTATOR, saveResult: 'failure' }] }), ctx: {}, reason: 'outcome' },
    { name: 'self-targeted spell', lastAttack: spellAttackMiss({ attackerName: SPECTATOR }), ctx: {}, reason: 'attacker' },
    { name: 'already reacted', lastAttack: spellAttackMiss({ spellReflectionResolved: true }), ctx: {}, reason: 'reacted' },
    { name: 'round latch outranks identity', lastAttack: null, ctx: { usedRound: 3 }, reason: 'round' }, // round-first, MA-0013 seam order #1070
    { name: 'uses exhausted', lastAttack: spellAttackMiss(), ctx: { storedUses: { spell_reflection: 999 } }, reason: 'uses' },
    { name: 'caster inactive', lastAttack: spellAttackMiss(), ctx: { cs: makeCs({ casterActive: false }) }, reason: 'caster_inactive' },
    { name: 'row missing spec numerics', lastAttack: spellAttackMiss(), ctx: { action: { name: 'Spell Reflection', automation: { type: 'reaction', effect: 'spell_reflection', damageExpression: '3d6' } } }, reason: 'spec' },
  ])('refusal — $name: log-only $reason, ZERO write (no latch, no spend, no stamp, no prompt)', async ({ lastAttack, ctx, reason }) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, call, setRV, createSaveListener } = resolveCall();
    const result = await call(lastAttack, ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(reason);
    expect(result.popupHtml).toBeUndefined();

    expect(setRV).not.toHaveBeenCalled(); // latch/uses/stamp all untouched
    expect(store.latches[SPECTATOR]).toBeUndefined();
    expect(store.uses[SPECTATOR]).toBeUndefined();
    expect(createSaveListener).not.toHaveBeenCalled();

    expect(store.logs).toHaveLength(1);
    expect(store.logs[0]).toMatchObject({ type: 'automation', automationType: 'spell_reflection_refused', automationDetail: reason, characterName: SPECTATOR });
    expect(store.logs[0].popupHtml).toBeUndefined();
    expect(store.logs.every(l => l.popupHtml === undefined)).toBe(true);
    errSpy.mockRestore();
  });

  it('re-press of the stamped lastAttack refuses reacted even on a fresh round — spend stays at 1 (#949 replaces-not-stacks)', async () => {
    const { store, call } = resolveCall();
    const first = await call(spellAttackMiss());
    expect(first.ok).toBe(true);
    // Production re-reads the campaign lastAttack — the resolved stamp rides it.
    const second = await call({ ...store.campaign.lastAttack }, { currentRound: 4, usedRound: 3 });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('reacted');
    expect(store.uses[SPECTATOR].spell_reflection).toBe(1);
  });

  it('non-reflection rows are byte-inert through the resolver and never touch default transports', async () => {
    const bite = await resolveMonsterSpellReflectionRow({ action: { name: 'Bite' }, monsterName: SPECTATOR, campaignName: CAMPAIGN, lastAttack: spellAttackMiss(), cs: makeCs(), currentRound: 3, storedUses: {}, usedRound: 2, latchKey: LATCH_KEY, deps: {} });
    expect(bite).toEqual({ resolved: false, reason: 'not-spell-reflection' });

    const absorption = await resolveMonsterSpellReflectionRow({ action: ABSORPTION_DECOY, monsterName: 'Archlich', campaignName: CAMPAIGN, lastAttack: spellAttackMiss({ attackerName: SPECTATOR }), cs: makeCs(), currentRound: 3, storedUses: {}, usedRound: 2, latchKey: LATCH_KEY, deps: {} });
    expect(absorption).toEqual({ resolved: false, reason: 'not-spell-reflection' });

    expect(moduleSetRuntimeValue).not.toHaveBeenCalled();
    expect(moduleAddEntry).not.toHaveBeenCalled();
  });
});
