// MA-1463: Shield Guardian "Protection" (reactions[0]) — formerly a
// zero-affordance prose row (name+trigger+description only, chips=0). The
// parry-template conversion (MA-0341) arms a gated chip
// (GATED_MONSTER_REACTIONS `guardian_protection`, automation{type:"reaction",
// trigger:"attacked_by_hit", effect:"guardian_protection", acBonus:5} +
// usage:"At Will"/uses:999 authored on disk) whose press runs: round-latch
// gate FIRST (MA-0013 latch shape — same-round re-press refuses zero-spend),
// armed-wearer gate on the guardian's OWN GM-armed cs.targetName seam
// (MA-0882/MA-0891 getTargetFromAttacker — no_target/self_target/
// already-active refuse zero-spend; there is no amulet-persistence
// subsystem), pending-attack identity gate against the WEARER (MA-0891
// redirectIdentityRefusal lineage — targetName===wearer, hit, damage not yet
// applied), then latch AWAITED (CLA-361) → ONE-SHOT buff stamp
// {effect:'guardian_protection', name:'Guardian Protection', acBonus:5,
// oneShot:true, grantedBy} on the WEARER's activeBuffs (MA-1170 shield
// channel) → lastAttack guardianProtectionResolved stamp → ONE anchor clock
// expireOnCreatureName=guardian rounds:undefined (§38, MA-0548 shape) →
// ability_use spend log. At Will: MONSTER_REACTION_USES is NEVER written
// (parry never-spends shape). Refusals are log-only, NO popupHtml (§235d)
// so the attacker's pending Done popup survives every press.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterGuardianProtectionRow,
  guardianProtectionIdentityRefusal,
  guardianWearerGate,
  guardianProtectionGate,
  resolveMonsterGuardianProtectionRow,
  buildGuardianProtectionBuff,
  GUARDIAN_PROTECTION_BUFF_NAME,
} from './monsterGuardianProtection.js';
import { getGatedMonsterReaction } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
  processExpirationList: vi.fn(),
  expireForCreature: vi.fn(),
}));

import { addExpiration } from '../../services/rules/effects/expirationQueue.js';

const CAMPAIGN = 'test-campaign';
const GUARDIAN = 'Shield Guardian 1';
const WEARER = 'Bandit 1';
const ATTACKER = 'ElderPaladin';
const LATCH_KEY = '_guardian_protection_usedRound';

const guardian = monstersData.find(m => m.index === 'shield-guardian');
const PROT_ROW = guardian.reactions[0];

function pendingHit({ targetName = WEARER, attackerName = ATTACKER, ...rest } = {}) {
  return {
    rollType: 'attack',
    attackerName,
    targetName,
    attackName: 'Longsword',
    d20: 14,
    bonus: 5,
    total: 19,
    targetAc: 12,
    hit: true,
    weaponType: 'melee',
    timestamp: 1,
    ...rest,
  };
}

function makeCs({ wearerArmed = true } = {}) {
  return {
    round: 3,
    creatures: [
      { name: GUARDIAN, size: 'Large', targetName: wearerArmed ? WEARER : null },
      { name: WEARER, size: 'Medium' },
      { name: ATTACKER, size: 'Medium' },
    ],
  };
}

function makeDeps({ wearerBuffs = [] } = {}) {
  const store = { buffs: { [WEARER]: wearerBuffs }, campaign: {}, logs: [], latches: {} };
  const getRV = vi.fn((key, prop) => {
    if (prop === 'activeBuffs') return store.buffs[key] || [];
    return undefined;
  });
  const setRV = vi.fn((key, prop, value) => {
    if (prop === 'activeBuffs') store.buffs[key] = value;
    if (prop === LATCH_KEY) store.latches[key] = value;
    if (key === 'campaign') store.campaign[prop] = value;
    return Promise.resolve();
  });
  const log = vi.fn((campaign, entry) => { store.logs.push(entry); return Promise.resolve(); });
  return { store, getRV, setRV, log };
}

function resolveCall(overrides = {}) {
  const deps = makeDeps(overrides);
  const call = (lastAttack, cs = makeCs(), currentRound = 3, usedRound = 2) => resolveMonsterGuardianProtectionRow({
    action: PROT_ROW,
    monsterName: GUARDIAN,
    campaignName: CAMPAIGN,
    lastAttack,
    cs,
    currentRound,
    usedRound,
    latchKey: LATCH_KEY,
    deps: { getRuntimeValue: deps.getRV, setRuntimeValue: deps.setRV, addEntry: deps.log },
  });
  return { ...deps, call };
}

describe('MA-1463 disk row + registry arm', () => {
  it('pins the shield-guardian Protection automation byte-shape (parry template MA-0341)', () => {
    expect(PROT_ROW.name).toBe('Protection');
    expect(PROT_ROW.trigger).toBe("An attack roll hits the wearer of the guardian's amulet while the wearer is within 5 feet of the guardian");
    expect(PROT_ROW.description).toBe("The wearer gains a +5 bonus to AC, including against the triggering attack and possibly causing it to miss, until the start of the guardian's next turn.");
    expect(PROT_ROW.usage).toBe('At Will');
    expect(PROT_ROW.uses).toBe(999);
    expect(PROT_ROW.maxUses).toBe(999);
    expect(PROT_ROW.automation).toEqual({
      type: 'reaction',
      trigger: 'attacked_by_hit',
      effect: 'guardian_protection',
      acBonus: 5,
    });
    expect(isMonsterGuardianProtectionRow(PROT_ROW)).toBe(true);
  });

  it('arms the gated chip via getGatedMonsterReaction (registry lookup keys off automation.effect only)', () => {
    const def = getGatedMonsterReaction(PROT_ROW);
    expect(def).toEqual({ effect: 'guardian_protection', trigger: 'attacked_by_hit', label: 'Protection', icon: 'fa-shield-heart' });
    expect(getGatedMonsterReaction({ name: 'Protection' })).toBeNull();
  });
});

describe('MA-1463 identity + wearer gates', () => {
  it('identity probe gates against the WEARER, refusing every non-pending case', () => {
    expect(guardianProtectionIdentityRefusal(null, WEARER)).toBe('no_pending_attack');
    expect(guardianProtectionIdentityRefusal({ rollType: 'save' }, WEARER)).toBe('no_pending_attack');
    expect(guardianProtectionIdentityRefusal(pendingHit({ targetName: 'Someone Else' }), WEARER)).toBe('not_wearer');
    expect(guardianProtectionIdentityRefusal(pendingHit({ hit: false }), WEARER)).toBe('miss');
    expect(guardianProtectionIdentityRefusal(pendingHit({ damageApplied: true }), WEARER)).toBe('resolved');
    expect(guardianProtectionIdentityRefusal(pendingHit({ actualDamage: 7 }), WEARER)).toBe('resolved');
    expect(guardianProtectionIdentityRefusal(pendingHit({ guardianProtectionResolved: true }), WEARER)).toBe('reacted');
    expect(guardianProtectionIdentityRefusal(pendingHit({ attackerName: WEARER }), WEARER)).toBe('attacker');
    expect(guardianProtectionIdentityRefusal(pendingHit(), WEARER)).toBeNull();
  });

  it('spell-origin attacks against the wearer qualify (any attack roll hits the wearer)', () => {
    expect(guardianProtectionIdentityRefusal(pendingHit({ rollType: 'spell-attack', weaponType: undefined }), WEARER)).toBeNull();
  });

  it('wearer gate: no_target / self_target / already-active, all on the GM-armed cs seam', () => {
    const d = makeDeps();
    expect(guardianWearerGate({ cs: makeCs({ wearerArmed: false }), monsterName: GUARDIAN, getRV: d.getRV }).reason).toBe('no_target');
    expect(guardianWearerGate({ cs: { creatures: [{ name: GUARDIAN, targetName: GUARDIAN }] }, monsterName: GUARDIAN, getRV: d.getRV }).reason).toBe('self_target');
    const armed = makeDeps({ wearerBuffs: [{ effect: 'guardian_protection', oneShot: true }] });
    expect(guardianWearerGate({ cs: makeCs(), monsterName: GUARDIAN, getRV: armed.getRV }).reason).toBe('already-active');
    expect(guardianWearerGate({ cs: makeCs(), monsterName: GUARDIAN, getRV: d.getRV }).wearer.name).toBe(WEARER);
  });

  it('round latch refuses before any other gate; gate reports the attacker identity', () => {
    const latch = guardianProtectionGate({ lastAttack: pendingHit(), wearerName: WEARER, currentRound: 3, usedRound: 3, action: PROT_ROW });
    expect(latch.ok).toBe(false);
    expect(latch.reason).toBe('round');
    const ok = guardianProtectionGate({ lastAttack: pendingHit(), wearerName: WEARER, currentRound: 3, usedRound: 2, action: PROT_ROW });
    expect(ok.ok).toBe(true);
    expect(ok.attackerName).toBe(ATTACKER);
    expect(ok.acBonus).toBe(5);
  });
});

describe('MA-1463 resolver press', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grants: latch awaited, ONE-SHOT +5 buff on the WEARER (not the guardian), lastAttack stamp, ONE anchor clock, spend log, NO popupHtml', async () => {
    const { store, call } = resolveCall();
    const result = await call(pendingHit());
    expect(result.ok).toBe(true);
    expect(result.popupHtml).toBeUndefined();
    expect(result.acBonus).toBe(5);
    expect(result.wearerName).toBe(WEARER);
    expect(result.newAc).toBe(17);

    const stamped = store.buffs[WEARER];
    expect(stamped).toHaveLength(1);
    expect(stamped[0].effect).toBe('guardian_protection');
    expect(stamped[0].name).toBe(GUARDIAN_PROTECTION_BUFF_NAME);
    expect(stamped[0].acBonus).toBe(5);
    expect(stamped[0].oneShot).toBe(true);
    expect(stamped[0].grantedBy).toBe(GUARDIAN);
    expect(store.buffs[GUARDIAN]).toBeUndefined();

    expect(store.campaign.lastAttack.guardianProtectionResolved).toBe(true);
    expect(store.campaign.lastAttack.protectedBy).toBe(GUARDIAN);
    expect(store.campaign.lastAttack.protectedWearer).toBe(WEARER);
    expect(store.campaign.lastAttack.guardianProtectionAcBonus).toBe(5);

    expect(addExpiration).toHaveBeenCalledTimes(1);
    const clock = addExpiration.mock.calls[0][0];
    expect(clock.expireOnCreatureName).toBe(GUARDIAN);
    expect(clock.rounds).toBeUndefined();
    expect(clock.targetName).toBe(WEARER);
    expect(clock.effects).toEqual([{ type: 'remove_active_buff', buffName: GUARDIAN_PROTECTION_BUFF_NAME }]);

    expect(store.logs.some(l => l.type === 'ability_use' && l.characterName === GUARDIAN)).toBe(true);
    expect(store.logs.every(l => l.automationType !== 'guardian_protection_refused')).toBe(true);
  });

  it('At Will: MONSTER_REACTION_USES is NEVER written (parry MA-0341 never-spends shape)', async () => {
    const { setRV, call } = resolveCall();
    await call(pendingHit());
    const usesWrites = setRV.mock.calls.filter(c => c[1] === 'monsterReactionUses');
    expect(usesWrites).toHaveLength(0);
  });

  it('refusals are log-only (no popupHtml) and zero-write: no_wearer, no_pending_attack, miss, not_wearer, same-round latch', async () => {
    const noWearer = resolveCall();
    const r1 = await noWearer.call(pendingHit(), makeCs({ wearerArmed: false }));
    expect(r1.ok).toBe(false);
    expect(r1.reason).toBe('no_target');
    expect(r1.popupHtml).toBeUndefined();
    expect(noWearer.store.logs[0].automationType).toBe('guardian_protection_refused');
    expect(noWearer.store.logs[0].automationDetail).toBe('no_target');
    expect(noWearer.store.buffs[WEARER]).toEqual([]);

    const noPending = resolveCall();
    const r2 = await noPending.call(null);
    expect(r2.reason).toBe('no_pending_attack');
    expect(noPending.store.latches[GUARDIAN]).toBeUndefined();

    const miss = resolveCall();
    expect((await miss.call(pendingHit({ hit: false }))).reason).toBe('miss');

    const other = resolveCall();
    expect((await other.call(pendingHit({ targetName: 'Bandit 2' }))).reason).toBe('not_wearer');

    const latched = resolveCall();
    const r5 = await latched.call(pendingHit(), makeCs(), 3, 3);
    expect(r5.reason).toBe('round');
    expect(latched.store.latches[GUARDIAN]).toBeUndefined();
    expect(latched.store.buffs[WEARER]).toEqual([]);
  });

  it('already-active wearer refuses a second bond, and a reacted attack refuses a double press', async () => {
    const dup = resolveCall({ wearerBuffs: [buildGuardianProtectionBuff(PROT_ROW, GUARDIAN, pendingHit())] });
    expect((await dup.call(pendingHit())).reason).toBe('already-active');

    const reacted = resolveCall();
    expect((await reacted.call(pendingHit({ guardianProtectionResolved: true }))).reason).toBe('reacted');
  });

  it('buff carries the pending-attack round context for honest expiry (name matches the expiration remove_active_buff)', () => {
    const buff = buildGuardianProtectionBuff(PROT_ROW, GUARDIAN, pendingHit());
    expect(buff.name).toBe('Guardian Protection');
    expect(buff.appliedRoundContext).toEqual({ d20: 14, total: 19, targetAc: 12 });
    expect(buff.vsAttack).toBe(`${ATTACKER}:Longsword`);
  });
});
