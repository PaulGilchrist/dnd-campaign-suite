// MA-0895: Goblin Hexer "Jinx" (reactions[0]) — formerly a generic
// save-shell DC chip whose save_effect "The attack misses instead" had ZERO
// consumers (a failed WIS save negated nothing; the pending attack either
// died on chip-press popup teardown or committed full damage past the save).
// Fix: automation{type:"reaction", trigger:"attacked_by_missable_hit",
// effect:"jinx_negate"} arms a gated chip (GATED_MONSTER_REACTIONS, §60);
// press rides the parry pending-Done window (MA-0341/§235 — hit:true,
// damageApplied:false; refusals LOG-ONLY so the Done popup survives);
// the ATTACKER's WIS save vs DC 13 rolls INLINE machine-stamped with the
// §212 cs saving_throws nested-abbrev modifier folded; FAIL stamps
// campaign.pendingJinx and the resolve consumer (consumePendingJinxOnResolve,
// handlePlainDamage top, MA-0891 redirect twin) converts the attack to
// hit:false + zero damage BEFORE Done commits it; SUCCESS lets the attack
// ride Done unchanged. At Will sentinel (uses:999) + 1/round latch +
// lastAttack.jinxResolved identity stamp are the only fire limits.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterJinxRow,
  jinxSaveSpec,
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

function makeCs({ wisMod = -5 } = {}) {
  return {
    round: 1,
    creatures: [
      { name: HEXER, size: 'Small', currentHp: 999, maxHp: 999 },
      { name: 'Bandit 1', size: 'Medium or Small', currentHp: 999, maxHp: 999, saving_throws: { wis: { modifier: wisMod } }, ability_score_modifiers: { wis: 0 } },
    ],
  };
}

function makeDeps({ roll = 10 } = {}) {
  const store = { reactionUses: {}, latches: {}, campaign: {}, logs: [] };
  return {
    store,
    deps: {
      rollD20: vi.fn(() => roll),
      getRuntimeValue: vi.fn((characterKey, propertyName) => {
        if (propertyName === 'monsterReactionUses') return store.reactionUses;
        if (propertyName === 'pendingJinx') return store.campaign.pendingJinx;
        if (propertyName === 'lastAttack') return store.campaign.lastAttack;
        return undefined;
      }),
      setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
        if (propertyName === 'monsterReactionUses') store.reactionUses = value;
        if (propertyName === '_jinx_negate_usedRound') store.latches.jinx = value;
        if (characterKey === 'campaign') store.campaign[propertyName] = value;
        return Promise.resolve();
      }),
      addEntry: vi.fn((campaignName, entry) => { store.logs.push(entry); return Promise.resolve(); }),
    },
  };
}

function press({ lastAttack = pendingHit(), cs = makeCs(), currentRound = 1, storedUses = {}, usedRound = 0, roll = 10, deps = makeDeps({ roll }) } = {}) {
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
    deps: deps.deps || deps,
  }).then(result => ({ result, ...deps }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0895 data lock — goblin-hexer reactions[0]', () => {
  it('keeps the RAW save fields and adds the jinx_negate automation block with the At Will sentinel', () => {
    expect(JINX_ROW.name).toBe('Jinx');
    expect(JINX_ROW.trigger).toBe('A creature the goblin can see hits it with an attack roll.');
    expect(JINX_ROW.save_dc).toBe(13);
    expect(JINX_ROW.save_type).toBe('Wisdom');
    expect(JINX_ROW.save_effect).toBe('The attack misses instead');
    expect(JINX_ROW.usage).toBe('At Will');
    expect(JINX_ROW.uses).toBe(999);
    expect(JINX_ROW.maxUses).toBe(999);
    expect(JINX_ROW.automation).toEqual({
      type: 'reaction',
      trigger: 'attacked_by_missable_hit',
      effect: 'jinx_negate',
      saveType: 'WIS',
      saveDc: 13,
    });
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
    expect(jinxSaveSpec(JINX_ROW)).toEqual({ saveDc: 13, saveType: 'WIS' });
  });
});

describe('MA-0895 gates — every refusal zero-spend, log-only (Done popup survives)', () => {
  it('refuses with no pending attack at all', async () => {
    const { result, store } = await press({ lastAttack: null });
    expect(result.resolved).toBe(false);
    expect(result.reason).toBe('no_pending_attack');
    expect(store.campaign.pendingJinx ?? null).toBeNull();
    expect(store.reactionUses.jinx_negate ?? 0).toBe(0);
    expect(store.latches.jinx ?? 0).toBe(0);
    expect(store.logs.some(l => l.automationType === 'jinx_refused' && l.automationDetail === 'no_pending_attack')).toBe(true);
  });

  it('refuses a missed attack, a resolved (damage-applied) attack, and an already-jinxed attack', async () => {
    const miss = await press({ lastAttack: pendingHit({ hit: false }) });
    expect(miss.result.reason).toBe('miss');
    const done = await press({ lastAttack: pendingHit({ damageApplied: true, actualDamage: 7 }) });
    expect(done.result.reason).toBe('resolved');
    const reacted = await press({ lastAttack: pendingHit({ jinxResolved: true }) });
    expect(reacted.result.reason).toBe('reacted');
    for (const run of [miss, done, reacted]) {
      expect(run.store.reactionUses.jinx_negate ?? 0).toBe(0);
      expect(run.result.popupHtml ?? null).toBeNull();
    }
  });

  it('refuses when the attacker is the hexer itself or missing', async () => {
    const self = await press({ lastAttack: pendingHit({ attackerName: HEXER }) });
    expect(self.result.reason).toBe('attacker');
    const anon = await press({ lastAttack: pendingHit({ attackerName: null }) });
    expect(anon.result.reason).toBe('attacker');
  });

  it('round-latch refuses a same-round re-press zero-spend', async () => {
    const { result, store } = await press({ usedRound: 1, currentRound: 1 });
    expect(result.ok ?? result.resolved ?? false).toBe(false);
    expect(result.reason).toBe('round');
    expect(store.logs.some(l => l.automationType === 'jinx_refused' && l.automationDetail === 'round')).toBe(true);
    expect(store.reactionUses.jinx_negate ?? 0).toBe(0);
  });

  it('refuses a dead/absent attacker zero-spend', async () => {
    const cs = makeCs();
    cs.creatures[1].currentHp = 0;
    const { result } = await press({ cs });
    expect(result.reason).toBe('attacker_inactive');
  });

  it('jinxIdentityRefusal accepts spell-attack pendings too (no melee-only filter)', () => {
    expect(jinxIdentityRefusal(pendingHit({ rollType: 'spell-attack' }), HEXER)).toBeNull();
    expect(jinxIdentityRefusal(pendingHit({ rollType: 'damage' }), HEXER)).toBe('no_pending_attack');
    expect(jinxGate({ lastAttack: pendingHit(), monsterName: HEXER, currentRound: 1, storedUses: {}, usedRound: 0, action: JINX_ROW }).ok).toBe(true);
  });
});

describe('MA-0895 press — attacker WIS save rolled inline, machine-stamped, §212 mod folded', () => {
  it('FAILED save (nat10 −5 = 5 < 13): pending-miss stamp, latch, spend, NO popupHtml', async () => {
    const { result, store, deps } = await press({ roll: 10 });
    expect(result).toEqual({ resolved: true, success: false, saveTotal: 5, remaining: 998 });
    expect(deps.rollD20).toHaveBeenCalledTimes(1);
    const pending = store.campaign.pendingJinx;
    expect(pending).toMatchObject({ attackerName: 'Bandit 1', targetName: HEXER, by: HEXER, saveDc: 13, saveRoll: 10, saveBonus: -5, saveTotal: 5, consumed: false, attackTotal: 17, targetAc: 13 });
    expect(store.campaign.lastAttack).toMatchObject({ jinxResolved: true, jinxPending: true, jinxSaveResult: 'failure', jinxSaveTotal: 5, hit: true });
    expect(store.latches.jinx).toBe(1);
    expect(store.reactionUses.jinx_negate).toBe(1);
    const saveLog = store.logs.find(l => l.automationType !== 'ability_use' && l.rollType === 'save');
    expect(saveLog).toMatchObject({ type: 'roll', characterName: 'Bandit 1', saveType: 'WIS', saveDc: 13, saveRoll: 10, saveBonus: -5, total: 5, saveResult: 'failure', note: 'jinx_negate_attacker_save' });
    const spendLog = store.logs.find(l => l.type === 'ability_use');
    expect(spendLog.description).toContain('FAILED');
    expect(spendLog.description).toContain('misses instead');
    expect(result.popupHtml ?? null).toBeNull();
  });

  it('SUCCESS save (+19 fold: nat4+19 = 23 ≥ 13): no pending stamp, jinx_saved, attack rides Done', async () => {
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

  it('falls back to ability_score_modifiers when no §212 saving_throws stamp is present', () => {
    expect(attackerSaveModifier({ ability_score_modifiers: { wis: 2 } }, 'wis')).toBe(2);
    expect(attackerSaveModifier({ saving_throws: { wis: { modifier: -5 } }, ability_score_modifiers: { wis: 2 } }, 'wis')).toBe(-5);
    expect(attackerSaveModifier(null, 'wis')).toBe(0);
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

  it('matching Done: lastAttack rewritten hit:false + jinx_negated + zero damage, popup honest, pending cleared', async () => {
    const { store, deps } = consumeSetup();
    const context = { attackerName: 'Bandit 1', targetName: HEXER, attackName: 'Scimitar', damageType: 'Slashing' };
    const outcome = await consumePendingJinxOnResolve(CAMPAIGN, context, deps);
    expect(outcome.negated).toBe(true);
    expect(store.campaign.pendingJinx).toBeNull();
    expect(store.campaign.lastAttack).toMatchObject({ hit: false, jinx_negated: true, negatedBy: HEXER, actualDamage: 0, damageApplied: false, jinxSaveTotal: 5 });
    expect(store.logs.some(l => l.automationType === 'jinx_attack_negated' && l.description.includes('NEGATED'))).toBe(true);
    expect(outcome.popupData).toMatchObject({ type: 'auto-miss', computedHit: false, name: 'Scimitar', targetName: HEXER, jinxNegated: true, finalDamage: 0, note: 'attack negated — Jinx' });
  });

  it('byte-inert with no pending, consumed pending, attacker mismatch, or a re-armed different target', async () => {
    expect(await consumePendingJinxOnResolve(CAMPAIGN, { attackerName: 'Bandit 1', targetName: HEXER }, consumeSetup({ pending: null }).deps)).toBeNull();
    expect(await consumePendingJinxOnResolve(CAMPAIGN, { attackerName: 'Bandit 1', targetName: HEXER }, consumeSetup({ pending: { ...armedPending(), consumed: true } }).deps)).toBeNull();
    expect(await consumePendingJinxOnResolve(CAMPAIGN, { attackerName: 'Bandit 2', targetName: HEXER }, consumeSetup().deps)).toBeNull();
    expect(await consumePendingJinxOnResolve(CAMPAIGN, { attackerName: 'Bandit 1', targetName: 'Bandit 2' }, consumeSetup().deps)).toBeNull();
  });
});

describe('MA-0895 dispatcher — resolveMonsterGatedReaction routes the jinx row through the pending window', () => {
  function gatedDeps({ roll = 10, lastAttack = pendingHit() } = {}) {
    const store = { reactionUses: {}, latches: {}, campaign: { lastAttack }, logs: [] };
    const deps = {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => makeCs()),
      rollD20: vi.fn(() => roll),
      getRuntimeValue: vi.fn((characterKey, propertyName) => {
        if (propertyName === 'monsterReactionUses') return store.reactionUses;
        if (propertyName === 'pendingJinx') return store.campaign.pendingJinx;
        return null;
      }),
      setRuntimeValue: vi.fn(async (characterKey, propertyName, value) => {
        if (propertyName === 'monsterReactionUses') store.reactionUses = value;
        if (propertyName === '_jinx_negate_usedRound') store.latches.jinx = value;
        if (characterKey === 'campaign') store.campaign[propertyName] = value;
      }),
      addEntry: vi.fn(async (campaignName, entry) => { store.logs.push(entry); }),
    };
    return { store, deps };
  }

  it('failed save resolves through the gated channel and arms pendingJinx (chip press, not the generic save chip)', async () => {
    const { store, deps } = gatedDeps({ roll: 10 });
    const result = await resolveMonsterGatedReaction({ action: JINX_ROW, monsterName: HEXER, campaignName: CAMPAIGN, deps });
    expect(result).toMatchObject({ resolved: true, success: false, saveTotal: 5 });
    expect(store.campaign.pendingJinx).toMatchObject({ attackerName: 'Bandit 1', consumed: false });
    expect(store.reactionUses.jinx_negate).toBe(1);
  });

  it('off-window press refuses zero-spend through the same channel', async () => {
    const { store, deps } = gatedDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: JINX_ROW, monsterName: HEXER, campaignName: CAMPAIGN, deps });
    expect(result).toMatchObject({ resolved: false, refused: true, reason: 'no_pending_attack' });
    expect(store.reactionUses.jinx_negate ?? 0).toBe(0);
    expect(store.latches.jinx ?? 0).toBe(0);
  });
});
