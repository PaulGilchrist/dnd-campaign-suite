// @maintained-by-ai
// MA-1463: Shield Guardian "Protection" (reactions[0]) — gated defender reaction on
// automation{type:"reaction", trigger:"attacked_by_hit", effect:"guardian_protection",
// acBonus:5} + usage:"At Will"/uses:999 authored on disk. Press: round-latch gate
// FIRST (MA-0013 latch shape, same-round re-press refuses zero-spend) → armed-wearer
// gate on the guardian's OWN GM-armed cs.targetName seam (MA-0882/MA-0891
// getTargetFromAttacker — no_target/self_target/already-active refuse zero-spend;
// no amulet-persistence subsystem in-app) → pending-attack identity gate against the
// WEARER (MA-0891 redirectIdentityRefusal lineage) → latch AWAITED (CLA-361) →
// ONE-SHOT +5 buff on the WEARER's activeBuffs (MA-1170 shield channel) →
// lastAttack guardianProtectionResolved stamp → ONE anchor clock
// expireOnCreatureName=guardian rounds:undefined (§38/§39, MA-0548 shape — fires at
// the guardian's next turn-start, matches RAW "until the start of the guardian's next
// turn"; seams-clock only, NEVER wall-clock #app MANDATORY) → ability_use spend log.
// At Will: MONSTER_REACTION_USES is NEVER written (MA-0341 parry never-spends
// shape). Refusals are log-only, NO popupHtml (§235d) — the attacker's pending Done
// popup survives every press. Zero-RNG lane: no roll expressions invoked (#1072).
//
// Cite-owner table:
//   getTargetFromAttacker seam generics .. monsterRedirectAttack.test.js (MA-0882/MA-0891 cited, not re-driven)
//   generic gated-chip arm/dispatch ...... MonsterCardHelpers.gated-reaction.test.js — this file pins ONLY the guardian row
//   reaction-bucket economy .............. CANON turnState #1070; trigger predicate #1018; gated-reaction generics #1091
//   AC fold + consume seams .............. useLoggedDiceRollUtils.core.test.js:153 folds getGuardianProtectionAcBonus; consumed by consumeGuardianProtectionAcBonus (attackPostProcessing.js:256, MA-1170 lane cited, not re-litigated)
//   te registry golden #1012 ............. NO te on this lane — activeBuffs channel (MA-1170), not targetEffects
//
// Burst twin split (monsterBurstOfIngenuity.test.js MA-1510, #1091 self-target
// divergence note): HERE self_target REFUSES (guardian protects only the amulet
// wearer — RAW-illegal self); there SELF is RAW-legal ("the sphinx or another
// creature"). There spends MONSTER_REACTION_USES every press (2/Day); here At Will
// NEVER writes uses. The divergent self-legality legs live in their own files.
//
// Old -> new (this trim pass):
// - disk pin / registry arm: kept verbatim (+ negative predicate row, + unarmed-chip resolver guard leg).
// - identity probe + spell-origin its: CONSOLIDATED → one it.each RAW token matrix.
// - wearer-gate unit its: REMOVED → owner: refusal it.each rows 2-4 (route-through #1080) + redirect seam generics.
// - round-latch gate unit its: REMOVED → folded into refusal row 1 (round-first over every other gate, zero-store-read guard #1035).
// - grant press: STRENGTHENED — latch write now pinned (was an untested gap), exact ordered campaign-pinned setRV census (#932/#1019) which also PROVES the At Will never-uses census, verbatim stamp bytes with co-located decoy append + bystander survivor (#1057), full addExpiration toEqual, exact ability_use log bytes (#app log mandate).
// - At Will / buildBuff unit its: folded into the grant census + stamp bytes.
// - refusals + dup/reacted its: CONSOLIDATED → one it.each over the five press-reachable tokens, zero-spend/zero-clock/zero-write census (#903/#1026/#949); miss/resolved/reacted/save-origin tokens owned by the probe matrix.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterGuardianProtectionRow,
  guardianProtectionIdentityRefusal,
  resolveMonsterGuardianProtectionRow,
  GUARDIAN_PROTECTION_BUFF_NAME,
} from './monsterGuardianProtection.js';
import { getGatedMonsterReaction } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

import { addExpiration } from '../../services/rules/effects/expirationQueue.js';

const CAMPAIGN = 'test-campaign';
const GUARDIAN = 'Shield Guardian 1';
const WEARER = 'Bandit 1';
const ATTACKER = 'ElderPaladin';
const BYSTANDER = 'Bandit 2';
const LATCH_KEY = '_guardian_protection_usedRound';

const guardian = monstersData.find(m => m.index === 'shield-guardian');
const PROT_ROW = guardian.reactions.find(a => a.name === 'Protection');

// Off-lane decoys (byte-distinct from guardian_protection): a bystander that must
// never see a write (#1057) and a co-located wearer buff the grant must preserve
// when appending (#1019 store-faithful).
const BYSTANDER_DECOY = { effect: 'bless', name: 'Bless' };
const COLOCATED_DECOY = { effect: 'mage_armor', acBonus: 13 };

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
      { name: BYSTANDER, size: 'Medium' },
    ],
  };
}

function makeDeps({ wearerBuffs = [] } = {}) {
  const store = { buffs: { [WEARER]: wearerBuffs, [BYSTANDER]: [BYSTANDER_DECOY] }, campaign: {}, logs: [], latches: {} };
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
  const call = (lastAttack, cs = makeCs(), currentRound = 3, usedRound = 2, action = PROT_ROW) => resolveMonsterGuardianProtectionRow({
    action,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-1463 disk row + registry arm', () => {
  it('pins the shield-guardian Protection automation byte-shape (parry template MA-0341, At Will 999)', () => {
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
    expect(isMonsterGuardianProtectionRow({ name: 'Protection' })).toBe(false);
  });

  it('arms the gated chip via getGatedMonsterReaction (registry keys off automation.effect only; generic arm owned by gated-reaction.test.js) and an unarmed row is inert', async () => {
    const def = getGatedMonsterReaction(PROT_ROW);
    expect(def).toEqual({ effect: 'guardian_protection', trigger: 'attacked_by_hit', label: 'Protection', icon: 'fa-shield-heart' });
    expect(getGatedMonsterReaction({ name: 'Protection' })).toBeNull();
    const d = resolveCall();
    expect(await d.call(pendingHit(), makeCs(), 3, 2, { name: 'Bite' })).toEqual({ resolved: false, reason: 'not-guardian-protection' });
    expect(d.setRV).not.toHaveBeenCalled();
    expect(d.log).not.toHaveBeenCalled();
  });
});

describe('MA-1463 identity gate (RAW token matrix, gated against the WEARER)', () => {
  it.each([
    { name: 'no pending attack', attack: null, expected: 'no_pending_attack' },
    { name: 'non-attack roll type (save) never qualifies', attack: { rollType: 'save' }, expected: 'no_pending_attack' },
    { name: 'spell-origin attack vs wearer QUALIFIES ("an attack roll hits the wearer")', attack: pendingHit({ rollType: 'spell-attack', weaponType: undefined }), expected: null },
    { name: 'plain pending hit vs wearer qualifies', attack: pendingHit(), expected: null },
    { name: 'attack targets a decoy, not the wearer', attack: pendingHit({ targetName: BYSTANDER }), expected: 'not_wearer' },
    { name: 'miss is nothing to protect', attack: pendingHit({ hit: false }), expected: 'miss' },
    { name: 'damageApplied flag is too late', attack: pendingHit({ damageApplied: true }), expected: 'resolved' },
    { name: 'committed actualDamage is too late (no Done-undo)', attack: pendingHit({ actualDamage: 7 }), expected: 'resolved' },
    { name: 'already-resolved stamp refuses a double react', attack: pendingHit({ guardianProtectionResolved: true }), expected: 'reacted' },
    { name: 'wearer attacking itself has no identifiable defender case', attack: pendingHit({ attackerName: WEARER }), expected: 'attacker' },
  ])('$name → $expected', ({ attack, expected }) => {
    expect(guardianProtectionIdentityRefusal(attack, WEARER)).toBe(expected);
  });
});

describe('MA-1463 resolver press', () => {
  it('grants: AWAITED ordered campaign-pinned writes latch→stamp→lastAttack (exact census PROVES At Will NEVER writes MONSTER_REACTION_USES, MA-0341 never-spends), verbatim ONE-SHOT +5 stamp appended on the WEARER only, co-located decoy preserved, bystander untouched, ONE anchor clock, exact ability_use log, NO popupHtml', async () => {
    const { store, setRV, call } = resolveCall({ wearerBuffs: [COLOCATED_DECOY] });
    const result = await call(pendingHit());
    expect(result).toMatchObject({ ok: true, acBonus: 5, wearerName: WEARER, newAc: 17 });
    expect(result.popupHtml).toBeUndefined();

    const [decoy, stamp] = store.buffs[WEARER];
    expect(decoy).toEqual(COLOCATED_DECOY);
    const { timestamp, ...stampBytes } = stamp;
    expect(typeof timestamp).toBe('number');
    expect(stampBytes).toEqual({
      effect: 'guardian_protection',
      name: GUARDIAN_PROTECTION_BUFF_NAME,
      acBonus: 5,
      oneShot: true,
      source: 'Protection',
      grantedBy: GUARDIAN,
      vsAttack: `${ATTACKER}:Longsword`,
      appliedRoundContext: { d20: 14, total: 19, targetAc: 12 },
    });

    // CLA-361 latch AWAITED before consumers read; every tuple campaign-keyed (#1019);
    // absence of a monsterReactionUses tuple IS the At Will never-spends census (#1072).
    expect(setRV.mock.calls).toEqual([
      [GUARDIAN, LATCH_KEY, 3, CAMPAIGN],
      [WEARER, 'activeBuffs', [decoy, stamp], CAMPAIGN],
      ['campaign', 'lastAttack', {
        ...pendingHit(),
        guardianProtectionResolved: true,
        protectedBy: GUARDIAN,
        protectedWearer: WEARER,
        guardianProtectionAcBonus: 5,
      }, CAMPAIGN],
    ]);
    expect(store.latches[GUARDIAN]).toBe(3);
    expect(store.latches[BYSTANDER]).toBeUndefined();
    expect(store.buffs[GUARDIAN]).toBeUndefined();
    expect(store.buffs[BYSTANDER]).toEqual([BYSTANDER_DECOY]);

    expect(addExpiration).toHaveBeenCalledTimes(1);
    // §38/§39 anchor clock: rounds:undefined, expires on the guardian's next-turn SEAM — never wall-clock.
    expect(addExpiration.mock.calls[0][0]).toEqual({
      attackerName: GUARDIAN,
      targetName: WEARER,
      campaignName: CAMPAIGN,
      rounds: undefined,
      expireOnCreatureName: GUARDIAN,
      effects: [{ type: 'remove_active_buff', buffName: GUARDIAN_PROTECTION_BUFF_NAME }],
    });

    expect(store.logs).toHaveLength(1);
    expect(store.logs[0]).toMatchObject({
      type: 'ability_use',
      characterName: GUARDIAN,
      abilityName: 'Protection',
      description: `${GUARDIAN} uses Protection (Reaction) — ${WEARER} gains +5 AC (AC 12 → 17), including against ${ATTACKER}'s pending Longsword. Dismiss the pending attack popup WITHOUT Done, then re-click ${ATTACKER}'s attack chip to re-resolve vs AC 17. The +5 lasts until the start of ${GUARDIAN}'s next turn. 5-ft proximity GM-enforced (gridless advisory, §42). At Will — 1 Reaction per round.`,
    });
  });

  it.each([
    {
      name: 'round latch refuses FIRST — an armed fresh attack still answers round, not identity',
      press: { lastAttack: pendingHit(), cs: makeCs(), currentRound: 3, usedRound: 3 },
      reason: 'round',
      message: 'Protection: Reaction already used this round — refused.',
      zeroStoreRead: true,
    },
    {
      name: 'no wearer armed refuses BEFORE the identity gate (null attack answers no_target, not no_pending_attack)',
      press: { lastAttack: null, cs: makeCs({ wearerArmed: false }), currentRound: 3, usedRound: 2 },
      reason: 'no_target',
      message: `Protection: ${GUARDIAN} has no amulet wearer armed on the card — arm the wearer that should take the +5 AC first (gridless proxy for the RAW amulet + 5-ft proximity).`,
      zeroStoreRead: true,
    },
    {
      name: 'self_target refuses — unlike the burst twin SELF IS NOT RAW-LEGAL here (guardian protects only the amulet wearer)',
      press: { lastAttack: pendingHit(), cs: { creatures: [{ name: GUARDIAN, targetName: GUARDIAN }, { name: ATTACKER }] }, currentRound: 3, usedRound: 2 },
      reason: 'self_target',
      message: `Protection: ${GUARDIAN} cannot Protect itself — arm the amulet wearer on the card first.`,
      zeroStoreRead: true,
    },
    {
      name: 'already-active wearer refuses a second bond — refuses NOT replaces (#949): the live stamp bytes survive',
      press: { lastAttack: pendingHit(), cs: makeCs(), currentRound: 3, usedRound: 2, wearerBuffs: [{ effect: 'guardian_protection', oneShot: true }] },
      reason: 'already-active',
      message: `Protection: ${WEARER} is already carrying ${GUARDIAN}'s +5 AC bond — one bond instance per wearer; refused.`,
      zeroStoreRead: false,
    },
    {
      name: 'attack against a byte-distinct decoy (Bandit 2) never borrows the wearer bond — bystander buffs untouched',
      press: { lastAttack: pendingHit({ targetName: BYSTANDER }), cs: makeCs(), currentRound: 3, usedRound: 2 },
      reason: 'not_wearer',
      message: `Protection: the last attack targeted ${BYSTANDER}, not the armed wearer ${WEARER} — refused.`,
      zeroStoreRead: false,
    },
  ])('$name — refused log-only §235d, ZERO spend/clock/latch/buff writes (#1026)', async ({ press, reason, message, zeroStoreRead }) => {
    const { store, setRV, getRV, call } = resolveCall({ wearerBuffs: press.wearerBuffs });
    const r = await call(press.lastAttack, press.cs, press.currentRound, press.usedRound);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(reason);
    expect(r.popupHtml).toBeUndefined();
    expect(setRV).not.toHaveBeenCalled();
    expect(addExpiration).not.toHaveBeenCalled();
    expect(store.latches).toEqual({});
    expect(store.buffs[GUARDIAN]).toBeUndefined();
    // The not_wearer decoy's own buffs must survive byte-identical too.
    expect(store.buffs[BYSTANDER]).toEqual([BYSTANDER_DECOY]);
    if (press.wearerBuffs) expect(store.buffs[WEARER]).toEqual(press.wearerBuffs);
    else expect(store.buffs[WEARER]).toEqual([]);
    if (zeroStoreRead) expect(getRV).not.toHaveBeenCalled();

    const refused = store.logs.filter(l => l.automationType === 'guardian_protection_refused');
    expect(refused).toHaveLength(1);
    expect(store.logs).toHaveLength(1);
    expect(refused[0]).toMatchObject({ type: 'automation', automationDetail: reason, characterName: GUARDIAN, abilityName: 'Protection' });
    expect(refused[0].description).toBe(`Protection refused (${reason}): ${message}`);
  });
});
