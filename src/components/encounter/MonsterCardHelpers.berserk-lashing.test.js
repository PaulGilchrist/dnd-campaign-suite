// @maintained-by-ai
// MA-0516 helper lane: Berserk Lashing attack-reaction truth-table owner —
// attackReactionIdentityRefusal (MonsterCardHelpers.js:2481), attackReactionGate (:2501),
// attackReactionSlamRow (:2523), attackReactionFoldCheck (:2528, fix#39 strict-presence
// bonus guard), attackReactionFireCheck (:2551), resolveMonsterAttackReaction (:2588)
// via the dispatcher attack arm (:2314), registry row (:1399). Disk fixtures BY NAME
// verbatim (#387): Construct Spirit (Clay)
// reactions[0]. The folded Slam row (+11 / 1d8+4+5) is summoned-runtime state produced by
// the MA-0465 caster fold — it exists nowhere on disk, so it is the sanctioned fiction here.
// Fiction rows (#498 precedent): attack:999 'uses' exhaustion and the round-0 default
// collision — the only disk row is At Will 999/maxUses 999, so finite-limit exhaustion
// (reactionMaxUses :2226) and the round>0 latch skip (:2507) are unreachable from disk;
// these rows pin them. The ?? collision row pins that actualDamage 0 (not null/undefined)
// hides primaryDamage (:2483) — 0 damage refuses. Dropped legs (owners cited):
// getGatedMonsterReaction plain-row null discrimination → hellish-rebuke.test.js:87,
// monsterJinx.test.js:139-141, monsterBurstOfIngenuity.test.js:127,
// monsterSpellReflection.test.js:161, monsterGuardianProtection.test.js:139; modal chip +
// handleAttack consumer wiring → MonsterCardModal.jsx:2619 (modal lane owns the seam).
// Resolve keeps ONE refusal per source branch (gate refusal :2592 via 'trigger', fire-check
// refusal :2596 via 'target') — the former resolve legs for round-latch, resolved-stamp and
// unfolded-fold were echo re-runs of this file's own unit tables below.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
  attackReactionIdentityRefusal,
  attackReactionGate,
  attackReactionSlamRow,
  attackReactionFoldCheck,
  attackReactionFireCheck,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const LASH_ACTION = monsters.find(m => m.name === 'Construct Spirit (Clay)').reactions[0];
const SPIRIT = 'Construct Spirit (Clay)';
const CAMPAIGN = 'test-campaign';
const BANDIT = 'Bandit';

function lastAttack(overrides = {}) {
  return {
    attackerName: BANDIT,
    targetName: SPIRIT,
    attackName: 'Scimitar',
    rollType: 'attack',
    weaponType: 'melee',
    hit: true,
    actualDamage: 7,
    ...overrides,
  };
}

function foldedCombatant() {
  return {
    name: SPIRIT,
    type: 'npc',
    currentHp: 38,
    maxHp: 45,
    actions: [
      { name: 'Slam', attack_bonus: 11, damage_dice_primary: '1d8+4+5', damage_type_primary: 'Bludgeoning', reach: '5 ft.' },
    ],
    reactions: [{ ...LASH_ACTION, damage_dice_primary: null }],
  };
}

function csWith(round = 1, extra = []) {
  return { round, creatures: [{ name: BANDIT, type: 'npc', currentHp: 11, maxHp: 11, ac: 12 }, foldedCombatant(), ...extra] };
}

function makeDeps({ store = {}, last = lastAttack(), cs = csWith(1), armed = { name: BANDIT }, handleAttack = vi.fn() } = {}) {
  const state = { ...store };
  const logs = [];
  const order = [];
  const deps = {
    findLastAttack: vi.fn(async () => last),
    getCombatContext: vi.fn(async () => cs),
    getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? (key === 'campaign' && prop === 'lastAttack' ? last : null)),
    setRuntimeValue: vi.fn(async (key, prop, value) => { order.push(`${key}.${prop}`); state[`${key}.${prop}`] = value; }),
    addEntry: vi.fn(async (campaign, entry) => { logs.push(entry); }),
    getTarget: () => armed,
    handleAttack,
  };
  return { state, logs, order, deps };
}

describe('MA-0516 disk fixture — Construct Spirit (Clay) Berserk Lashing', () => {
  it('reactions[0] verbatim + registry arms effect "attack"', () => {
    expect(LASH_ACTION.name).toBe('Berserk Lashing');
    expect(LASH_ACTION.automation).toEqual({ type: 'reaction', trigger: 'damage_taken', effect: 'attack', attack: 'Slam' });
    expect(LASH_ACTION.usage).toBe('At Will');
    expect(LASH_ACTION.uses).toBe(999);
    expect(LASH_ACTION.maxUses).toBe(999);
    expect(LASH_ACTION.reach).toBe('5 ft.');
    expect(LASH_ACTION.attack_bonus).toBeNull();
    expect(LASH_ACTION.damage_dice_primary).toBeNull();
    expect(getGatedMonsterReaction(LASH_ACTION)).toEqual({ effect: 'attack', trigger: 'damage_taken', label: 'Berserk Lashing', icon: 'fa-hand-fist' });
  });
});

describe('MA-0516 attackReactionIdentityRefusal — damaged-target identity gate', () => {
  it.each([
    ['weapon damage dealt to the spirit arms', lastAttack(), null],
    ['spell leg arms when actualDamage is undefined (primaryDamage)', lastAttack({ actualDamage: undefined, primaryDamage: 9 }), null],
    ['secondary leg sums when primary is 0', lastAttack({ actualDamage: undefined, primaryDamage: 0, secondaryDamage: 4 }), null],
    ['?? collision: actualDamage 0 hides primaryDamage 9 — 0 refuses', lastAttack({ actualDamage: 0, primaryDamage: 9 }), 'damage'],
    ['zero damage refuses', lastAttack({ actualDamage: 0, primaryDamage: 0 }), 'damage'],
    ['resolved stamp refuses refire on the same event', lastAttack({ berserkLashingResolved: true }), 'reacted'],
    ['self-damage refuses (distinct creature required)', lastAttack({ attackerName: SPIRIT }), 'attacker'],
    ['no identifiable attacker refuses', lastAttack({ attackerName: null }), 'attacker'],
    ['another creature was the damaged target', lastAttack({ targetName: 'ElderPaladin' }), 'trigger'],
    ['no lastAttack event at all', null, 'trigger'],
  ])('%s', (_label, input, expected) => {
    expect(attackReactionIdentityRefusal(input, SPIRIT)).toBe(expected);
  });
});

describe('MA-0516 attackReactionGate — round latch + At Will uses', () => {
  it.each([
    ['fresh armed event passes and carries the attacker', { currentRound: 2 }, null],
    ['1/round latch refuses a second click in the same round', { currentRound: 2, usedRound: 2 }, 'round'],
    ['next round re-arms (raw-unlimited)', { currentRound: 3, usedRound: 2 }, null],
    ['At Will sentinel never exhausts (MA-0006/0341 honest unlimited)', { currentRound: 3, storedUses: { attack: 998 } }, null],
    ['FICTION: attack:999 hits the maxUses-999 ceiling (pins reactionMaxUses read)', { currentRound: 3, storedUses: { attack: 999 } }, 'uses'],
    ['FICTION/default-collision: round 0 skips the round>0 latch with default usedRound 0', { currentRound: 0, usedRound: 0 }, null],
    ['identity refusal delegates (table above owns the legs)', { currentRound: 2, lastAttack: lastAttack({ targetName: 'ElderPaladin' }) }, 'trigger'],
  ])('%s', (_label, over, expected) => {
    const gate = attackReactionGate({ lastAttack: lastAttack(), monsterName: SPIRIT, currentRound: 2, storedUses: {}, usedRound: 0, action: LASH_ACTION, ...over });
    if (expected === null) {
      expect(gate.ok).toBe(true);
      expect(gate.attackerName).toBe(BANDIT);
    } else {
      expect(gate.ok).toBe(false);
      expect(gate.reason).toBe(expected);
    }
  });
});

describe('MA-0516 attackReactionSlamRow + attackReactionFoldCheck — folded summon rows only', () => {
  it('finds the folded Slam row by automation.attack name; other rows are null', () => {
    expect(attackReactionSlamRow({ action: LASH_ACTION, combatant: foldedCombatant() })).toMatchObject({ attack_bonus: 11, damage_dice_primary: '1d8+4+5' });
    expect(attackReactionSlamRow({ action: LASH_ACTION, combatant: { actions: [{ name: 'Horn' }] } })).toBeNull();
  });

  it.each([
    ['folded caster row folds exact (+11 / 1d8+4+5 Bludgeoning)', { name: 'Slam', attack_bonus: 11, damage_dice_primary: '1d8+4+5', damage_type_primary: 'Bludgeoning' }, { attackBonus: 11, formula: '1d8+4+5', damageType: 'Bludgeoning' }],
    ['missing damage_type defaults Bludgeoning', { name: 'Slam', attack_bonus: 11, damage_dice_primary: '1d8+4+5', damage_type_primary: null }, { attackBonus: 11, formula: '1d8+4+5', damageType: 'Bludgeoning' }],
    ['no Slam row — never a false +0 auto-hit (MA-0286)', null, 'fold'],
    ['unfolded missing attack_bonus (EB-direct join, key ABSENT)', { name: 'Slam', damage_dice_primary: '1d8+4+5' }, 'fold'],
    ['fix#39 hinge flipped — attack_bonus:null strict-presence guard folds-refuses (was Number(null)=0 +0 auto-hit TRIPWIRE, violates MA-0286 :2518 promise)', { name: 'Slam', attack_bonus: null, damage_dice_primary: '1d8+4+5' }, 'fold'],
    ["attack_bonus:'' empty string — distinct arm from null AND from authored 0, folds-refuses", { name: 'Slam', attack_bonus: '', damage_dice_primary: '1d8+4+5' }, 'fold'],
    ["attack_bonus:'   ' whitespace-only — unfolded, folds-refuses", { name: 'Slam', attack_bonus: '   ', damage_dice_primary: '1d8+4+5' }, 'fold'],
    ["attack_bonus:'junk' non-numeric — unfolded, folds-refuses", { name: 'Slam', attack_bonus: 'junk', damage_dice_primary: '1d8+4+5' }, 'fold'],
    ["attack_bonus:'3' numeric-string still folds +3 (pre-fix behavior byte-exact preserved)", { name: 'Slam', attack_bonus: '3', damage_dice_primary: '1d8+4+5' }, { attackBonus: 3, formula: '1d8+4+5', damageType: 'Bludgeoning' }],
    ['attack_bonus:0 authored zero folds +0 (MA-0762 Gas Spore Touch precedent — authored zero is a real bonus, null/empty is not)', { name: 'Slam', attack_bonus: 0, damage_dice_primary: '1d8+4+5' }, { attackBonus: 0, formula: '1d8+4+5', damageType: 'Bludgeoning' }],
    ['unfolded token dice "+spell level"', { name: 'Slam', attack_bonus: 11, damage_dice_primary: '1d8+4+spell level' }, 'fold'],
    ['bonus folded but dice missing', { name: 'Slam', attack_bonus: 11, damage_dice_primary: null }, 'fold'],
    ['attack_bonus:null AND token dice — bonus guard fires first, folds-refuses', { name: 'Slam', attack_bonus: null, damage_dice_primary: '1d8+4+spell level' }, 'fold'],
  ])('%s', (_label, slamRow, expected) => {
    const fold = attackReactionFoldCheck(slamRow);
    if (expected === 'fold') expect(fold.reason).toBe('fold');
    else expect(fold).toEqual(expected);
  });
});

describe('MA-0516 attackReactionFireCheck — RAW slams THAT creature', () => {
  it.each([
    ['armed target is the triggering attacker — folds spec', { armed: { name: BANDIT } }, null],
    ['armed bystander refuses (RAW targets the attacker)', { armed: { name: 'Knight' } }, 'target'],
    ['no armed target refuses', { armed: null }, 'target'],
    ['unfolded combatant row refuses before target check', { combatant: { actions: [{ name: 'Slam', attack_bonus: null, damage_dice_primary: '1d8+4+spell level' }] } }, 'fold'],
    ['combatant without a Slam row refuses', { combatant: { actions: [] } }, 'fold'],
  ])('%s', (_label, over, expected) => {
    const spec = attackReactionFireCheck({ action: LASH_ACTION, combatant: foldedCombatant(), armed: { name: BANDIT }, attackerName: BANDIT, monsterName: SPIRIT, ...over });
    if (expected) expect(spec.reason).toBe(expected);
    else expect(spec).toMatchObject({ attackBonus: 11, formula: '1d8+4+5', damageType: 'Bludgeoning' });
  });
});

describe('MA-0516 resolveMonsterGatedReaction — attack branch', () => {
  it('fires the folded Slam at the triggering attacker: latch+spend+stamp awaited BEFORE handleAttack, ability_use logged', async () => {
    const handleAttack = vi.fn();
    const { state, logs, order, deps } = makeDeps({ handleAttack });
    const result = await resolveMonsterGatedReaction({ action: LASH_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(handleAttack).toHaveBeenCalledWith('Berserk Lashing (Slam)', 11, {
      name: 'Berserk Lashing (Slam)',
      damage_dice_primary: '1d8+4+5',
      damage_type_primary: 'Bludgeoning',
      reach: '5 ft.',
      description: null,
    });
    expect(order).toEqual([
      `${SPIRIT}._attack_usedRound`,
      `${SPIRIT}.${MONSTER_REACTION_USES_KEY}`,
      'campaign.lastAttack',
    ]);
    expect(state[`${SPIRIT}._attack_usedRound`]).toBe(1);
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ attack: 1 });
    expect(state['campaign.lastAttack'].berserkLashingResolved).toBe(true);
    expect(state['campaign.lastAttack'].lashedBy).toBe(SPIRIT);
    expect(state['campaign.lastAttack'].lashedTarget).toBe(BANDIT);
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Berserk Lashing');
    expect(spend.description).toContain(BANDIT);
    expect(spend.description).toContain('+11');
    expect(spend.description).toContain('1d8+4+5');
  });

  it('gate refusal (:2592) logs berserk_lashing_refused with ZERO writes', async () => {
    const handleAttack = vi.fn();
    const { logs, order, deps } = makeDeps({ handleAttack, last: lastAttack({ targetName: 'ElderPaladin' }) });
    const result = await resolveMonsterGatedReaction({ action: LASH_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(handleAttack).not.toHaveBeenCalled();
    expect(order).toEqual([]);
    expect(logs[0].automationType).toBe('berserk_lashing_refused');
    expect(logs[0].description).toContain('(trigger)');
  });

  it('fire-check refusal (:2596) armed bystander — nothing spent, attacker named', async () => {
    const handleAttack = vi.fn();
    const { logs, order, deps } = makeDeps({ handleAttack, armed: { name: 'Knight' } });
    const result = await resolveMonsterGatedReaction({ action: LASH_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/must Slam the creature that damaged it/i);
    expect(handleAttack).not.toHaveBeenCalled();
    expect(order).toEqual([]);
    expect(logs[0].automationType).toBe('berserk_lashing_refused');
    expect(logs[0].description).toContain(BANDIT);
  });
});
