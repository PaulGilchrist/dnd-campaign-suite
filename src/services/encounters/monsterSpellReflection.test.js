// MA-1488: Spectator "Spell Reflection" (reactions[0]) — formerly the
// ungated generic save-shell chip (MA-128): save_dc:12 armed an ActionSaveRoll
// press ANY time, spent NOTHING, and the dc_success default "half" leaked
// floor(roll/2) Force damage on a saving-throw SUCCESS the RAW answers with
// silence (live repro pre-fix: no pending spells, "✓ SAVE SUCCESS (16 vs DC
// 12) — 6 damage applied to Bandit 1 — HP: 11 → 5"). Fix: automation
// {type:"reaction", trigger:"spell_miss_or_save_success",
// effect:"spell_reflection", dcSuccess:"none", damageExpression:"3d6"} +
// usage:"At Will"/uses:999 authored on disk arms the gated chip
// (GATED_MONSTER_REACTIONS) whose press runs: round-latch gate FIRST
// (MA-0013 latch shape), two-faced spell-origin identity probe on the
// campaign lastAttack (isSpellOriginLastAttack MA-0013 seam; miss face
// hit:false MA-0245, save-success face saveResult:'success' MA-0816 +
// targetResults fold §893), uses gate, caster-active check, then latch+spend
// AWAITED (CLA-361, spend-every-press shield/jinx shape) → the CASTING
// creature's DEX save vs DC 12 rides the createSaveListener prompt seam
// (hellish_rebuke MA-0725) → 3d6 Force logged honestly → computeDamageAfterSave
// 'none' (fail full / success ZERO — the MV-20 half-leak kill) →
// applyDamageToTarget hp_change only when > 0 → lastAttack
// spellReflectionResolved stamp → ability_use spend log. Refusals are log-only
// (§235d), popupHtml NEVER. The generic ActionSaveRoll chip is suppressed on
// gated rows (MonsterAction.jsx sole-press fork, MA-0694 precedent).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSpellReflectionRow,
  spellOriginLastAttack,
  spellReflectionIdentityRefusal,
  spellReflectionGate,
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

const CAMPAIGN = 'test-campaign';
const SPECTATOR = 'Spectator 1';
const CASTER = 'AberrantSorcerer';
const LATCH_KEY = '_spell_reflection_usedRound';

const spectator = monstersData.find(m => m.index === 'spectator');
const REFLECT_ROW = spectator.reactions[0];

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
    promise: Promise.resolve({ success: config.__saveSuccess === true, roll: 16, saveBonus: 0, total: 16, saveDc: config.saveDc, saveType: config.saveType }),
  }));
  const rollExpression = vi.fn(() => ({ total: 11, rolls: [3, 4, 4] }));
  const applyDamageToTarget = vi.fn(() => Promise.resolve({ ok: true }));
  return { store, setRV, log, createSaveListener, rollExpression, applyDamageToTarget };
}

function resolveCall(deps = makeDeps()) {
  const call = (lastAttack, { cs = makeCs(), currentRound = 3, usedRound = 2, storedUses = {}, saveSuccess = false } = {}) => {
    deps.createSaveListener.mockImplementationOnce((campaign, config) => ({
      promptId: 'p1',
      promise: Promise.resolve({ success: saveSuccess, roll: saveSuccess ? 16 : 4, saveBonus: 0, total: saveSuccess ? 16 : 4, saveDc: config.saveDc, saveType: config.saveType }),
    }));
    return resolveMonsterSpellReflectionRow({
      action: REFLECT_ROW,
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

describe('MA-1488 disk row + registry arm', () => {
  it('pins the spectator Spell Reflection automation byte-shape (dc_success none half-leak kill)', () => {
    expect(REFLECT_ROW.name).toBe('Spell Reflection');
    expect(REFLECT_ROW.trigger).toBe("The spectator succeeds on a saving throw against a spell, or a spell's attack roll misses it.");
    expect(REFLECT_ROW.description).toBe('Dexterity Saving Throw: DC 12, one creature the spectator can see within 120 feet. Failure: 10 (3d6) Force damage.');
    expect(REFLECT_ROW.save_dc).toBe(12);
    expect(REFLECT_ROW.save_type).toBe('Dexterity');
    expect(REFLECT_ROW.dc_success).toBe('none');
    expect(REFLECT_ROW.save_effect).toBe('The target takes 10 (3d6) Force damage.');
    expect(REFLECT_ROW.usage).toBe('At Will');
    expect(REFLECT_ROW.uses).toBe(999);
    expect(REFLECT_ROW.maxUses).toBe(999);
    expect(REFLECT_ROW.automation).toEqual({
      type: 'reaction',
      trigger: 'spell_miss_or_save_success',
      effect: 'spell_reflection',
      saveType: 'DEX',
      saveDc: 12,
      dcSuccess: 'none',
      damageExpression: '3d6',
      damageType: 'Force',
    });
    expect(isMonsterSpellReflectionRow(REFLECT_ROW)).toBe(true);
    expect(isMonsterSpellReflectionRow({ name: 'Spell Reflection' })).toBe(false);
  });

  it('arms the gated chip via getGatedMonsterReaction (effect-keyed lookup)', () => {
    expect(getGatedMonsterReaction(REFLECT_ROW)).toEqual({ effect: 'spell_reflection', trigger: 'spell_miss_or_save_success', label: 'Spell Reflection', icon: 'fa-arrows-turn-right' });
    expect(getGatedMonsterReaction({ name: 'Spell Reflection' })).toBeNull();
  });

  it('spec read honors the authored numerics, refuses rows without them', () => {
    expect(spellReflectionSpec(REFLECT_ROW).spec).toEqual({ saveDc: 12, formula: '3d6', saveType: 'DEX', damageType: 'Force', dcSuccess: 'none' });
    expect(spellReflectionSpec({ name: 'x' }).reason).toBe('spec');
    expect(spellReflectionSpec({ save_dc: 12 }).reason).toBe('spec');
  });
});

describe('MA-1488 spell-origin identity probe', () => {
  it('accepts BOTH RAW trigger faces: spell attack miss and save success', () => {
    expect(spellOriginLastAttack(spellAttackMiss())).toBe(true);
    expect(spellReflectionIdentityRefusal(spellAttackMiss(), SPECTATOR)).toBeNull();
    expect(spellReflectionIdentityRefusal(spellSaveSuccess(), SPECTATOR)).toBeNull();
    expect(spellReflectionIdentityRefusal(spellSaveSuccess({ saveResult: undefined, targetResults: [{ targetName: SPECTATOR, saveResult: 'success' }] }), SPECTATOR)).toBeNull();
  });

  it('refuses every non-trigger: nothing pending, non-spell, wrong target, hit+failed-save, self, reacted', () => {
    expect(spellReflectionIdentityRefusal(null, SPECTATOR)).toBe('no_pending_attack');
    expect(spellReflectionIdentityRefusal({ rollType: 'attack', targetName: SPECTATOR, hit: false, attackerName: CASTER }, SPECTATOR)).toBe('spell');
    expect(spellReflectionIdentityRefusal(spellAttackMiss({ targetName: 'Bandit 1' }), SPECTATOR)).toBe('trigger');
    expect(spellReflectionIdentityRefusal(spellAttackMiss({ hit: true }), SPECTATOR)).toBe('outcome');
    expect(spellReflectionIdentityRefusal(spellSaveSuccess({ saveResult: 'failure' }), SPECTATOR)).toBe('outcome');
    expect(spellReflectionIdentityRefusal(spellAttackMiss({ attackerName: SPECTATOR }), SPECTATOR)).toBe('attacker');
    expect(spellReflectionIdentityRefusal(spellAttackMiss({ spellReflectionResolved: true }), SPECTATOR)).toBe('reacted');
  });

  it('round latch refuses before identity; uses gate and caster identity ride out of the gate', () => {
    const latched = spellReflectionGate({ lastAttack: spellAttackMiss(), monsterName: SPECTATOR, currentRound: 3, storedUses: {}, usedRound: 3, action: REFLECT_ROW });
    expect(latched.ok).toBe(false);
    expect(latched.reason).toBe('round');
    const spent = spellReflectionGate({ lastAttack: spellAttackMiss(), monsterName: SPECTATOR, currentRound: 3, storedUses: { spell_reflection: 999 }, usedRound: 2, action: REFLECT_ROW });
    expect(spent.ok).toBe(false);
    expect(spent.reason).toBe('uses');
    const ok = spellReflectionGate({ lastAttack: spellAttackMiss(), monsterName: SPECTATOR, currentRound: 3, storedUses: { spell_reflection: 4 }, usedRound: 2, action: REFLECT_ROW });
    expect(ok.ok).toBe(true);
    expect(ok.used).toBe(4);
    expect(ok.limit).toBe(999);
    expect(ok.casterName).toBe(CASTER);
  });
});

describe('MA-1488 resolver press', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('miss face + failed save: latch+spend AWAITED, caster save prompt vs DC 12, FULL 3d6 Force hp_change, identity stamp, spend log, NO popupHtml', async () => {
    const { store, call, createSaveListener, applyDamageToTarget } = resolveCall();
    const result = await call(spellAttackMiss());
    expect(result.ok).toBe(true);
    expect(result.message).toContain('FAILED');
    expect(result.saveSuccess).toBe(false);
    expect(result.finalDamage).toBe(11);
    expect(result.remaining).toBe(998);

    const prompt = createSaveListener.mock.calls[0][1];
    expect(prompt).toMatchObject({ targetName: CASTER, attackerName: SPECTATOR, saveType: 'DEX', saveDc: 12, dcSuccess: 'none', damageFormula: '3d6', damageType: 'Force', sourceName: 'Spell Reflection' });

    expect(store.latches[SPECTATOR]).toBe(3);
    expect(store.uses[SPECTATOR].spell_reflection).toBe(1);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][1]).toBe(CASTER);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(11);

    expect(store.campaign.lastAttack.spellReflectionResolved).toBe(true);
    expect(store.campaign.lastAttack.reflectedBy).toBe(SPECTATOR);
    expect(store.campaign.lastAttack.reflectionTarget).toBe(CASTER);
    expect(store.campaign.lastAttack.reflectionSaveSuccess).toBe(false);
    expect(store.campaign.lastAttack.reflectionDamage).toBe(11);

    expect(store.logs.some(l => l.type === 'roll' && l.rollType === 'damage' && l.name === 'Spell Reflection Damage')).toBe(true);
    expect(store.logs.some(l => l.type === 'ability_use' && l.characterName === SPECTATOR)).toBe(true);
    expect(store.logs.every(l => l.popupHtml === undefined)).toBe(true);
  });

  it('save SUCCESS pays ZERO — MV-20 half-leak kill: no dice applied, spend still honest', async () => {
    const { store, call, applyDamageToTarget } = resolveCall();
    const result = await call(spellSaveSuccess(), { saveSuccess: true });
    expect(result.ok).toBe(true);
    expect(result.saveSuccess).toBe(true);
    expect(result.finalDamage).toBe(0);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(store.uses[SPECTATOR].spell_reflection).toBe(1);
    expect(store.campaign.lastAttack.reflectionSaveSuccess).toBe(true);
    expect(store.campaign.lastAttack.reflectionDamage).toBe(0);
    const rollLog = store.logs.find(l => l.type === 'roll' && l.rollType === 'damage');
    expect(rollLog.description).toContain('SUCCEEDED');
    expect(rollLog.description).toContain('0 damage');
  });

  it('refusals are log-only and zero-spend: no_pending_attack, spell, outcome, round, caster_inactive', async () => {
    const noPending = resolveCall();
    const r1 = await noPending.call(null);
    expect(r1.ok).toBe(false);
    expect(r1.reason).toBe('no_pending_attack');
    expect(r1.popupHtml).toBeUndefined();
    expect(noPending.store.logs[0].description).toContain('nothing to reflect');
    expect(noPending.store.logs[0].automationType).toBe('spell_reflection_refused');
    expect(noPending.store.logs[0].automationDetail).toBe('no_pending_attack');
    expect(noPending.store.latches[SPECTATOR]).toBeUndefined();
    expect(noPending.store.uses[SPECTATOR]).toBeUndefined();
    expect(noPending.createSaveListener).not.toHaveBeenCalled();

    const weapon = resolveCall();
    expect((await weapon.call({ rollType: 'attack', targetName: SPECTATOR, hit: false, attackerName: CASTER })).reason).toBe('spell');

    const notTrigger = resolveCall();
    expect((await notTrigger.call(spellAttackMiss({ hit: true, actualDamage: 7 }))).reason).toBe('outcome');

    const latched = resolveCall();
    expect((await latched.call(spellAttackMiss(), { usedRound: 3 })).reason).toBe('round');
    expect(latched.store.uses[SPECTATOR]).toBeUndefined();

    const gone = resolveCall();
    expect((await gone.call(spellAttackMiss(), { cs: makeCs({ casterActive: false }) })).reason).toBe('caster_inactive');
    expect(gone.store.uses[SPECTATOR]).toBeUndefined();
    expect(gone.createSaveListener).not.toHaveBeenCalled();
  });

  it('same lastAttack re-press refuses reacted with zero spend even on a fresh round', async () => {
    const { store, call } = resolveCall();
    const first = await call(spellAttackMiss());
    expect(first.ok).toBe(true);
    // Production re-reads the campaign lastAttack — the resolved stamp rides it.
    const second = await call({ ...store.campaign.lastAttack }, { currentRound: 4, usedRound: 3 });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('reacted');
    expect(store.uses[SPECTATOR].spell_reflection).toBe(1);
  });

  it('non-reflection rows never consume: byte-inert guard', async () => {
    const { call, createSaveListener } = resolveCall();
    const result = await resolveMonsterSpellReflectionRow({ action: { name: 'Bite' }, monsterName: SPECTATOR, campaignName: CAMPAIGN, lastAttack: spellAttackMiss(), cs: makeCs(), currentRound: 3, storedUses: {}, usedRound: 2, latchKey: LATCH_KEY, deps: {} });
    expect(result).toEqual({ resolved: false, reason: 'not-spell-reflection' });
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(call).toBeDefined();
  });
});
