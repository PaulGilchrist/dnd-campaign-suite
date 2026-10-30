// @maintained-by-ai
// MA-0891: Goblin Boss "Redirect Attack" (reactions[0]) — gated retarget reaction on
// automation{type:"monster_redirect_attack", effect:"redirect_attack", ally_size:
// ["Small","Medium"], range_ft:5}, At Will uses:999 authored on disk. Press order:
// round-latch/uses gate FIRST → pending-attack identity gate (parry MA-0341 lineage,
// WITHOUT the melee-only filter — any attack roll vs the Boss qualifies) → GM-armed
// ALLY gate on the Boss's own cs.targetName seam (MA-0882 getTargetFromAttacker;
// no_target/self_target/already-active/size refuse). ALL refusals zero-spend/zero-te/
// zero-clock (#1026 refused must not burn) with exact refused-log bytes + refusal
// popup. Met → latch+spend AWAITED (CLA-361; unlike the guardian twin #1463 At Will
// HERE DOES spend MONSTER_REACTION_USES) → campaign.pendingRedirect retarget stamp +
// lastAttack merge → te `redirect_attack` ON THE ALLY rounds:1 + ONE clock →
// ability_use spend log BEFORE granted log (#932 order); NO popupHtml on success so
// the attacker's pending Done popup survives the press (§217/§235). RESOLVE consumer
// (consumePendingRedirectOnResolve, handlePlainDamage) rewrites the victim to the
// ALLY on Done — verified ARC-wise off the real press stamps (#1080), never
// hand-forged grant bytes; mismatch/consumed/fresh-swing inputs stay byte-inert.
// §42/§70: 5-ft adjacency + position swap ride the logs as honest advisory —
// seams-clock only, NEVER wall-clock (#app MANDATORY).
//
// Cite-owner table:
//   te key existence + definition bytes ..... targetEffectDefinitions.test.js golden census (redirect_attack row #1012) — retired here
//   generic gated-chip arm machinery ........ MonsterCardHelpers.gated-reaction.test.js #1091 — this file pins ONLY the redirect row arm
//   reaction-bucket economy ................. CANON turnState #1070; trigger predicate #1018
//   getTargetFromAttacker seam generics ..... consumer tests in its own lane — route-through refusal tokens live below
//   guardian/grant twins .................... monsterGuardianProtection.test.js #1095 / monsterGrantReaction.test.js #1094 (divergent self-legality + spends split live there)
//
// Old -> new (this trim pass):
// - disk shape 5 its -> 1 disk test (+At Will 999 pin, negative discriminate rows folded)
//   + 1 arm/resolver-guard test; te golden REMOVED (owner: golden census #1012);
//   legacy parry/incite byte pins REMOVED (owners: monsterGrantReaction.test.js disk test, parry lane).
// - identity 2 its -> one RAW token it.each (+spell-attack-qualifies, +committed-damage,
//   +missing-attacker legs); redirectGate order + redirectAllyGate unit its REMOVED ->
//   press refusal table route-throughs (#1080), round-first row proves gate precedence.
// - press grant -> STRENGTHENED: exact ordered campaign-keyed setRV census (#932/#1019),
//   verbatim stamp bytes with co-located timestamp split (#1057), full spend/granted log
//   description bytes (#app log mandate), zero-store-read guard (#1035).
// - 5 refusal its -> one 11-token it.each economy table (#903/#1095 shape) covering every
//   production refusal token incl. uses/reacted/attacker/no_target/already-active.
// - resolve consumer: grant+consume now ride the REAL press stamps (arc, #1080);
//   3 hand-forged inert its -> one inert it.each; lapsed leg arc-derived too.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMonsterRedirectAttackRow,
  redirectAllySizeAllowed,
  redirectAllySizes,
  redirectRangeFt,
  redirectIdentityRefusal,
  resolveMonsterRedirectAttackRow,
  consumePendingRedirectOnResolve,
} from './monsterRedirectAttack.js';
import { getGatedMonsterReaction } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';
const BOSS = 'Goblin Boss 1';
const ATTACKER = 'Bandit 1';
const ALLY = 'Bandit 2';
const LATCH_KEY = '_redirect_attack_usedRound';

const goblinBoss = monstersData.find(m => m.index === 'goblin-boss');
const REDIRECT_ROW = goblinBoss.reactions[0];
const banditCaptain = monstersData.find(m => m.index === 'bandit-captain');
const packLord = monstersData.find(m => m.index === 'gnoll-pack-lord');

function pendingHit({ attackerName = ATTACKER, targetName = BOSS, ...rest } = {}) {
  return {
    rollType: 'attack',
    attackerName,
    targetName,
    attackName: 'Scimitar',
    d20: 14,
    bonus: 3,
    total: 17,
    hit: true,
    weaponType: 'melee',
    ...rest,
  };
}

// Byte-distinct actors (#948/#1022): BOSS (original target) vs ALLY (retarget) —
// every swap assertion distinguishes the two identities.
function makeCs({ allySize = 'Medium or Small', armedTarget = ALLY } = {}) {
  return {
    round: 1,
    creatures: [
      { name: BOSS, size: 'Small', targetName: armedTarget },
      { name: ATTACKER, size: 'Medium or Small' },
      { name: ALLY, size: allySize },
    ],
  };
}

function makeDeps({ activeTe = null } = {}) {
  const store = { reactionUses: {}, latches: {}, campaign: {}, te: null, logs: [] };
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te = { campaign, target, effect, source, extra };
    }),
    getActiveTargetEffect: vi.fn(() => activeTe),
    addExpiration: vi.fn(),
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
      if (propertyName === 'monsterReactionUses') return store.reactionUses;
      if (propertyName === 'lastAttack') return store.campaign.lastAttack;
      if (propertyName === 'pendingRedirect') return store.campaign.pendingRedirect;
      return undefined;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
      if (propertyName === 'monsterReactionUses') store.reactionUses = value;
      if (propertyName === LATCH_KEY) store.latches.redirect = value;
      if (characterKey === 'campaign') store.campaign[propertyName] = value;
      return Promise.resolve();
    }),
    addEntry: vi.fn((campaignName, entry) => { store.logs.push(entry); return Promise.resolve(); }),
  };
}

async function press({ lastAttack = pendingHit(), cs = makeCs(), storedUses = {}, usedRound = 0, activeTe = null } = {}) {
  const deps = makeDeps({ activeTe });
  const result = await resolveMonsterRedirectAttackRow({
    action: REDIRECT_ROW,
    monsterName: BOSS,
    campaignName: CAMPAIGN,
    lastAttack,
    cs,
    currentRound: 1,
    storedUses,
    usedRound,
    latchKey: LATCH_KEY,
    deps,
  });
  return { result, deps };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-0891 disk row + registry arm', () => {
  it('pins the goblin-boss Redirect Attack row byte-shape (At Will 999) and only this row discriminates', () => {
    expect(REDIRECT_ROW.name).toBe('Redirect Attack');
    expect(REDIRECT_ROW.trigger).toBe('A creature the goblin can see makes an attack roll against it.');
    expect(REDIRECT_ROW.description).toBe('The goblin chooses a Small or Medium ally within 5 feet of itself. The goblin and that ally swap places, and the ally becomes the target of the attack instead.');
    expect(REDIRECT_ROW.usage).toBe('At Will');
    expect(REDIRECT_ROW.uses).toBe(999);
    expect(REDIRECT_ROW.maxUses).toBe(999);
    expect(REDIRECT_ROW.automation).toEqual({
      type: 'monster_redirect_attack',
      trigger: 'attacked_by_seen',
      effect: 'redirect_attack',
      ally_size: ['Small', 'Medium'],
      range_ft: 5,
    });
    expect(isMonsterRedirectAttackRow(REDIRECT_ROW)).toBe(true);
    expect(redirectRangeFt(REDIRECT_ROW)).toBe(5);
    expect(redirectAllySizes(REDIRECT_ROW)).toEqual(['small', 'medium']);
    // Negative discriminations: type-only automation and every neighbor row refuse.
    expect(isMonsterRedirectAttackRow({ automation: { type: 'monster_redirect_attack' } })).toBe(false);
    expect(isMonsterRedirectAttackRow(banditCaptain.reactions.find(r => r.name === 'Parry'))).toBe(false);
    expect(isMonsterRedirectAttackRow(packLord.actions.find(a => a.name === 'Incite Rampage'))).toBe(false);
    expect(isMonsterRedirectAttackRow(goblinBoss.actions.find(a => a.name === 'Scimitar'))).toBe(false);
  });

  it('arms the gated chip via getGatedMonsterReaction (generic arm owned by gated-reaction.test.js) and a non-redirect row is resolver-inert zero-write', async () => {
    expect(getGatedMonsterReaction(REDIRECT_ROW)).toEqual({ effect: 'redirect_attack', trigger: 'attacked_by_seen', label: 'Redirect Attack', icon: 'fa-right-left' });
    const deps = makeDeps();
    const result = await resolveMonsterRedirectAttackRow({
      action: banditCaptain.reactions.find(r => r.name === 'Parry'),
      monsterName: 'Bandit Captain 1',
      campaignName: CAMPAIGN,
      lastAttack: pendingHit({ targetName: 'Bandit Captain 1' }),
      cs: makeCs(),
      currentRound: 1,
      storedUses: {},
      usedRound: 0,
      latchKey: '_parry_usedRound',
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'not-redirect-attack' });
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.addEntry).not.toHaveBeenCalled();
  });
});

describe('MA-0891 identity + size probes', () => {
  it.each([
    { name: 'no pending attack', attack: null, expected: 'no_pending_attack' },
    { name: 'non-attack roll type (save) never qualifies', attack: pendingHit({ rollType: 'save' }), expected: 'no_pending_attack' },
    { name: 'attack vs a byte-distinct decoy never qualifies', attack: pendingHit({ targetName: ALLY }), expected: 'no_pending_attack' },
    { name: 'miss is nothing to redirect', attack: pendingHit({ hit: false }), expected: 'miss' },
    { name: 'damageApplied flag is too late', attack: pendingHit({ damageApplied: true }), expected: 'resolved' },
    { name: 'committed actualDamage is too late (no Done-undo)', attack: pendingHit({ actualDamage: 7 }), expected: 'resolved' },
    { name: 'already-redirected refuses a double redirect (#949 refuses-not-stacks)', attack: pendingHit({ redirected: true }), expected: 'reacted' },
    { name: 'self-attack has no identifiable attacker to redirect against', attack: pendingHit({ attackerName: BOSS }), expected: 'attacker' },
    { name: 'missing attacker name refuses', attack: { rollType: 'attack', targetName: BOSS, attackName: 'Scimitar', d20: 14, total: 17, hit: true }, expected: 'attacker' },
    { name: 'spell-origin attack vs the Boss QUALIFIES ("makes an attack roll against it")', attack: pendingHit({ rollType: 'spell-attack', weaponType: undefined }), expected: null },
    { name: 'plain pending hit vs the Boss qualifies', attack: pendingHit(), expected: null },
  ])('$name → $expected', ({ attack, expected }) => {
    expect(redirectIdentityRefusal(attack, BOSS)).toBe(expected);
  });

  it('Medium-or-Small stat-block tokens fold; Tiny/Large refuse; unknown sizes stay lenient', () => {
    const allowed = ['small', 'medium'];
    expect(redirectAllySizeAllowed('Medium or Small', allowed)).toBe(true);
    expect(redirectAllySizeAllowed('Small', allowed)).toBe(true);
    expect(redirectAllySizeAllowed('Tiny', allowed)).toBe(false);
    expect(redirectAllySizeAllowed('Large', allowed)).toBe(false);
    expect(redirectAllySizeAllowed('Huge or Gargantuan', allowed)).toBe(false);
    expect(redirectAllySizeAllowed('', allowed)).toBe(true);
  });
});

describe('MA-0891 press economy', () => {
  it('grants: AWAITED ordered campaign-keyed writes latch→uses→pendingRedirect→lastAttack (#932/#1019), verbatim retarget stamps BOSS→ALLY (#1022), te ON THE ALLY rounds:1 + ONE clock, spend-log-before-grant-log exact bytes (#app), NO popupHtml (pending Done survives §217/§235)', async () => {
    const { result, deps } = await press();
    expect(result).toEqual({ resolved: true, effectKey: 'redirect_attack', allyName: ALLY, attackerName: ATTACKER });
    expect(result.popupHtml).toBeUndefined();
    expect(deps.getRuntimeValue).not.toHaveBeenCalled(); // zero store-read on the press lane (#1035)

    const stamp = deps.store.campaign.pendingRedirect;
    const { timestamp, ...stampBytes } = stamp;
    expect(typeof timestamp).toBe('number');
    expect(stampBytes).toEqual({
      attackerName: ATTACKER,
      originalTarget: BOSS,
      newTarget: ALLY,
      by: BOSS,
      attackName: 'Scimitar',
      round: 1,
      lastAttackNonce: 'Scimitar:14:17',
    });

    expect(deps.setRuntimeValue.mock.calls).toEqual([
      [BOSS, LATCH_KEY, 1, CAMPAIGN],
      [BOSS, 'monsterReactionUses', { redirect_attack: 1 }, CAMPAIGN],
      ['campaign', 'pendingRedirect', stamp, CAMPAIGN],
      ['campaign', 'lastAttack', {
        ...pendingHit(),
        redirected: true,
        redirectedBy: BOSS,
        retarget_original: BOSS,
        retarget_to: ALLY,
      }, CAMPAIGN],
    ]);
    expect(deps.store.latches.redirect).toBe(1);

    expect(deps.registerTargetEffect).toHaveBeenCalledWith(CAMPAIGN, ALLY, 'redirect_attack', BOSS, {
      duration: 'rounds',
      rounds: 1,
      actionName: 'Redirect Attack',
    });
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: BOSS,
      targetName: ALLY,
      campaignName: CAMPAIGN,
      rounds: 1,
      effects: [{ type: 'remove_target_effect', effectKey: 'redirect_attack', source: BOSS, target: ALLY }],
    });

    expect(deps.store.logs).toHaveLength(2);
    const [spend, granted] = deps.store.logs;
    expect(spend).toMatchObject({ type: 'ability_use', characterName: BOSS, abilityName: 'Redirect Attack' });
    expect(spend.description).toBe(`${BOSS} uses Redirect Attack (Reaction) against ${ATTACKER}'s Scimitar — ${ALLY} is armed as the redirect target.`);
    expect(granted).toMatchObject({ type: 'automation', automationType: 'redirect_attack_granted', characterName: BOSS, abilityName: 'Redirect Attack' });
    expect(granted.description).toBe(`${BOSS} Redirect Attack: ${ALLY} becomes the target of ${ATTACKER}'s Scimitar — the pending attack now lands on ${ALLY} (press Done to commit it against ${ALLY}). Position swap GM-enforced (gridless advisory, §70); the 5-ft adjacency and ${ALLY}'s Small/Medium eligibility are GM-checked (§42 advisory). Reaction spent — 1 per round.`);
  });

  it.each([
    {
      press: { usedRound: 1, storedUses: { redirect_attack: 998 } },
      reason: 'round',
      note: 'round latch refuses FIRST — fresh armed attack + 998/999 uses still answers round (#1095 precedence)',
    },
    {
      press: { storedUses: { redirect_attack: 999 } },
      reason: 'uses',
      note: 'At Will 999 cap exhausted refuses BEFORE identity',
    },
    { press: { lastAttack: null }, reason: 'no_pending_attack', note: 'identity answers only after round/uses pass' },
    { press: { lastAttack: pendingHit({ hit: false }) }, reason: 'miss', note: '' },
    { press: { lastAttack: pendingHit({ damageApplied: true }) }, reason: 'resolved', note: '' },
    { press: { lastAttack: pendingHit({ redirected: true }) }, reason: 'reacted', note: 'one redirect per attack (#949)' },
    { press: { lastAttack: pendingHit({ attackerName: BOSS }) }, reason: 'attacker', note: '' },
    { press: { cs: makeCs({ armedTarget: null }) }, reason: 'no_target', note: 'GM-armed-ally seam empty' },
    { press: { cs: makeCs({ armedTarget: BOSS }) }, reason: 'self_target', note: 'RAW chooses ANOTHER ally — self refused (diverges from burst twin #1091)' },
    { press: { cs: makeCs({ allySize: 'Tiny' }) }, reason: 'size', note: 'Tiny pets can never take the hit' },
    { press: { activeTe: { target: ALLY, effect: 'redirect_attack' } }, reason: 'already-active', note: 'refuses NOT replaces (#949)' },
  ])('$reason refused — $note, ZERO spend/te/clock/writes (#1026)', async ({ press: args, reason }) => {
    const { result: r, deps } = await press(args);
    expect(r.resolved).toBe(false);
    expect(r.reason).toBe(reason);
    expect(r.popupHtml).toMatch('Redirect Attack Refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.store).toMatchObject({ reactionUses: {}, latches: {}, campaign: {}, te: null });
    expect(deps.store.logs).toHaveLength(1);
    expect(deps.store.logs[0]).toMatchObject({
      type: 'automation',
      automationType: 'redirect_attack_refused',
      automationDetail: reason,
      characterName: BOSS,
      abilityName: 'Redirect Attack',
    });
    expect(deps.store.logs[0].description).toBe(`Redirect Attack refused (${reason}): ${r.message}`);
  });
});

describe('MA-0891 resolve consumer (Done → victim swap)', () => {
  it('ARC: press-armed redirect consumed on Done — victim rewritten to ALLY, campaign-keyed census pending-clear→lastAttack-consumed-stamp, exact applied log, Boss unharmed bytes (#1080 real producer bytes)', async () => {
    const { result, deps } = await press();
    const writesAfterPress = deps.setRuntimeValue.mock.calls.length;
    const context = { damageType: 'Slashing', attackerName: ATTACKER, targetName: BOSS };
    const swap = await consumePendingRedirectOnResolve(CAMPAIGN, context, makeCs(), deps);
    expect(swap).toEqual({ newTarget: result.allyName, originalTarget: BOSS });
    expect(context.targetName).toBe(ALLY);
    expect(deps.store.campaign.pendingRedirect).toBeNull();
    expect(deps.getRuntimeValue.mock.calls).toEqual([
      ['campaign', 'pendingRedirect', CAMPAIGN],
      ['campaign', 'lastAttack', CAMPAIGN],
    ]);
    expect(deps.setRuntimeValue.mock.calls.slice(writesAfterPress)).toEqual([
      ['campaign', 'pendingRedirect', null, CAMPAIGN],
      ['campaign', 'lastAttack', {
        ...pendingHit(),
        redirected: true,
        redirectedBy: BOSS,
        retarget_original: BOSS,
        retarget_to: ALLY,
        redirectConsumed: true,
      }, CAMPAIGN],
    ]);
    expect(deps.store.logs).toHaveLength(3); // spend + granted + applied
    const applied = deps.store.logs[2];
    expect(applied).toMatchObject({ type: 'automation', automationType: 'redirect_attack_applied', characterName: BOSS, abilityName: 'Redirect Attack' });
    expect(applied.description).toBe(`Redirect Attack resolved: ${ATTACKER}'s Scimitar now targets ${ALLY} — damage applies to ${ALLY} (${BOSS} unharmed). Position swap GM-enforced (gridless advisory, §70).`);
  });

  it.each([
    { name: 'no armed redirect is byte-inert', pending: undefined, context: { attackerName: ATTACKER, targetName: BOSS } },
    { name: 'consumed stamp never re-applies', pending: { attackerName: ATTACKER, originalTarget: BOSS, newTarget: ALLY, by: BOSS, consumed: true }, context: { attackerName: ATTACKER, targetName: BOSS } },
    { name: 'attacker mismatch stays inert', pending: { attackerName: 'Bandit 9', originalTarget: BOSS, newTarget: ALLY, by: BOSS }, context: { attackerName: ATTACKER, targetName: BOSS } },
    { name: 'same-attacker fresh swing re-armed on the ALLY stays inert (E2E control)', pending: { attackerName: ATTACKER, originalTarget: BOSS, newTarget: ALLY, by: BOSS }, context: { attackerName: ATTACKER, targetName: ALLY } },
  ])('$name', async ({ pending, context }) => {
    const deps = makeDeps();
    if (pending) deps.store.campaign.pendingRedirect = pending;
    expect(await consumePendingRedirectOnResolve(CAMPAIGN, context, makeCs(), deps)).toBeNull();
    expect(deps.store.campaign.pendingRedirect).toEqual(pending ?? undefined);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.addEntry).not.toHaveBeenCalled();
  });

  // Owner ruling (a) 2026-10-30 (CLOSED-RULING, app-exploration backlog):
  // next-swing ride IS the contract — identity is (attacker, original target),
  // never the stamped nonce. Jinx twin monsterJinx.js pins the mirror leg
  // (consumePendingJinxOnResolve) with the same tuple semantics.
  it('ruling (a) next-swing ride: the real press stamp (nonce Scimitar:14:17) is consumed by the NEXT same-attacker same-original-target resolve even on divergent roll bytes (fresh d20 8/total 11) — nonce forensic, identity is the tuple', async () => {
    const { result, deps } = await press();
    expect(deps.store.campaign.pendingRedirect.lastAttackNonce).toBe('Scimitar:14:17');
    // Original popup abandoned; a fresh d20-8 swing at the BOSS resolves Done.
    deps.store.campaign.lastAttack = pendingHit({ d20: 8, total: 11, redirected: true });
    const context = { damageType: 'Slashing', attackerName: ATTACKER, targetName: BOSS, d20: 8, total: 11 };
    expect(await consumePendingRedirectOnResolve(CAMPAIGN, context, makeCs(), deps)).toEqual({ newTarget: result.allyName, originalTarget: BOSS });
    expect(context.targetName).toBe(ALLY);
    expect(deps.store.campaign.pendingRedirect).toBeNull();
  });

  it('ARC lapsed: ALLY gone from the board at resolve — stamp cleared ONE write, redirect_attack_lapsed logged, damage stays on the popup target, reaction stays spent', async () => {
    const { deps } = await press();
    const context = { damageType: 'Slashing', attackerName: ATTACKER, targetName: BOSS };
    const cs = { round: 1, creatures: [{ name: BOSS, size: 'Small' }, { name: ATTACKER, size: 'Medium or Small' }] };
    expect(await consumePendingRedirectOnResolve(CAMPAIGN, context, cs, deps)).toBeNull();
    expect(context.targetName).toBe(BOSS);
    expect(deps.setRuntimeValue.mock.calls.slice(4)).toEqual([['campaign', 'pendingRedirect', null, CAMPAIGN]]);
    const lapsed = deps.store.logs[2];
    expect(deps.store.logs).toHaveLength(3);
    expect(lapsed).toMatchObject({ type: 'automation', automationType: 'redirect_attack_lapsed', characterName: BOSS });
    expect(lapsed.description).toBe(`Redirect Attack lapsed — ${ALLY} is no longer on the board when ${ATTACKER}'s attack resolved; damage lands on the pending popup's armed target. Reaction stays spent.`);
  });
});
