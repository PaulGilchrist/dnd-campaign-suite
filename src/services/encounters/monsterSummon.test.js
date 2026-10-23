// @maintained-by-ai
// MA-0648 CANON: monster_summon lane base — Drow Mage "Summon Demon" (1/Day
// gate → d100 coin flip ≤50 shadow-demon else quasit fallback → spawn into
// combatSummary as ally right after caster → te "summoned" → logs), extended
// by MA-0651 (no-fallback failed flip routes authored self-damage through
// applyDamageToTarget), MA-0664 (count dice rolls ONLY after the flip
// lands), MA-0757/0759/1604 (chance-less guaranteed constant-count self-
// summons: zero dice, stat_override stamp, self-summon guard strips
// monster_summon actions), MA-1215 (recharge-gated consult/spend FIRST via
// the live MA-0031 map; unauthored duration rides advisory verbatim — never
// a fabricated "10 minutes") and MA-1729 (chance-less corpse-rise advisory).
//
// PRESERVED-CITED-BY (monsterSummon.orcus-conjure-undead.test.js #1154/MA-1957
// and monsterSummon.sun-wukong-monkey-clones.test.js #1155/MA-2009 cite these
// behaviors — refreshed ranges this cycle):
//  - isMonsterSummonRow truth table :132-138 + coin-flip boundary/fallback
//    generics + chance-less guarantee + consumed-vs-never RNG pins :140-157
//    — folds old :75-101, :243, :250, :383-386, :546-550, :916-920, :1075-1079;
//  - 1/Day exhausted refusal byte-shape :193-205 — old :153-173;
//  - count-dice-after-flip + unique-name multi-spawn + ONE summons log
//    :333-360 (zero-count honest fail :319-331) — old :412-447 (+ :390);
//  - constant-count ZERO-dice twin press :420-476 (galeb-duhr leg)
//    — old :553-598;
//  - duration-kind honest legs: sovereign advisory verbatim :541-546
//    — old :810-817; wraith advisory verbatim :633-640 — old :1064-1072.
//
// OLD -> NEW MAP / DUP-MAP (#1038 — every cut cites its owner):
//  45 tests -> 23. Adjudication standalones (:84/:89/:94/:243/:250/:383/:546/
//  :916/:1075) -> $-table with per-leg consumed-pin (chance rows flip EXACTLY
//  once, #1072) and never-pin (chance-less). Disk trawls (:68 etc) -> by-name
//  ac/hp pins folded into each data lock. :188 collision standalone -> covered
//  by count press collision census + success press empty-board base name.
//  :340 builder standalone -> self-damage press exact bytes. :449 count-1 ->
//  empty-board branch lives in the success press; dice-count owned by :412 leg.
//  :600-612 'MA-0648 twin byte-unchanged' DELETED per #1154 rec — re-drove the
//  success press already owned at old :104-134 (flip + coin-flip log both
//  asserted there, now exact toBe + RNG consumed-pin; #1116 no-card-mirror).
//  Extra exhausted standalones (:463/:614/:693/:970) -> refusal shape canon
//  here once + monsterAbilityUses.test.js #829/#1082 slug derivation; galib
//  press (:656) is a galeb byte-mirror (MA-0757 ticket rides same seam) —
//  galib still rides the resolver in the legacy-twins zero-write census.
//  Galib/treant data standalones -> twins it.each. :846 recovery walk ->
//  monsterRecharge.test.js gate truth-table + d6 recovery lifecycle own the
//  axis; fresh(:786)/spent(:820) store states both pinned here.
//  Lifecycle→summonedCreatureService.test.js (#1067) cited, not re-driven.
//  Zones enforcement is OFF in this harness ⇒ NO duration_clock_armed clock
//  ever arms — pinned in every spawn press (seams, NEVER wall-clock).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isMonsterSummonRow, adjudicateSummonAttempt, resolveMonsterSummonRow } from './monsterSummon.js';
import { MONSTER_RECHARGE_KEY } from './monsterRecharge.js';
import monstersData from '../../../public/data/monsters.json';

const drowMage = monstersData.find(m => m.index === 'drow-mage');
const SUMMON_ROW = drowMage.actions[1];
const quasit = monstersData.find(m => m.index === 'quasit');
const shadowDemon = monstersData.find(m => m.index === 'shadow-demon');

const priestess = monstersData.find(m => m.index === 'drow-priestess-of-lolth');
const PRIESTESS_ROW = priestess.actions.find(a => a.name === 'Summon Demon');
const yochlol = monstersData.find(m => m.index === 'yochlol');

const dustMephit = monstersData.find(m => m.index === 'dust-mephit');
const SUMMON_MEPHITS_ROW = dustMephit.actions[2];

const galebDuhr = monstersData.find(m => m.index === 'galeb-duhr');
const ANIMATE_ROW = galebDuhr.actions[1];
const galibDuhr = monstersData.find(m => m.index === 'galib-duhr');
const GALIB_ANIMATE_ROW = galibDuhr.actions[1];
const treant = monstersData.find(m => m.index === 'treant');
const TREANT_ANIMATE_ROW = treant.actions[3];

const sovereign = monstersData.find(m => m.index === 'myconid-sovereign');
const ANIMATING_ROW = sovereign.actions.find(a => a.name === 'Animating Spores');
const sporeServant = monstersData.find(m => m.index === 'myconid-spore-servant');
const SOV_ADV = ANIMATING_ROW.automation.advisory;

const wraith = monstersData.find(m => m.index === 'wraith');
const CREATE_SPECTER_ROW = wraith.actions.find(a => a.name === 'Create Specter');
const specter = monstersData.find(m => m.index === 'specter');
const WR_ADV = CREATE_SPECTER_ROW.automation.advisory;

function makeDeps(stored = {}, roll = 50) {
  const store = { logs: [], ...stored };
  return {
    store,
    rollDie: vi.fn(() => roll),
    monsters: [quasit, shadowDemon],
    skipDomEvents: true,
    getCombatSummary: vi.fn(() => store.cs),
    setCombatSummary: vi.fn(cs => { store.cs = cs; }),
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te = { campaign, target, effect, source, extra };
    }),
    getRuntimeValue: vi.fn(() => store.uses || {}),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
    get logs() { return store.logs; },
  };
}

async function press(action, monsterName, deps, storedUses = {}) {
  const setPopupHtml = vi.fn();
  const result = await resolveMonsterSummonRow({ action, monsterName, campaignName: 'test-campaign', setPopupHtml, storedUses, deps });
  return { result, setPopupHtml };
}

afterEach(() => vi.restoreAllMocks());

describe('MA-0648 disk data shape', () => {
  it('drow-mage Summon Demon row: monster_summon automation + numeric uses; spawn targets pinned by name', () => {
    expect(SUMMON_ROW.name).toBe('Summon Demon');
    expect(SUMMON_ROW.automation).toEqual({
      type: 'monster_summon',
      options: [
        { monster: 'quasit' },
        { monster: 'shadow-demon', chance: 0.5 },
      ],
      range_ft: 60,
      duration_minutes: 10,
    });
    expect(SUMMON_ROW.uses).toBe(1);
    expect(SUMMON_ROW.maxUses).toBe(1);
    expect(SUMMON_ROW.usage).toEqual({ type: 'per day', times: 1 });
    expect(SUMMON_ROW.save_dc).toBeUndefined();
    expect(SUMMON_ROW.attack_bonus).toBeUndefined();
    expect(quasit).toMatchObject({ name: 'Quasit', armor_class: 13, hit_points: 25 });
    expect(quasit.actions[0].name).toBe('Rend');
    expect(shadowDemon).toMatchObject({ name: 'Shadow Demon', armor_class: 14, hit_points: 66 });
    expect(shadowDemon.actions.map(a => a.name)).toEqual(['Umbral Claw']);
  });

  it('isMonsterSummonRow: only monster_summon rows with options arm', () => {
    expect(isMonsterSummonRow(SUMMON_ROW)).toBe(true);
    expect(isMonsterSummonRow(drowMage.actions[0])).toBe(false);
    expect(isMonsterSummonRow({ automation: { type: 'monster_summon', options: [] } })).toBe(false);
    expect(isMonsterSummonRow(null)).toBe(false);
  });
});

describe('coin-flip adjudication — boundary/fallback/chance-less census', () => {
  const LEGS = [
    { label: 'drow-mage d100 50 boundary lands the shadow-demon attempt', options: SUMMON_ROW.automation.options, roll: 50, flips: true, verdict: { monster: 'shadow-demon', roll: 50, success: true, chance: 0.5 } },
    { label: 'drow-mage d100 51 misses to the chance-less quasit fallback', options: SUMMON_ROW.automation.options, roll: 51, flips: true, verdict: { monster: 'quasit', roll: 51, success: false, chance: 0.5 } },
    { label: 'priestess per-row chance: d100 30 lands yochlol at 30%', options: PRIESTESS_ROW.automation.options, roll: 30, flips: true, verdict: { monster: 'yochlol', roll: 30, success: true, chance: 0.3 } },
    { label: 'priestess d100 31 fails with NO fallback: monster null routes self-damage', options: PRIESTESS_ROW.automation.options, roll: 31, flips: true, verdict: { monster: null, roll: 31, success: false, chance: 0.3 } },
    { label: 'dust-mephit d100 25 boundary lands at 25%', options: SUMMON_MEPHITS_ROW.automation.options, roll: 25, flips: true, verdict: { monster: 'dust-mephit', roll: 25, success: true, chance: 0.25 } },
    { label: 'dust-mephit d100 26 fails, no fallback: monster null', options: SUMMON_MEPHITS_ROW.automation.options, roll: 26, flips: true, verdict: { monster: null, roll: 26, success: false, chance: 0.25 } },
    { label: 'galeb-duhr chance-less is guaranteed: zero d100 flipped', options: ANIMATE_ROW.automation.options, roll: 50, flips: false, verdict: { monster: 'galeb-duhr', roll: null, success: true, chance: null } },
    { label: 'treant chance-less is guaranteed: zero d100 flipped', options: TREANT_ANIMATE_ROW.automation.options, roll: 50, flips: false, verdict: { monster: 'treant', roll: null, success: true, chance: null } },
    { label: 'wraith chance-less rise is guaranteed: zero d100 flipped', options: CREATE_SPECTER_ROW.automation.options, roll: 50, flips: false, verdict: { monster: 'specter', roll: null, success: true, chance: null } },
  ];
  it.each(LEGS)('$label', ({ options, roll, flips, verdict }) => {
    const rollFn = vi.fn(() => roll);
    expect(adjudicateSummonAttempt(options, rollFn)).toEqual(verdict);
    expect(rollFn).toHaveBeenCalledTimes(flips ? 1 : 0);
  });
});

describe('MA-0648 drow mage activation', () => {
  it('success d100 42: spends 1/Day, spawns Shadow Demon right after the caster, te @10_minutes, exact flip/spawn/popup bytes, ZERO clock armed', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', type: 'npc', initiative: '12' }] } }, 42);
    const { result, setPopupHtml } = await press(SUMMON_ROW, 'Drow Mage 1', deps);
    expect(result).toMatchObject({ resolved: true, summonedName: 'Shadow Demon', summonedNames: ['Shadow Demon'], countRoll: null, verdict: { monster: 'shadow-demon', roll: 42, success: true, chance: 0.5 }, remaining: 0 });
    expect(deps.rollDie).toHaveBeenCalledTimes(1);
    expect(deps.store.uses).toEqual({ 'Summon Demon': 1 });
    const spawned = deps.store.cs.creatures.find(c => c.name === 'Shadow Demon');
    expect(spawned).toMatchObject({ type: 'npc', monsterIndex: 'shadow-demon', ac: 14, maxHp: 66, currentHp: 66, summonedBy: 'Drow Mage 1', summonSource: 'monster_ability', initiative: '11.9' });
    expect(spawned.actions[0].name).toBe('Umbral Claw');
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Shadow Demon', 'summoned', 'Drow Mage 1', { duration: '10_minutes' });
    expect(deps.setCombatSummary).toHaveBeenCalledTimes(1);
    const flipLog = deps.logs.find(e => e.rollType === 'monster_summon_coin_flip');
    expect(flipLog).toMatchObject({ type: 'roll', characterName: 'Drow Mage 1', rolls: [42], total: 42 });
    expect(flipLog.description).toBe('Drow Mage 1 flips for Summon Demon: d100 42 vs 50% — success, summons shadow-demon.');
    const spawnLog = deps.logs.find(e => e.type === 'summons');
    expect(spawnLog.summonedCreatures).toEqual(['Shadow Demon']);
    expect(spawnLog.description).toBe('Drow Mage 1 summons Shadow Demon via Summon Demon — ally of Drow Mage 1, appears within 60 ft, remains 10 minutes (expiry clock, dismiss-as-action and "can\'t summon other creature" are §70 GM-enforced residuals).');
    expect(deps.logs.find(e => e.type === 'ability_use').description).toContain('Summon Demon');
    expect(deps.logs.find(e => e.type === 'ability_use').description).toContain('0 left today');
    expect(deps.logs.some(e => e.automationType === 'duration_clock_armed')).toBe(false);
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Drow Mage 1 summons Shadow Demon</h3><p>Coin flip: d100 42 — summon attempt succeeds.\nShadow Demon joins the fight as an ally of Drow Mage 1, acting right after it, for 10 minutes (§70 expiry GM-enforced). 0 use(s) left today (resets at dawn, GM-enforced).</p></div>');
  });

  it('failed d100 77: the chance-less quasit fallback still spawns (ac 13/hp 25 block) with the honest miss log', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', type: 'npc', initiative: '8' }] } }, 77);
    const { result, setPopupHtml } = await press(SUMMON_ROW, 'Drow Mage 1', deps);
    expect(result).toMatchObject({ resolved: true, summonedName: 'Quasit', verdict: { monster: 'quasit', roll: 77, success: false } });
    const spawned = deps.store.cs.creatures.find(c => c.name === 'Quasit');
    expect(spawned).toMatchObject({ type: 'npc', monsterIndex: 'quasit', ac: 13, maxHp: 25, currentHp: 25, summonedBy: 'Drow Mage 1', summonSource: 'monster_ability', initiative: '7.9' });
    expect(deps.logs.find(e => e.rollType === 'monster_summon_coin_flip').description).toBe('Drow Mage 1 flips for Summon Demon: d100 77 vs 50% — failure, falls back to quasit.');
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Drow Mage 1 summons Quasit</h3><p>Coin flip: d100 77 — attempt fails.\nQuasit joins the fight as an ally of Drow Mage 1, acting right after it, for 10 minutes (§70 expiry GM-enforced). 0 use(s) left today (resets at dawn, GM-enforced).</p></div>');
  });

  it('second same-day click: refused with summon_demon_refused, zero roll/spend/spawn/te', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', initiative: '12' }] }, uses: { 'Summon Demon': 1 } });
    const { result, setPopupHtml } = await press(SUMMON_ROW, 'Drow Mage 1', deps, { 'Summon Demon': 1 });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    const refusal = deps.logs.find(e => e.automationType === 'summon_demon_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toContain('already used Summon Demon today');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Uses Exhausted'));
  });

  it('mid-flight double-spend guard (#1136-class fix#79 census): gate fresh on stale snapshot but store already spent — refuses exhausted, zero roll/spend/spawn/te, reason-distinct refusal popup exact bytes', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', initiative: '12' }] }, uses: { 'Summon Demon': 1 } }, 42);
    const setPopupHtml = vi.fn();
    const guard = vi.spyOn(console, 'error');
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Drow Mage 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {}, // stale mid-flight snapshot slips past the gate
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled(); // zero flip
    expect(deps.setRuntimeValue).not.toHaveBeenCalled(); // zero burn (#1026)
    expect(deps.store.uses).toEqual({ 'Summon Demon': 1 }); // store unchanged
    expect(deps.setCombatSummary).not.toHaveBeenCalled(); // zero spawn
    expect(deps.registerTargetEffect).not.toHaveBeenCalled(); // zero te
    const logs = deps.logs;
    expect(logs.filter(e => e.type === 'ability_use')).toHaveLength(0); // no spend logged
    const refusal = logs.find(e => e.automationType === 'summon_demon_refused');
    expect(refusal).toBeTruthy(); // audit side already correct (fix#79)
    expect(refusal.description).toContain('already used Summon Demon today');
    expect(guard).toHaveBeenCalledTimes(1); // guard stays loud
    // FIX#79 recipe (#1136 precedent): the raced second click answers in the
    // UI — reason-distinct 'Already Summoning', never the 'Uses Exhausted'
    // gate headline (#1348), same mc-prerequisite-refusal family cls.
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Already Summoning</h3><p>Drow Mage 1 is already summoning via Summon Demon — a preceding click spent the 1/Day use. Summon Demon refused: no second use spent, no summons arrive. Uses reset at dawn (GM-enforced for monsters).</p></div>');
  });

  it('non-summon rows never route', async () => {
    const deps = makeDeps();
    const { result } = await press(drowMage.actions[0], 'Drow Mage 1', deps);
    expect(result).toEqual({ resolved: false, reason: 'not-monster-summon' });
    expect(deps.logs).toHaveLength(0);
  });
});

describe('MA-0651 priestess self-damage summon', () => {
  function makeSelfDmgDeps(cs, roll, dmgRoll = { total: 7, rolls: [7], modifier: 0, formula: '1d10' }) {
    const deps = makeDeps({ cs }, roll);
    deps.monsters = [yochlol];
    deps.rollExpression = vi.fn(() => dmgRoll);
    deps.applyDamageToTarget = vi.fn(async (summary, target, raw) => {
      const c = summary.creatures.find(x => x.name === target);
      c.currentHp -= raw;
      return { finalDamage: raw, newHp: c.currentHp };
    });
    return deps;
  }

  const PRIESTESS_CS = () => ({ round: 1, creatures: [{ name: 'Drow Priestess of Lolth', type: 'npc', initiative: '15', currentHp: 113, maxHp: 113 }] });

  it('disk byte-shape: yochlol 30% + structured self-damage + uses 3; yochlol target pinned', () => {
    expect(isMonsterSummonRow(PRIESTESS_ROW)).toBe(true);
    expect(PRIESTESS_ROW.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'yochlol', chance: 0.3 }],
      self_damage_formula: '1d10',
      self_damage_type: 'psychic',
      range_ft: 60,
      duration_minutes: 10,
    });
    expect(PRIESTESS_ROW.uses).toBe(3);
    expect(PRIESTESS_ROW.maxUses).toBe(3);
    expect(PRIESTESS_ROW.description).toContain('1d10');
    expect(PRIESTESS_ROW.description).not.toContain('1dlO');
    expect(yochlol).toMatchObject({ name: 'Yochlol', armor_class: 15, hit_points: 153 });
  });

  it('failed d100 88: 1/3 spent, zero spawn/te, 1d10 psychic backlash applied via applyDamageToTarget with exact log/popup bytes; success d100 30 NEVER rolls backlash', async () => {
    const failDeps = makeSelfDmgDeps(PRIESTESS_CS(), 88);
    const { result: fail, setPopupHtml } = await press(PRIESTESS_ROW, 'Drow Priestess of Lolth', failDeps);
    expect(fail).toMatchObject({ resolved: true, summonedName: null, remaining: 2 });
    expect(failDeps.store.uses).toEqual({ 'Summon Demon': 1 });
    expect(failDeps.store.cs.creatures.some(c => c.name === 'Yochlol')).toBe(false);
    expect(failDeps.registerTargetEffect).not.toHaveBeenCalled();
    expect(failDeps.rollExpression).toHaveBeenCalledWith('1d10');
    expect(failDeps.applyDamageToTarget).toHaveBeenCalledWith(failDeps.store.cs, 'Drow Priestess of Lolth', 7, ['psychic'], { campaignName: 'test-campaign', characters: [], attackerName: 'Drow Priestess of Lolth' });
    expect(failDeps.store.cs.creatures[0].currentHp).toBe(106);
    expect(failDeps.logs.find(e => e.rollType === 'monster_summon_coin_flip').description).toBe('Drow Priestess of Lolth flips for Summon Demon: d100 88 vs 30% — failure, no summon answers.');
    const dmgLog = failDeps.logs.find(e => e.rollType === 'monster_summon_self_damage');
    expect(dmgLog).toMatchObject({ type: 'roll damage', characterName: 'Drow Priestess of Lolth', rolls: [7], total: 7, damageType: 'psychic', formula: '1d10' });
    expect(dmgLog.description).toBe('Drow Priestess of Lolth\'s Summon Demon attempt fails — it takes 7 psychic damage (rolled 7).');
    expect(failDeps.logs.some(e => e.type === 'summons')).toBe(false);
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Drow Priestess of Lolth\'s summon fails</h3><p>Coin flip: d100 88 — attempt fails.\nNo summon answers the call. Drow Priestess of Lolth takes 7 psychic damage (rolled 7). 2 use(s) left today (resets at dawn, GM-enforced).</p></div>');

    const okDeps = makeSelfDmgDeps(PRIESTESS_CS(), 30);
    const { result: ok } = await press(PRIESTESS_ROW, 'Drow Priestess of Lolth', okDeps);
    expect(ok).toMatchObject({ resolved: true, summonedName: 'Yochlol', remaining: 2 });
    const spawned = okDeps.store.cs.creatures.find(c => c.name === 'Yochlol');
    expect(spawned).toMatchObject({ monsterIndex: 'yochlol', ac: 15, maxHp: 153, summonedBy: 'Drow Priestess of Lolth', summonSource: 'monster_ability', initiative: '14.9' });
    expect(okDeps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Yochlol', 'summoned', 'Drow Priestess of Lolth', { duration: '10_minutes' });
    expect(okDeps.rollExpression).not.toHaveBeenCalled();
    expect(okDeps.applyDamageToTarget).not.toHaveBeenCalled();
    expect(okDeps.store.cs.creatures.find(c => c.name === 'Drow Priestess of Lolth').currentHp).toBe(113);
    expect(okDeps.logs.some(e => e.type === 'summons')).toBe(true);
  });

  it('exhausted at 3/3: refused with summon_demon_refused, ZERO dice, ZERO backlash, zero spawn/spend', async () => {
    const deps = makeSelfDmgDeps(PRIESTESS_CS(), 88);
    deps.store.uses = { 'Summon Demon': 3 };
    const { result, setPopupHtml } = await press(PRIESTESS_ROW, 'Drow Priestess of Lolth', deps, { 'Summon Demon': 3 });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.applyDamageToTarget).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.cs.creatures[0].currentHp).toBe(113);
    expect(deps.store.uses).toEqual({ 'Summon Demon': 3 });
    expect(deps.logs.find(e => e.automationType === 'summon_demon_refused')).toBeTruthy();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Uses Exhausted'));
  });
});

describe('MA-0664 dust-mephit count summon', () => {
  function makeCountDeps(cs, coin, countRoll = { total: 3, rolls: [1, 1, 1], modifier: 0, formula: '1d4' }) {
    const deps = makeDeps({ cs }, coin);
    deps.monsters = [dustMephit];
    deps.rollExpression = vi.fn(() => countRoll);
    return deps;
  }

  const MEPHIT_CS = () => ({ round: 1, creatures: [{ name: 'Dust Mephit 1', type: 'npc', initiative: '14', currentHp: 17, maxHp: 17 }] });

  it('disk byte-shape: count dice "1d4" + chance 0.25 + numeric 1/Day gate, keeps usage; target pinned', () => {
    expect(SUMMON_MEPHITS_ROW.name).toBe('Variant: Summon Mephits');
    expect(SUMMON_MEPHITS_ROW.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'dust-mephit', chance: 0.25 }],
      count: '1d4',
      range_ft: 60,
      duration_minutes: 1,
    });
    expect(SUMMON_MEPHITS_ROW.uses).toBe(1);
    expect(SUMMON_MEPHITS_ROW.maxUses).toBe(1);
    expect(SUMMON_MEPHITS_ROW.usage).toEqual({ type: 'per day', times: 1 });
    expect(isMonsterSummonRow(SUMMON_MEPHITS_ROW)).toBe(true);
    expect(dustMephit).toMatchObject({ name: 'Dust Mephit', armor_class: 12, hit_points: 17 });
  });

  it('failed d100 26: spends 1/Day, ZERO count roll, ZERO spawn/te, honest exact fails popup', async () => {
    const deps = makeCountDeps(MEPHIT_CS(), 26);
    const { result, setPopupHtml } = await press(SUMMON_MEPHITS_ROW, 'Dust Mephit 1', deps);
    expect(result).toMatchObject({ resolved: true, summonedName: null, summonedNames: [], countRoll: null, remaining: 0 });
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.cs.creatures).toHaveLength(1);
    expect(deps.store.uses).toEqual({ 'Variant: Summon Mephits': 1 });
    expect(deps.logs.find(e => e.rollType === 'monster_summon_coin_flip').description).toBe('Dust Mephit 1 flips for Variant: Summon Mephits: d100 26 vs 25% — failure, no summon answers.');
    expect(deps.logs.some(e => e.type === 'summons')).toBe(false);
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Dust Mephit 1\'s summon fails</h3><p>Coin flip: d100 26 — attempt fails.\nNo summon answers the call. 0 use(s) left today (resets at dawn, GM-enforced).</p></div>');
  });

  it('success d100 25 + 1d4=3: count rolled AFTER the flip, 3 unique-named self-copies after the caster, te per spawn @1_minutes, ONE summons log + popup with count detail', async () => {
    const deps = makeCountDeps(MEPHIT_CS(), 25);
    const { result, setPopupHtml } = await press(SUMMON_MEPHITS_ROW, 'Dust Mephit 1', deps);
    expect(deps.rollDie).toHaveBeenCalledTimes(1);
    expect(deps.rollExpression).toHaveBeenCalledWith('1d4');
    expect(result).toMatchObject({ resolved: true, summonedName: 'Dust Mephit', countRoll: { total: 3 } });
    // getNextUniqueMonsterName always-suffix quirk: summoner "Dust Mephit 1"
    // pins maxNum=1, so copies land on 2/3 — names stay unique, as intended.
    expect(result.summonedNames).toEqual(['Dust Mephit', 'Dust Mephit 2', 'Dust Mephit 3']);
    const spawned = deps.store.cs.creatures.filter(c => c.monsterIndex === 'dust-mephit');
    expect(spawned.map(c => c.name)).toEqual(['Dust Mephit', 'Dust Mephit 2', 'Dust Mephit 3']);
    for (const c of spawned) {
      expect(c).toMatchObject({ type: 'npc', ac: 12, maxHp: 17, currentHp: 17, summonedBy: 'Dust Mephit 1', summonSource: 'monster_ability', initiative: '13.9' });
    }
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(3);
    for (const name of result.summonedNames) {
      expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', name, 'summoned', 'Dust Mephit 1', { duration: '1_minutes' });
    }
    const spawnLogs = deps.logs.filter(e => e.type === 'summons');
    expect(spawnLogs).toHaveLength(1);
    expect(spawnLogs[0].summonedCreatures).toEqual(['Dust Mephit', 'Dust Mephit 2', 'Dust Mephit 3']);
    expect(spawnLogs[0].summonCount).toBe(3);
    expect(spawnLogs[0].countRoll).toEqual({ total: 3, rolls: [1, 1, 1], modifier: 0, formula: '1d4' });
    expect(spawnLogs[0].description).toBe('Dust Mephit 1 summons 1d4 rolled 3 (1 + 1 + 1): Dust Mephit, Dust Mephit 2, Dust Mephit 3 via Variant: Summon Mephits — allies of Dust Mephit 1, appear within 60 ft, remain 1 minutes (expiry clock, dismiss-as-action and "can\'t summon other creatures" are §70 GM-enforced residuals).');
    expect(deps.logs.some(e => e.automationType === 'duration_clock_armed')).toBe(false);
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Dust Mephit 1 summons Dust Mephit, Dust Mephit 2, Dust Mephit 3</h3><p>Coin flip: d100 25 — summon attempt succeeds.\n3 copies join the fight as allies of Dust Mephit 1, acting right after it, for 1 minute (§70 expiry GM-enforced). Count: 1d4 rolled 3. 0 use(s) left today (resets at dawn, GM-enforced).</p></div>');
  });
});

describe('honest guards — unresolvable rows refuse with zero spawn', () => {
  it('unknown monster index AND unparsable count dice both refuse resolved:false, console.error pinned, zero cs/te writes', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const lostDeps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', initiative: '12' }] } }, 42);
    lostDeps.monsters = [];
    const { result: lost, setPopupHtml: lostPopup } = await press(SUMMON_ROW, 'Drow Mage 1', lostDeps);
    expect(lost).toMatchObject({ resolved: false, reason: 'monster-not-found' });
    expect(lostDeps.setCombatSummary).not.toHaveBeenCalled();
    expect(lostDeps.registerTargetEffect).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[monsterSummon] Monster "shadow-demon" not found'));
    expect(lostPopup).toHaveBeenCalledWith(expect.stringContaining('summon fails'));

    const bogusRow = { ...SUMMON_MEPHITS_ROW, automation: { ...SUMMON_MEPHITS_ROW.automation, count: 'no-such-dice' } };
    const bogusDeps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Dust Mephit 1', initiative: '14' }] } }, 25);
    bogusDeps.monsters = [dustMephit];
    bogusDeps.rollExpression = vi.fn(() => null);
    const { result: bogus, setPopupHtml: bogusPopup } = await press(bogusRow, 'Dust Mephit 1', bogusDeps);
    expect(bogus).toMatchObject({ resolved: false, reason: 'count-unparsable' });
    expect(bogusDeps.setCombatSummary).not.toHaveBeenCalled();
    expect(bogusDeps.registerTargetEffect).not.toHaveBeenCalled();
    expect(bogusDeps.store.cs.creatures).toHaveLength(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[monsterSummon] unparsable count "no-such-dice"'));
    expect(bogusPopup).toHaveBeenCalledWith(expect.stringContaining('summon fails'));
  });
});

describe('MA-0757/0759/1604 animate twins — data byte-shape', () => {
  const TWIN_LEGS = [
    { index: 'galeb-duhr', row: ANIMATE_ROW, duration_minutes: 1 },
    { index: 'galib-duhr', row: GALIB_ANIMATE_ROW, duration_minutes: 1 },
    { index: 'treant', row: TREANT_ANIMATE_ROW, duration_minutes: 1440 },
  ];
  it.each(TWIN_LEGS)('$index Animate row: chance-less option + stat_override int/cha 1, constant count 2, numeric 1/Day gate (uses-STRING retired)', ({ index, row, duration_minutes }) => {
    expect(row.name).toMatch(/^Animate /);
    expect(row.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: index, stat_override: { int: 1, cha: 1 } }],
      count: 2,
      range_ft: 60,
      duration_minutes,
    });
    expect(row.uses).toBe(1);
    expect(row.maxUses).toBe(1);
    expect(typeof row.uses).toBe('number');
    expect(row.usage).toBeUndefined();
    expect(isMonsterSummonRow(row)).toBe(true);
  });

  it('MA-0759 galib-duhr OCR-restamp: readable prose, galib framing kept distinct from galeb-duhr', () => {
    expect(GALIB_ANIMATE_ROW.description).toContain('of a galeb duhr');
    expect(GALIB_ANIMATE_ROW.description).toContain('concentrating on a spell');
    expect(GALIB_ANIMATE_ROW.description).toContain('up to two boulders');
    expect(GALIB_ANIMATE_ROW.description).not.toContain('ofa');
    expect(GALIB_ANIMATE_ROW.description).not.toContain('spel1');
    expect(GALIB_ANIMATE_ROW.description).not.toBe(ANIMATE_ROW.description);
  });
});

describe('MA-0757/1604 constant-count self-summon press — ZERO dice, self-summon guard', () => {
  const LEGS = [
    {
      label: 'galeb-duhr animates TWO boulders right after itself (count 2 constant, zero dice)',
      action: ANIMATE_ROW, monster: galebDuhr, caster: 'Galeb Duhr 1',
      cs: () => ({ round: 1, creatures: [{ name: 'Galeb Duhr 1', type: 'npc', monsterIndex: 'galeb-duhr', initiative: '10', currentHp: 95, maxHp: 95 }] }),
      names: ['Galeb Duhr', 'Galeb Duhr 2'],
      spawn: { type: 'npc', monsterIndex: 'galeb-duhr', summonedBy: 'Galeb Duhr 1', summonSource: 'monster_ability', ac: 16, maxHp: 123, currentHp: 123, initiative: '9.9' },
      abilities: { str: 20, dex: 14, con: 20, int: 1, wis: 12, cha: 1 },
      actions: ['Avalanche Slam'],
      useKey: 'Animate Boulders', duration: '1_minutes', durationText: 'remain 1 minutes',
    },
    {
      label: 'treant animates TWO trees right after itself (count 2 constant, zero dice, 1440-minute authored duration)',
      action: TREANT_ANIMATE_ROW, monster: treant, caster: 'Treant 1',
      cs: () => ({ round: 1, creatures: [{ name: 'Treant 1', type: 'npc', monsterIndex: 'treant', initiative: '19', currentHp: 138, maxHp: 138 }] }),
      names: ['Treant', 'Treant 2'],
      spawn: { type: 'npc', monsterIndex: 'treant', summonedBy: 'Treant 1', summonSource: 'monster_ability', ac: 16, maxHp: 138, currentHp: 138, initiative: '18.9' },
      abilities: { str: 23, dex: 8, con: 21, int: 1, wis: 16, cha: 1 },
      actions: ['Multiattack', 'Slam', 'Hail of Bark'],
      useKey: 'Animate Trees', duration: '1440_minutes', durationText: 'remain 1440 minutes',
    },
  ];
  it.each(LEGS)('$label', async ({ action, monster, caster, cs, names, spawn, abilities, actions, useKey, duration, durationText }) => {
    const deps = makeDeps({ cs: cs() });
    deps.monsters = [monster];
    // Loud decoys: a chance-less constant-count row must NEVER touch a die.
    deps.rollDie = vi.fn(() => { throw new Error('chance-less summon must never flip a d100'); });
    deps.rollExpression = vi.fn(() => { throw new Error('constant count must never roll count dice'); });
    const { result, setPopupHtml } = await press(action, caster, deps);
    expect(result).toMatchObject({ resolved: true, countRoll: null, remaining: 0 });
    expect(result.summonedNames).toEqual(names);
    const copies = deps.store.cs.creatures.filter(c => c.name !== caster);
    expect(copies.map(c => c.name)).toEqual(names);
    for (const c of copies) {
      expect(c).toMatchObject(spawn);
      expect(c.ability_scores).toMatchObject(abilities);
      expect(c.actions.map(a => a.name)).toEqual(actions);
      // Self-summon guard: the copy IS the summoner's block — never carries
      // another monster_summon automation (no chain-animate, RAW + recursion).
      expect(c.actions.some(a => a.automation?.type === 'monster_summon')).toBe(false);
    }
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(2);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', names[0], 'summoned', caster, { duration });
    expect(deps.store.uses).toEqual({ [useKey]: 1 });
    expect(deps.logs.some(e => e.rollType === 'monster_summon_coin_flip')).toBe(false);
    expect(deps.logs.some(e => e.automationType === 'duration_clock_armed')).toBe(false);
    const spawnLog = deps.logs.find(e => e.type === 'summons');
    expect(spawnLog.summonedCreatures).toEqual(names);
    expect(spawnLog.summonCount).toBe(2);
    expect(spawnLog.description).toContain('60 ft');
    expect(spawnLog.description).toContain(durationText);
    expect(deps.logs.find(e => e.type === 'ability_use').description).toContain(useKey);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining(names.join(', ')));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('acting right after it'));
  });
});

describe('MA-1215 sovereign recharge-gated summon', () => {
  const SOVEREIGN_CS = () => ({ round: 1, creatures: [
    { name: 'Myconid Sovereign 1', type: 'npc', monsterIndex: 'myconid-sovereign', initiative: '16', currentHp: 45, maxHp: 45 },
    { name: 'Bandit', type: 'npc', initiative: '11', currentHp: 999, maxHp: 999, ac: 12 },
  ] });

  function makeRechargeDeps(storedRecharge = {}, cs = SOVEREIGN_CS()) {
    const store = { logs: [], recharge: storedRecharge, cs, setKeys: [] };
    return {
      store,
      monsters: [sporeServant],
      skipDomEvents: true,
      rollDie: vi.fn(() => { throw new Error('guaranteed summon must never flip a d100'); }),
      rollExpression: vi.fn(() => null),
      getCombatSummary: vi.fn(() => store.cs),
      setCombatSummary: vi.fn(c => { store.cs = c; }),
      registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
        store.te = { campaign, target, effect, source, extra };
      }),
      getRuntimeValue: vi.fn((name, key) => (key === MONSTER_RECHARGE_KEY ? (store.recharge || {}) : {})),
      setRuntimeValue: vi.fn((name, key, v) => {
        store.setKeys.push(key);
        if (key === MONSTER_RECHARGE_KEY) store.recharge = v;
        return Promise.resolve();
      }),
      addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
      get logs() { return store.logs; },
    };
  }

  it('disk byte-shape: junk +0 killed (attack_bonus null), recharge "3" uses-free, advisory carries the RAW 24h/1d4+1 weeks clocks verbatim', () => {
    expect(ANIMATING_ROW.name).toBe('Animating Spores');
    expect(ANIMATING_ROW.attack_bonus).toBeNull();
    expect(ANIMATING_ROW.recharge).toBe('3');
    expect(ANIMATING_ROW.uses).toBeUndefined();
    expect(ANIMATING_ROW.maxUses).toBeUndefined();
    expect(ANIMATING_ROW.description).toBe("The myconid releases spores at a Medium or Small corpse within 5 feet of it that wasn't a Construct or an Undead. In 24 hours, the corpse rises as a <strong>Myconid Spore Servant</strong>. The corpse stays animate for 1d4 + 1 weeks or until destroyed, and it can't be animated again in this way.");
    expect(isMonsterSummonRow(ANIMATING_ROW)).toBe(true);
    expect(Object.keys(ANIMATING_ROW.automation)).toEqual(['type', 'options', 'range_ft', 'advisory']);
    expect(ANIMATING_ROW.automation.options).toEqual([{ monster: 'myconid-spore-servant' }]);
    expect(ANIMATING_ROW.automation.range_ft).toBe(5);
    expect(SOV_ADV).toContain('24 hours');
    expect(SOV_ADV).toContain('1d4+1 weeks');
    expect(SOV_ADV).toContain('GM-adjudicated');
    expect(sporeServant).toMatchObject({ name: 'Myconid Spore Servant', armor_class: 13, hit_points: 37 });
  });

  it('fresh press: spends Recharge-3 (ability_use), spawns disk Spore Servant right after the sovereign, te @gm_adjudicated, summons log + popup carry the advisory EXACTLY — never "10 minutes", zero dice, zero clock armed', async () => {
    const deps = makeRechargeDeps();
    const { result, setPopupHtml } = await press(ANIMATING_ROW, 'Myconid Sovereign 1', deps);
    expect(result).toMatchObject({ resolved: true, summonedName: 'Myconid Spore Servant', summonedNames: ['Myconid Spore Servant'], countRoll: null, verdict: { monster: 'myconid-spore-servant', roll: null, success: true }, remaining: null });
    const spawned = deps.store.cs.creatures.find(c => c.name === 'Myconid Spore Servant');
    expect(spawned).toMatchObject({ type: 'npc', monsterIndex: 'myconid-spore-servant', ac: 13, maxHp: 37, currentHp: 37, summonedBy: 'Myconid Sovereign 1', summonSource: 'monster_ability', initiative: '15.9' });
    expect(spawned.actions.map(a => a.name)).toEqual(['Slam']);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Myconid Spore Servant', 'summoned', 'Myconid Sovereign 1', { duration: 'gm_adjudicated' });
    expect(deps.store.setKeys).toEqual([MONSTER_RECHARGE_KEY]);
    expect(deps.store.recharge).toEqual({ 'Animating Spores': { recharged: false, threshold: 3 } });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.store.logs.some(e => e.rollType === 'attack')).toBe(false);
    expect(deps.store.logs.some(e => e.rollType === 'monster_summon_coin_flip')).toBe(false);
    expect(deps.logs.some(e => e.automationType === 'duration_clock_armed')).toBe(false);
    const spendLog = deps.logs.find(e => e.type === 'ability_use');
    expect(spendLog.abilityName).toBe('Animating Spores');
    expect(spendLog.description).toContain('Recharge 3');
    const spawnLog = deps.logs.find(e => e.type === 'summons');
    expect(spawnLog.summonedCreatures).toEqual(['Myconid Spore Servant']);
    expect(spawnLog.description).toBe(`Myconid Sovereign 1 summons Myconid Spore Servant via Animating Spores — ally of Myconid Sovereign 1, appears within 5 ft. ${SOV_ADV}`);
    expect(setPopupHtml).toHaveBeenCalledWith(`<div class="mc-prerequisite-refusal"><h3>Myconid Sovereign 1 summons Myconid Spore Servant</h3><p>Myconid Spore Servant joins the fight as an ally of Myconid Sovereign 1, acting right after it. ${SOV_ADV}</p></div>`);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.not.stringContaining('10 minutes'));
  });

  it('spent press: refused with animating_spores_refused + Not Recharged popup, ZERO spawn/spend/te/dice, recharge map untouched', async () => {
    const deps = makeRechargeDeps({ 'Animating Spores': { recharged: false, threshold: 3 } });
    const { result, setPopupHtml } = await press(ANIMATING_ROW, 'Myconid Sovereign 1', deps);
    expect(result).toEqual({ resolved: false, reason: 'not-recharged' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.cs.creatures.some(c => c.name === 'Myconid Spore Servant')).toBe(false);
    expect(deps.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    expect(deps.store.logs.some(e => e.rollType === 'attack')).toBe(false);
    const refusal = deps.logs.find(e => e.automationType === 'animating_spores_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toContain('not recharged');
    expect(refusal.description).toContain('d6 3+');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Not Recharged'));
  });

  it('legacy twins byte-unchanged: no-recharge summon rows never write MONSTER_RECHARGE_KEY (uses economy intact, zero attack logs)', async () => {
    const legs = [
      [SUMMON_ROW, 'Drow Mage 1', [quasit, shadowDemon]],
      [PRIESTESS_ROW, 'Drow Priestess of Lolth', [yochlol]],
      [SUMMON_MEPHITS_ROW, 'Dust Mephit 1', [dustMephit]],
      [ANIMATE_ROW, 'Galeb Duhr 1', [galebDuhr]],
      [GALIB_ANIMATE_ROW, 'Galib Duhr 1', [galibDuhr]],
    ];
    for (const [action, name, monsters] of legs) {
      expect(action.recharge).toBeUndefined();
      const deps = makeRechargeDeps({}, { round: 1, creatures: [{ name, initiative: '12' }] });
      deps.monsters = monsters;
      deps.rollDie = vi.fn(() => 5);
      deps.rollExpression = vi.fn(() => ({ total: 1, rolls: [1], modifier: 0, formula: '1d4' }));
      const keys = [];
      deps.setRuntimeValue = vi.fn((n, k) => { keys.push(k); return Promise.resolve(); });
      const { result } = await press(action, name, deps);
      expect(result.resolved).toBe(true);
      expect(keys).toContain('monsterSpellUses');
      expect(keys).not.toContain(MONSTER_RECHARGE_KEY);
      expect(deps.logs.some(e => e.rollType === 'attack')).toBe(false);
    }
  });
});

describe('MA-1729 wraith Create Specter', () => {
  const WRAITH_CS = () => ({ round: 1, creatures: [
    { name: 'Wraith 1', type: 'npc', monsterIndex: 'wraith', initiative: '16', currentHp: 67, maxHp: 67 },
    { name: 'Bandit', type: 'npc', initiative: '11', currentHp: 999, maxHp: 999, ac: 12 },
  ] });

  it('inert row armed on the MA-1215 byte-shape: specter @10 ft advisory-only, NO fabricated economy, narrative byte-unchanged', () => {
    expect(CREATE_SPECTER_ROW.name).toBe('Create Specter');
    expect(CREATE_SPECTER_ROW.attack_bonus).toBeUndefined();
    expect(CREATE_SPECTER_ROW.save_dc).toBeUndefined();
    expect(CREATE_SPECTER_ROW.recharge).toBeUndefined();
    expect(CREATE_SPECTER_ROW.uses).toBeUndefined();
    expect(CREATE_SPECTER_ROW.maxUses).toBeUndefined();
    expect(CREATE_SPECTER_ROW.description).toBe("The wraith targets a Humanoid corpse within 10 feet of itself that has been dead for no longer than 1 minute. The target's spirit rises as a Specter in the space of its corpse or in the nearest unoccupied space. The specter is under the wraith's control. The wraith can have no more than seven specters under its control at a time.");
    expect(isMonsterSummonRow(CREATE_SPECTER_ROW)).toBe(true);
    expect(Object.keys(CREATE_SPECTER_ROW.automation)).toEqual(['type', 'options', 'range_ft', 'advisory']);
    expect(CREATE_SPECTER_ROW.automation.options).toEqual([{ monster: 'specter' }]);
    expect(CREATE_SPECTER_ROW.automation.range_ft).toBe(10);
    expect(WR_ADV).toContain('Humanoid corpse');
    expect(WR_ADV).toContain('seven specters');
    expect(WR_ADV).toContain('GM-adjudicated');
    expect(specter).toMatchObject({ name: 'Specter', armor_class: 12, hit_points: 22 });
  });

  it('chance-less rise press: Specter ally right after the wraith, te @gm_adjudicated, advisory bytes EXACT in log + popup — zero dice/coin-flip/ability_use/recharge write/clock', async () => {
    const deps = makeDeps({ cs: WRAITH_CS() });
    deps.monsters = [specter];
    deps.rollExpression = vi.fn(() => null);
    const { result, setPopupHtml } = await press(CREATE_SPECTER_ROW, 'Wraith 1', deps);
    expect(result).toMatchObject({ resolved: true, summonedName: 'Specter', summonedNames: ['Specter'], countRoll: null, verdict: { monster: 'specter', roll: null, success: true }, remaining: null });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    const spawned = deps.store.cs.creatures.find(c => c.name === 'Specter');
    expect(spawned).toMatchObject({ type: 'npc', monsterIndex: 'specter', ac: 12, maxHp: 22, currentHp: 22, summonedBy: 'Wraith 1', summonSource: 'monster_ability', initiative: '15.9' });
    expect(spawned.actions.map(a => a.name)).toEqual(['Life Drain']);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Specter', 'summoned', 'Wraith 1', { duration: 'gm_adjudicated' });
    expect(deps.store.logs.some(e => e.rollType === 'attack')).toBe(false);
    expect(deps.store.logs.some(e => e.rollType === 'monster_summon_coin_flip')).toBe(false);
    expect(deps.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    expect(deps.store.logs.some(e => e.automationType === 'duration_clock_armed')).toBe(false);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const spawnLog = deps.logs.find(e => e.type === 'summons');
    expect(spawnLog.summonedCreatures).toEqual(['Specter']);
    expect(spawnLog.description).toBe(`Wraith 1 summons Specter via Create Specter — ally of Wraith 1, appears within 10 ft. ${WR_ADV}`);
    expect(setPopupHtml).toHaveBeenCalledWith(`<div class="mc-prerequisite-refusal"><h3>Wraith 1 summons Specter</h3><p>Specter joins the fight as an ally of Wraith 1, acting right after it. ${WR_ADV}</p></div>`);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.not.stringContaining('10 minutes'));
  });
});
