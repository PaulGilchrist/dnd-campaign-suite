// @maintained-by-ai
// MA-0655/0658 self-buff BASE seam canon — Duergar "Enlarge" + "Invisibility".
// One chip click: already-active latch → MA-0020 uses gate → spend FIRST
// (double-spend guard) → register te ON SELF → ONE merged addExpiration
// clock (§37 single-clock, round-counter — NEVER wall-clock, #app MANDATORY)
// → grant log. Refusals are zero-spend. STR adv + rest-rearm stay §70
// advisory on the grant/popup copy.
//
// Maintainer trim: injected-deps mock theater PURGED (#1137/#1094) — the
// REAL registerTargetEffect/getActiveTargetEffect/spendMonsterAbilityUse run
// on a store-faithful KV (#949); te stamped exact bytes (#993); logs exact
// toBe (#app mandate); honest double/triple press per effect key; already-
// active + exhausted folded into ONE honest press sequence per row with the
// distinct tokens preserved (already_X latch detail vs the MA-0020
// "has already used … today (1/Day)" copy — the te latch wins first).
// te label/icon/cls/group/exactly-once registry bytes → golden
// targetEffectDefinitions.test.js #1012 (:107 enlarged / :110 invisible,
// roster census dedupes) — only the consumer-quoted description clauses stay
// here. Card-row mirrors of other cards never live here (#1132 lesson):
// base pins ONLY the canonical duergar rows + synthetic degenerates (#945).
//
// PRESERVED-CITED-BY (refreshed #1138-#1145 — lanes cite these faces):
//   ender consumer attack/cast/inert (old :371-417, sole owner x7) → ender suite
//   duergar Enlarge disk anchor (old :61) → disk census legs
//   duergar Invisibility disk anchor verbatim (old :216; imp/green-hag/
//     quasit/sprite identity-transitivity) → disk census legs
//   enlarged twin grant/refusal copy byte-identity (old :419; ghost #1138,
//     sea-hag #1143) → builder byte census + press leg
//   already-active + exhausted distinct tokens (old :289-311; rec #1139) → triple press
//   builders minute/hour branches §70 (cited @green-hag #1139) → builder duration-leg table
//   :70/:108 'or uses its Enlarge' quirk owner (#1139) → registry guard + invis press popup
//   te `invisible` description clauses (old :226, cited @imp #1140) → registry copy guards
//   refusal wording canonical 'zero use spent' (#829 cited @#1136) → refusal builder test, exact-once
// old→new map: disk :61-81+:216-224 → disk table; registry :83-92+:226-236 →
// copy guards (shape trimmed-citing golden #1012); grant flows :111-141+
// :255-287 → triple press; refusals :143-163+:165-180+:289-324 → triple
// press (fold, rec #1139); copy :196-203+:419-423 → builder census; guard
// :182-193 → disk admission; ender :371-417 → ender suite (kept, strengthened).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  buildSelfBuffGrantLog,
  buildAlreadyEnlargedRefusalLog,
  buildAlreadyEnlargedRefusalPopup,
  doublePrimaryDiceCount,
  selfBuffRounds,
  endSelfBuffOnTrigger,
} from './monsterSelfBuff.js';
import { getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
import monstersData from '../../../public/data/monsters.json';

const { store, logs, expirations } = vi.hoisted(() => ({ store: {}, logs: [], expirations: [] }));
const TE_KEY = 'campaign|targetEffects|test-campaign';
const usesKey = (name) => `${name}|monsterSpellUses|test-campaign`;
const expKey = (name) => `${name}|pendingExpirations|test-campaign`;

// Store-faithful runtime (#1137): plain KV semantics — the REAL
// registerTargetEffect/getActiveTargetEffect/spendMonsterAbilityUse run on
// top, so the already-active latch and the spend economy are store-backed,
// not injected fixtures (#949).
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
// addExpiration recorder: expirationQueue consumer lanes own queue behavior;
// here the exact ONE-merged-clock stamp IS the contract (§37).
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: (entry) => { expirations.push(entry); },
  KEY: 'pendingExpirations',
}));

const duergar = monstersData.find(m => m.index === 'duergar');
const ENLARGE_ROW = duergar.actions.find(a => a.name === 'Enlarge');
const WAR_PICK = duergar.actions.find(a => a.name === 'War Pick');
const JAVELIN = duergar.actions.find(a => a.name === 'Javelin');
const INVIS_ROW = duergar.actions.find(a => a.name === 'Invisibility');

const snapshot = () => JSON.parse(JSON.stringify(store));

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  logs.length = 0;
  expirations.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-0655/0658 disk rows — canonical duergar anchors + admission truth', () => {
  it.each([
    ['Enlarge', ENLARGE_ROW, 'enlarged', 10],
    ['Invisibility', INVIS_ROW, 'invisible', 600],
  ])('%s row authors monster_self_buff automation + uses verbatim', (_name, row, effect, rounds) => {
    expect(row.automation).toEqual({ type: 'monster_self_buff', effect, rounds });
    expect(row.uses).toBe(1);
    expect(row.maxUses).toBe(1);
    expect(row.usage).toEqual({ type: 'recharge after rest', rest_types: ['short', 'long'] });
    expect(isMonsterSelfBuffRow(row)).toBe(true);
    expect(selfBuffRounds(row)).toBe(rounds);
  });

  it('row-admission census: duergar weapons and degenerate automation shapes never admitted; rounds fallback honest', () => {
    expect(isMonsterSelfBuffRow(WAR_PICK)).toBe(false);
    expect(isMonsterSelfBuffRow(JAVELIN)).toBe(false);
    expect(isMonsterSelfBuffRow({ name: 'No Automation' })).toBe(false);
    expect(isMonsterSelfBuffRow({ automation: { type: 'monster_self_buff' } })).toBe(false);
    expect(selfBuffRounds({ automation: { type: 'monster_self_buff', effect: 'enlarged' } })).toBe(10);
  });

  it('non-self-buff row never resolves — WAR_PICK refuses not-self-buff with zero writes, zero logs, zero clock (its strength_based markers belong to the Modal doubling consumer)', async () => {
    expect(WAR_PICK.strength_based).toBe(true);
    expect(JAVELIN.strength_based).toBe(true);
    const result = await resolveMonsterSelfBuffRow({
      action: WAR_PICK,
      monsterName: 'Duergar 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: {},
      deps: {},
    });
    expect(result).toEqual({ resolved: false, reason: 'not-self-buff' });
    expect(store).toEqual({});
    expect(logs).toHaveLength(0);
    expect(expirations).toHaveLength(0);
  });
});

describe('registry copy guards (shape bytes → golden #1012)', () => {
  it.each([
    ['enlarged', ['doubles its damage dice on Strength-based weapon attacks']],
    ['invisible', ['until it attacks, casts a spell, or uses its Enlarge', 'concentration is broken, up to 1 hour']],
  ])('te "%s" consumer-quoted description clauses stay in force', (effect, phrases) => {
    const def = getEffectDefinition(effect);
    expect(def).toBeDefined();
    for (const phrase of phrases) {
      expect(def.description, `${effect}: ${phrase}`).toContain(phrase);
    }
  });
});

describe('doublePrimaryDiceCount', () => {
  it.each([
    ['1d8 + 2', '2d8 + 2'],
    ['1d6 + 2', '2d6 + 2'],
    ['2d6 + 2', '4d6 + 2'],
    ['1d8', '2d8'],
    ['1d8+2', '2d8+2'],
    ['15', '15'],
    [null, null],
  ])('doubles dice count only, modifier untouched: %s → %s', (formula, doubled) => {
    expect(doublePrimaryDiceCount(formula)).toBe(doubled);
  });
});

describe('builders — grant/refusal copy canon (exact bytes, exact-once)', () => {
  it('grant log bytes: minute + hour duration legs and the honest rounds-only fallback', () => {
    const enlarged = buildSelfBuffGrantLog({ monsterName: 'Duergar 1', action: ENLARGE_ROW, effectKey: 'enlarged', rounds: 10 });
    expect(enlarged.abilityName).toBe('Enlarge');
    expect(enlarged.description).toBe('Duergar 1 Enlarge: te `enlarged` armed on itself for 10 rounds (1 minute) — damage dice on Strength-based weapon attacks doubled by the attack-damage consumer. STR checks/saves advantage and rest-rearm are GM-enforced (§70 advisory).');
    const invisible = buildSelfBuffGrantLog({ monsterName: 'Duergar 1', action: INVIS_ROW, effectKey: 'invisible', rounds: 600 });
    expect(invisible.description).toBe('Duergar 1 Invisibility: te `invisible` armed on itself for 600 rounds (1 hour) — ends when it attacks, casts a spell, or uses its Enlarge (attack/cast/enlarge enders drop the te with an `invisible_ended` log), or when its clock runs out. Concentration-break ender and invisibility advantage/disadvantage adjudication are GM-enforced (§70 advisory).');
    expect(buildSelfBuffGrantLog({ monsterName: 'Duergar 1', action: ENLARGE_ROW, effectKey: 'enlarged', rounds: 2 }).description).toContain('armed on itself for 2 rounds —');
    expect(buildSelfBuffGrantLog({ monsterName: 'Duergar 1', action: INVIS_ROW, effectKey: 'invisible', rounds: 60 }).description).toContain('armed on itself for 60 rounds (6 minutes) —');
    expect(buildSelfBuffGrantLog({ monsterName: 'Blob', effectKey: 'enlarged', rounds: 2 }).abilityName).toBe('Self Buff');
  });

  it('already-active refusal + popup canonical copy, exact-once, per effect slug', () => {
    const enlarged = buildAlreadyEnlargedRefusalLog({ monsterName: 'Duergar 1', action: ENLARGE_ROW, effectKey: 'enlarged' });
    expect(enlarged.automationType).toBe('enlarge_refused');
    expect(enlarged.automationDetail).toBe('already_enlarged');
    expect(enlarged.description).toBe('Duergar 1 is already enlarged — Enlarge refused, zero use spent. Refusal reason: already_enlarged.');
    expect(buildAlreadyEnlargedRefusalPopup({ monsterName: 'Duergar 1', action: ENLARGE_ROW, effectKey: 'enlarged' })).toContain('Already Enlarged');
    const invisible = buildAlreadyEnlargedRefusalLog({ monsterName: 'Duergar 1', action: INVIS_ROW, effectKey: 'invisible' });
    expect(invisible.automationType).toBe('invisibility_refused');
    expect(invisible.automationDetail).toBe('already_invisible');
    expect(invisible.description).toBe('Duergar 1 is already invisible — Invisibility refused, zero use spent. Refusal reason: already_invisible.');
    expect(buildAlreadyEnlargedRefusalPopup({ monsterName: 'Duergar 1', action: INVIS_ROW, effectKey: 'invisible' })).toContain('Already Invisible');
    expect(buildAlreadyEnlargedRefusalLog({ monsterName: 'Blob', effectKey: 'enlarged' }).automationType).toBe('enlarged_refused');
  });
});

describe('MA-0655/0658 honest triple press — store-faithful: grant → already-active → (RAW ender) → exhausted', () => {
  it.each([
    {
      effect: 'enlarged', row: ENLARGE_ROW, rounds: 10,
      grantDesc: 'Duergar 1 Enlarge: te `enlarged` armed on itself for 10 rounds (1 minute) — damage dice on Strength-based weapon attacks doubled by the attack-damage consumer. STR checks/saves advantage and rest-rearm are GM-enforced (§70 advisory).',
      popupPhrase: 'grows to Large',
    },
    {
      effect: 'invisible', row: INVIS_ROW, rounds: 600,
      grantDesc: 'Duergar 1 Invisibility: te `invisible` armed on itself for 600 rounds (1 hour) — ends when it attacks, casts a spell, or uses its Enlarge (attack/cast/enlarge enders drop the te with an `invisible_ended` log), or when its clock runs out. Concentration-break ender and invisibility advantage/disadvantage adjudication are GM-enforced (§70 advisory).',
      popupPhrase: 'Ends on attack, spell cast, or Enlarge',
    },
  ])('$effect: press 1 spends before arming ONE merged rounds:$rounds clock; press 2 refuses already-$effect zero-spend off the REAL store latch; ender drops te; press 3 refuses exhausted with the distinct MA-0020 token', async ({ effect, row, rounds, grantDesc, popupPhrase }) => {
    const monster = 'Duergar 1';
    // Loud PC decoy (#948/#1057): same effect key on another target neither
    // blocks the press nor is ever disturbed.
    store[TE_KEY] = [{ target: 'PC 1', effect, source: 'Archfey', duration: 'minute' }];
    const setPopupHtml = vi.fn();
    const press = () => resolveMonsterSelfBuffRow({
      action: row,
      monsterName: monster,
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: store[usesKey(monster)] || {},
      deps: {},
    });

    const first = await press();
    expect(first).toEqual({ resolved: true, effectKey: effect, rounds, remaining: 0, thp: null, allyNames: [] });
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect, source: 'Archfey', duration: 'minute' },
      { target: monster, effect, source: monster, duration: 'minute', rounds, actionName: row.name },
    ]);
    expect(expirations).toEqual([{
      attackerName: monster,
      targetName: monster,
      campaignName: 'test-campaign',
      rounds,
      effects: [{ type: 'remove_target_effect', effectKey: effect, source: monster, target: monster }],
    }]);
    // Spend BEFORE arming evidence: ability_use is log[0], grant log[1] — exact bytes.
    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual({
      type: 'ability_use',
      characterName: monster,
      abilityName: row.name,
      description: `Duergar 1 uses ${row.name} — 1 use spent, 0 left today (resets at dawn, GM-enforced for monsters).`,
      timestamp: expect.any(Number),
    });
    expect(logs[1]).toEqual({
      type: 'automation',
      automationType: `${effect}_granted`,
      characterName: monster,
      abilityName: row.name,
      description: grantDesc,
      timestamp: expect.any(Number),
    });
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining(popupPhrase));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('0 use(s) left'));

    // Press 2 — te latch read off REAL store bytes; latch wins before the
    // now-exhausted uses gate (storedUses comes from the store too).
    const afterFirst = snapshot();
    const second = await press();
    expect(second).toEqual({ resolved: false, reason: 'already-active' });
    expect(snapshot()).toEqual(afterFirst); // zero-write census (#1026)
    expect(logs[2].automationDetail).toBe(`already_${effect}`);
    expect(logs[2].description).toBe(`Duergar 1 is already ${effect} — ${row.name} refused, zero use spent. Refusal reason: already_${effect}.`);
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining(`Already ${effect.charAt(0).toUpperCase()}${effect.slice(1)}`));

    // RAW end trigger drops the self te via the real consumer.
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: monster, effectKey: effect, trigger: 'attack', actionName: 'War Pick', deps: {} });
    expect(dropped).toBe(true);
    expect(store[TE_KEY]).toEqual([{ target: 'PC 1', effect, source: 'Archfey', duration: 'minute' }]);

    // Press 3 — te gone, uses spent: exhausted gate refusal carries the
    // DISTINCT MA-0020 token (no already_X detail, "has already used … today").
    const third = await press();
    expect(third).toEqual({ resolved: false, reason: 'exhausted' });
    const exhaustedLog = logs[logs.length - 1];
    expect(exhaustedLog.automationType).toBe(`${effect === 'enlarged' ? 'enlarge' : 'invisibility'}_refused`);
    expect(exhaustedLog.automationDetail).toBeUndefined();
    expect(exhaustedLog.description).toBe(`Duergar 1 has already used ${row.name} today (1/Day) — ${row.name} refused. Uses reset at dawn; GM-enforced for monsters.`);
    expect(store[TE_KEY]).toEqual([{ target: 'PC 1', effect, source: 'Archfey', duration: 'minute' }]);
    expect(store[usesKey(monster)]).toEqual({ [row.name]: 1 });
    expect(expirations).toHaveLength(1);
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining('Uses Exhausted'));
  });
});

describe('mid-flight double-spend guard (#1136-class fix#79 census — silent log-only refusal closed)', () => {
  it('gate fresh on stale snapshot but store already spent: refuses exhausted — zero te, zero spend write, reason-distinct refusal popup exact bytes, grant NEVER lands', async () => {
    const monster = 'Duergar 1';
    // Raced second click: its storedUses snapshot is stale (fresh gate), but
    // the winning click already burned the 1/Day use in the live store while
    // no te is visible yet (registered synchronously AFTER the spend) — the
    // spendMonsterAbilityUse double-spend guard refuses mid-flight.
    store[usesKey(monster)] = { Enlarge: 1 };
    // Injected store-faithful deps honoring the production TWO-arg
    // getRuntimeValue signature (useRuntimeState.js:63) so the
    // spendMonsterAbilityUse re-read actually sees the raced write.
    const deps = {
      getRuntimeValue: (name, key) => store[`${name}|${key}|test-campaign`],
      setRuntimeValue: (name, key, value, campaign) => { store[`${name}|${key}|${campaign}`] = value; return Promise.resolve(); },
    };
    const setPopupHtml = vi.fn();
    const guard = vi.spyOn(console, 'error');
    const result = await resolveMonsterSelfBuffRow({
      action: ENLARGE_ROW,
      monsterName: monster,
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {}, // stale mid-flight snapshot slips past the gate
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(store[TE_KEY]).toBeUndefined(); // zero te
    expect(store[usesKey(monster)]).toEqual({ Enlarge: 1 }); // store unchanged, zero burn (#1026)
    expect(expirations).toHaveLength(0); // zero clock
    expect(guard).toHaveBeenCalledTimes(1); // guard stays loud (audit side already correct, fix#79)
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('enlarge_refused');
    expect(logs[0].description).toBe('Duergar 1 has already used Enlarge today (1/Day) — Enlarge refused. Uses reset at dawn; GM-enforced for monsters.');
    expect(logs.some(l => l.automationType === 'enlarged_granted')).toBe(false); // grant never lands after refusal
    // FIX#79 recipe (#1136 precedent, monsterSelfAura.js:90-98): the raced
    // second click now ANSWERS in the UI — reason-distinct 'Already Buffing'
    // (never the 'Uses Exhausted' gate headline, never the 'Already Enlarged'
    // te-latch headline — #1348), same mc-prerequisite-refusal family cls.
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Already Buffing</h3><p>Duergar 1 is already buffing via Enlarge — a preceding click spent the 1/Day use. Enlarge refused: no second use spent, no buff re-applied. Uses reset at dawn (GM-enforced for monsters).</p></div>');
  });
});

describe('MA-0658 enlarge ender inside the grant seam', () => {
  it('granting Enlarge while invisible drops self te invisible + cancels its clock KV + ends_on_enlarge byte log; enlarged still granted', async () => {
    const monster = 'Duergar 1';
    store[TE_KEY] = [{ target: monster, effect: 'invisible', source: monster, duration: 'minute', rounds: 600, actionName: 'Invisibility' }];
    store[expKey(monster)] = [{
      target: monster,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: monster, target: monster }],
      appliedRound: 1,
      expiryRounds: 600,
      expireOnCreatureName: null,
    }];
    const result = await resolveMonsterSelfBuffRow({
      action: ENLARGE_ROW,
      monsterName: monster,
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: {},
      deps: {},
    });
    expect(result.resolved).toBe(true);
    expect(store[TE_KEY]).toEqual([
      { target: monster, effect: 'enlarged', source: monster, duration: 'minute', rounds: 10, actionName: 'Enlarge' },
    ]);
    expect(store[expKey(monster)]).toEqual([]);
    expect(expirations).toHaveLength(1);
    expect(logs.map(l => l.automationType || l.type)).toEqual(['ability_use', 'invisible_ended', 'enlarged_granted']);
    expect(logs[1]).toEqual({
      type: 'automation',
      automationType: 'invisible_ended',
      automationDetail: 'ends_on_enlarge',
      characterName: monster,
      abilityName: 'Enlarge',
      description: "Duergar 1's invisible ends on enlarge — te `invisible` dropped and its expiration clock cancelled.",
      timestamp: expect.any(Number),
    });
  });
});

describe('MA-0658 endSelfBuffOnTrigger ender consumer (sole owner — cited x7 by the invisibility/ethereality lanes)', () => {
  it.each([
    ['attack', 'War Pick', 'ends_on_attack', "Duergar 1's invisible ends on attack — te `invisible` dropped and its expiration clock cancelled."],
    ['cast', 'Invisibility', 'ends_on_cast', "Duergar 1's invisible ends on cast — te `invisible` dropped and its expiration clock cancelled."],
  ])('%s trigger: drops self te, cancels the merged clock entry, decoys survive, ONE exact byte log', async (trigger, actionName, detail, desc) => {
    const monster = 'Duergar 1';
    store[TE_KEY] = [
      { target: monster, effect: 'invisible', source: monster },
      { target: 'PC 1', effect: 'bless', source: 'Cleric' },
    ];
    store[expKey(monster)] = [
      { target: monster, effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: monster, target: monster }], appliedRound: 1, expiryRounds: 600, expireOnCreatureName: null },
      { target: monster, effects: [{ type: 'remove_target_effect', effectKey: 'other', source: 'X', target: monster }], appliedRound: 1, expiryRounds: 5, expireOnCreatureName: null },
    ];
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: monster, effectKey: 'invisible', trigger, actionName, deps: {} });
    expect(dropped).toBe(true);
    expect(store[TE_KEY]).toEqual([{ target: 'PC 1', effect: 'bless', source: 'Cleric' }]);
    expect(store[expKey(monster)]).toEqual([
      { target: monster, effects: [{ type: 'remove_target_effect', effectKey: 'other', source: 'X', target: monster }], appliedRound: 1, expiryRounds: 5, expireOnCreatureName: null },
    ]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual({
      type: 'automation',
      automationType: 'invisible_ended',
      automationDetail: detail,
      characterName: monster,
      abilityName: actionName,
      description: desc,
      timestamp: expect.any(Number),
    });
  });

  it('inert without a SELF-origin te: PC-sourced te and empty/absent stores return false with zero writes and zero logs (#1026)', async () => {
    const monster = 'Duergar 1';
    expect(await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: monster, effectKey: 'invisible', trigger: 'attack', actionName: 'War Pick', deps: {} })).toBe(false);
    store[TE_KEY] = [{ target: monster, effect: 'invisible', source: 'Drow Mage 1' }];
    expect(await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: monster, effectKey: 'invisible', trigger: 'attack', actionName: 'War Pick', deps: {} })).toBe(false);
    expect(store).toEqual({ [TE_KEY]: [{ target: monster, effect: 'invisible', source: 'Drow Mage 1' }] });
    expect(logs).toHaveLength(0);
  });
});
