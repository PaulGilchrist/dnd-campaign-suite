// @maintained-by-ai
// CANON framework base for the monsterLegendaryUses family. Generic behavior
// lives HERE; per-monster disk-byte tickets own their own lanes.
//   MA-0021 header/max/remaining + expend gate + turn-latch + spend/refusal
//   vocabulary + turn-start regain · MA-0022 delegates_to resolution ·
//   MA-0023 any-ally prerequisite + self-heal · MA-0051 ability-check rows ·
//   MA-0058 advisory rows · MA-0073 per-action once-per-turn cooldown lane ·
//   monsters.json legendary data census (header uses pins, delegates, saves).
//
// PRESERVED-CITED-BY (#1082 discipline — lane tickets cite these bytes;
// old → new line ranges):
//   expend-gate truth-table            :129-145 (old :79-110)   @ma1580 #1103
//     @ma1581 #1104 @ma1582 #1105 @ma1944 #1110 @ma1962 #1111 @smaug #1114
//     @yamata #1115 @garuda #1108 @grantReaction #1094
//   refusal vocab popup+log exact     :200-219 (old :124-167 vocab legs) same crowd
//   turn-latch / re-arm / spend-refuse lifecycle  :149-198 (old :124-167)
//   no-delegate resolver ladder       :232-237 (old :191-196)  @ma1580 #1103
//   recharge canon: seam fixture      :89-99  + regain seam :181-190
//     (old :51-60 / :145-149)                                  @ma1907-1910 #1108
//   turn-start no-spurious-writes, monster-agnostic :510-516 (old :477-484)
//     + dracolich dict +14 data pin :362-366 (old :358-362)  @ma1868 #1106
//   check-row dict/case-insensitive/abbr-fallback table (+bare-number MA-2002
//     shape + #1116 loud-vs-silent census pins :375-392 table,
//     :394-414 console.error bytes)  :355-421 (old :355-388) @ma2002 #1114
//   MA-0073 prose match/non-match region      :442-465 (old :409-432)
//     canonical cooldown lifecycle + byte-inert + no-spurious :467-517 (old :434-484)
//                                                          @ma1868 #1106
//   uses:3 many-monsters header census + live press        :519-587 (old :486-554)
//                                                          @nidhogg #1101 generic uses owner
//   advisory popup/log CANON        :423-437 (old :390-407)   @ma1581
//   plain-"Chomp" delegate twin     :591-615 (old :556-583)   @ma1582
// Cost grammar ("Costs N Actions") is @ma1883's ownership (#1105/#1107 split
// honest) — no cost rows here. Per-monster economy walks folded into the
// lifecycle + census dup-map; ticket legs live in their lane files:
// tarrasque@ma1579 claw@ma1580 move@ma1581 chomp@ma1582 garuda@ma1907
// nidhogg@ma1952 climbing@ma1936 ladon@ma1944 orcus@ma1962 quetzal@ma1974
// shriek@ma1982 smaug@ma2002 yamata@ma2054.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  legendaryHeaderAction,
  legendaryMaxUses,
  legendaryUsesRemaining,
  legendaryExpendGate,
  buildLegendaryRefusalLog,
  buildLegendaryRefusalPopup,
  expendLegendaryUse,
  regainLegendaryUses,
  legendaryDelegateAction,
  legendaryDelegateAttackName,
  legendaryCheckRow,
  legendaryCheckBonus,
  legendaryCheckLabel,
  parseLegendaryAllyPrerequisite,
  legendaryAllyPrerequisiteSatisfied,
  buildLegendaryPrerequisiteRefusalPopup,
  buildLegendaryPrerequisiteRefusalLog,
  applyLegendarySelfHeal,
  buildLegendaryAdvisoryPopup,
  buildLegendaryAdvisoryLog,
  hasLegendaryCooldownClause,
  legendaryActionSlug,
  MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY,
  buildLegendaryCooldownRefusalLog,
  buildLegendaryCooldownRefusalPopup,
} from './monsterLegendaryUses.js';
import monstersData from '../../../public/data/monsters.json';

// Real applyHealingToTarget persists combatSummary via storage.set → fetch.
vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const TENTACLE = { name: 'Tentacle', attack_bonus: 9, damage_dice_primary: '2d6 + 5', damage_type_primary: 'Bludgeoning' };

const AB = {
  actions: [TENTACLE],
  legendary_actions: [
    { name: 'Legendary Action Uses: 3 (4 in Lair)', uses: 3, description: 'Immediately after another creature\'s turn…' },
    { name: 'Lash', delegates_to: 'Tentacle', description: 'The aboleth makes one Tentacle attack.' },
    { name: 'Psychic Drain', description: '…regains 5 (1d10) Hit Points.' },
  ],
};

// #1108 recharge canon: the seam fixture every lane reuses — combatSummary
// round+activeCreature only, no wall-clock (turn-based mandate).
let store;
let logs;
let deps;
let cs;
beforeEach(() => {
  store = {};
  logs = [];
  cs = { round: 1, activeCreatureName: 'Thug 1' };
  deps = {
    getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
    setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
    addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
    getCombatContext: vi.fn(() => Promise.resolve(cs)),
  };
});
afterEach(() => { vi.restoreAllMocks(); });

const M = 'Aboleth 1';
const refusalLogDesc = (action, reason) => `${M} ${action} legendary action refused (${reason}) — zero spend, no roll.`;

describe('MA-0021 header / max / remaining — resolution + coercion census', () => {
  it.each([
    ['header rows[0] with uses resolves', AB, AB.legendary_actions[0]],
    ['rows[0] without uses is not a header', { legendary_actions: [{ name: 'No Uses' }] }, null],
    ['missing/empty/non-array legendary_actions resolve null', { legendary_actions: [] }, null],
    ['undefined monster resolves null', undefined, null],
  ])('%s', (_t, monster, expected) => {
    expect(legendaryHeaderAction(monster)).toBe(expected);
  });

  it.each([
    ['authored uses wins', { uses: 3 }, {}, 3, 3],
    ['string uses coerces (honest ??-guard: Number("3"))', { uses: '3' }, {}, 3, 3],
    ['max rides the stamped map when the header is absent (turn-start regain seam)', null, { max: 3, used: 2 }, 3, 1],
    ['uses:0 is not a budget — falls to the stamp', { uses: 0 }, { max: 3, used: 1 }, 3, 2],
    ['remaining clamps at 0 (over-used store)', { uses: 3 }, { max: 3, used: 5 }, 3, 0],
    ['nothing authored, nothing stamped', null, {}, null, null],
  ])('max/remaining — %s', (_t, header, stored, max, remaining) => {
    expect(legendaryMaxUses(header, stored)).toBe(max);
    expect(legendaryUsesRemaining(header, stored)).toBe(remaining);
  });
});

// CITE-GATE — canonical refusal vocabulary cited by every lane ticket.
describe('MA-0021 expend gate — canonical truth-table', () => {
  const gate = (over = {}) => legendaryExpendGate({
    header: AB.legendary_actions[0], storedUses: {}, round: 1,
    activeCreatureName: 'Thug 1', monsterName: M, latch: null, ...over,
  });
  it.each([
    ['allows the first expend after another creature\'s turn', {}, { allowed: true, remaining: 3, max: 3 }],
    ['refuses a second expend within the same creature turn (round+turn latch)', { storedUses: { max: 3, used: 1 }, latch: { round: 1, activeCreature: 'Thug 1' } }, { allowed: false, reason: 'turn', max: 3 }],
    ['refuses on its own turn', { activeCreatureName: M }, { allowed: false, reason: 'own-turn', max: 3 }],
    ['refuses when exhausted (0 left)', { storedUses: { max: 3, used: 3 } }, { allowed: false, reason: 'exhausted', max: 3 }],
    ['allows again on the next other-creature turn (latch re-arms)', { storedUses: { max: 3, used: 1 }, latch: { round: 1, activeCreature: 'Thug 1' }, activeCreatureName: 'Cleric 2' }, { allowed: true, remaining: 2, max: 3 }],
    ['stale-round latch from an earlier round allows', { storedUses: { max: 3, used: 1 }, latch: { round: 1, activeCreature: 'Thug 1' }, round: 2 }, { allowed: true, remaining: 2, max: 3 }],
    ['no header, no stamped max → no-uses', { header: null }, { allowed: false, reason: 'no-uses' }],
  ])('%s', (_t, over, expected) => {
    expect(gate(over)).toMatchObject(expected);
  });
});

// CITE-LIFECYCLE — the one canonical economy walk (per-monster copies folded
// into the census live-press below; economy is monster-agnostic engine code).
describe('MA-0021 expend / refuse / regain lifecycle (aboleth, uses:3)', () => {
  it('legal press spends 1: map + latch written, exact spend log, campaign-keyed', async () => {
    const r = await expendLegendaryUse({ monsterName: M, monster: AB, actionName: 'Lash', campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store[`${M}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 });
    expect(store[`${M}._legendaryUses_usedRound`]).toEqual({ round: 1, activeCreature: 'Thug 1' });
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend.description).toBe(`${M} expends a legendary use for Lash after Thug 1's turn — 2 of 3 left (regain at the start of ${M}'s turn; 4 in lair advisory).`);
    expect(deps.addEntry.mock.calls.every(c => c[0] === 'test-campaign')).toBe(true);
  });

  it('same-turn second press refuses (turn): zero spend, latch unchanged, refused log + popup', async () => {
    await expendLegendaryUse({ monsterName: M, monster: AB, actionName: 'Lash', campaignName: 'test-campaign', deps });
    const second = await expendLegendaryUse({ monsterName: M, monster: AB, actionName: 'Psychic Drain', campaignName: 'test-campaign', deps });
    expect(second.reason).toBe('turn');
    expect(second.spent).toBe(false);
    expect(store[`${M}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 });
    expect(second.popupHtml).toMatch(/Only one legendary action can be expended immediately after each creature's turn\./);
    expect(logs.some(e => e.automationType === 'legendary_use_refused' && e.description === refusalLogDesc('Psychic Drain', 'turn'))).toBe(true);
  });

  it('exhausted press: zero spend, zero latch write, legendary_use_refused log + popup vocabulary', async () => {
    store[`${M}.monsterLegendaryUses`] = { max: 3, used: 3 };
    const r = await expendLegendaryUse({ monsterName: M, monster: AB, actionName: 'Lash', campaignName: 'test-campaign', deps });
    expect(r).toMatchObject({ spent: false, reason: 'exhausted' });
    expect(r.popupHtml).toMatch(/has no legendary uses left/);
    expect(store[`${M}.monsterLegendaryUses`]).toEqual({ max: 3, used: 3 });
    expect(store[`${M}._legendaryUses_usedRound`]).toBeUndefined();
    expect(logs.some(e => e.automationType === 'legendary_use_refused' && e.description === refusalLogDesc('Lash', 'exhausted'))).toBe(true);
    expect(logs.some(e => e.type === 'ability_use')).toBe(false);
  });

  it('own turn-start regain resets uses + clears latch, exact regain log', async () => {
    store[`${M}.monsterLegendaryUses`] = { max: 3, used: 2 };
    store[`${M}._legendaryUses_usedRound`] = { round: 1, activeCreature: 'Thug 1' };
    const r = await regainLegendaryUses({ monsterName: M, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ regained: true, max: 3 });
    expect(store[`${M}.monsterLegendaryUses`]).toEqual({ max: 3, used: 0 });
    expect(store[`${M}._legendaryUses_usedRound`]).toBeNull();
    const log = logs.find(e => e.type === 'ability_use');
    expect(log.description).toBe(`${M} regains all expended legendary action uses at the start of its turn — 3 available.`);
  });

  it('regain silent no-op when nothing was spent: no writes, no logs', async () => {
    const r = await regainLegendaryUses({ monsterName: M, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ regained: false });
    expect(logs.length).toBe(0);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('MA-0021 refusal vocabulary — exact bytes per generic gate reason', () => {
  // insufficost/no-spell-chosen copy is owned by @ma1883's lane (#1105/#1107).
  it.each([
    ['exhausted', /has no legendary uses left/],
    ['turn', /Only one legendary action can be expended immediately after each creature's turn\./],
    ['own-turn', /expends legendary uses after ANOTHER creature's turn, not its own\./],
    ['no-delegate', /delegates to an attack that could not be found on/],
    ['no-check-bonus', /declares an ability check but no skill or ability modifier could be resolved/],
    ['no-uses', /has no legendary uses to expend\./],
  ])('%s popup + log, zero-spend wording exact-once', (reason, token) => {
    const popup = buildLegendaryRefusalPopup({ monsterName: M, actionName: 'Lash', reason });
    expect(popup).toContain('<h3>Legendary Action Refused</h3>');
    expect(popup).toMatch(token);
    expect(popup.match(/Nothing spent, no roll\./g)).toHaveLength(1);
    const e = buildLegendaryRefusalLog({ monsterName: M, actionName: 'Lash', reason });
    expect(e.automationType).toBe('legendary_use_refused');
    expect(e.characterName).toBe(M);
    expect(e.description).toBe(refusalLogDesc('Lash', reason));
  });
});

describe('MA-0022 delegates_to resolution (Lash → Tentacle)', () => {
  it('resolves across actions[] then legendary_actions siblings, never self', () => {
    expect(legendaryDelegateAction(AB, AB.legendary_actions[1])).toBe(TENTACLE);
    const sibling = {
      legendary_actions: [AB.legendary_actions[0], { name: 'Lash', delegates_to: 'Tentacle' }, TENTACLE],
    };
    expect(legendaryDelegateAction(sibling, sibling.legendary_actions[1])).toBe(TENTACLE);
    expect(legendaryDelegateAction(AB, TENTACLE)).toBeNull(); // self-reference
  });

  // CITE-NULLAD — @ma1580 #1103 cites this ladder.
  it('null ladder: no delegates_to, unknown name, null monster, null row', () => {
    expect(legendaryDelegateAction(AB, AB.legendary_actions[2])).toBeNull();
    expect(legendaryDelegateAction(AB, { name: 'Lash', delegates_to: 'Bite' })).toBeNull();
    expect(legendaryDelegateAction(null, { name: 'Lash', delegates_to: 'Tentacle' })).toBeNull();
    expect(legendaryDelegateAction(AB, null)).toBeNull();
  });

  it('attack-log name derives kind from the delegate: attack vs save', () => {
    expect(legendaryDelegateAttackName(AB.legendary_actions[1], TENTACLE)).toBe('Lash (Tentacle attack)');
    expect(legendaryDelegateAttackName({ name: 'Psychic Drain' }, { name: 'Consume Memories', save_dc: 16 })).toBe('Psychic Drain (Consume Memories save)');
  });

  it('press with the delegate label spends 1 and logs the delegated name', async () => {
    const name = legendaryDelegateAttackName(AB.legendary_actions[1], TENTACLE);
    const r = await expendLegendaryUse({ monsterName: M, monster: AB, actionName: name, campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(true);
    expect(logs.some(e => e.type === 'ability_use' && e.description.includes(`expends a legendary use for ${name}`))).toBe(true);
  });
});

const CONSUME_MEMORIES = { name: 'Consume Memories', save_dc: 16, save_type: 'Intelligence', damage_dice_primary: '3d6', damage_type_primary: 'Psychic' };
const PSYCHIC_DRAIN = {
  name: 'Psychic Drain',
  delegates_to: 'Consume Memories',
  self_heal: '1d10',
  target_prerequisite: { conditions: ['charmed', 'grappled'], any_ally_of_attacker: true },
  description: 'If the aboleth has at least one creature Charmed or Grappled, it uses Consume Memories and regains 5 (1d10) Hit Points.',
};
const PREREQ = parseLegendaryAllyPrerequisite(PSYCHIC_DRAIN);

describe('MA-0023 aboleth any-ally prerequisite + self-heal', () => {
  it('disk row: delegates_to Consume Memories save + self_heal 1d10 + any_ally prerequisite', () => {
    const aboleth = monstersData.find(m => m.name === 'Aboleth');
    const row = aboleth.legendary_actions.find(a => a.name === 'Psychic Drain');
    expect(row.self_heal).toBe('1d10');
    expect(row.target_prerequisite.conditions).toEqual(['charmed', 'grappled']);
    expect(row.target_prerequisite.any_ally_of_attacker).toBe(true);
    const d = legendaryDelegateAction(aboleth, row);
    expect(d.name).toBe('Consume Memories');
    expect(d.save_dc).toBe(16);
    expect(legendaryDelegateAttackName(row, d)).toBe('Psychic Drain (Consume Memories save)');
  });

  it('parse accepts ONLY the any_ally_of_attacker shape', () => {
    expect(PREREQ).toEqual({ conditions: ['charmed', 'grappled'] });
    expect(parseLegendaryAllyPrerequisite(CONSUME_MEMORIES)).toBeNull();
    expect(parseLegendaryAllyPrerequisite({ name: 'X' })).toBeNull();
    expect(parseLegendaryAllyPrerequisite({ name: 'X', target_prerequisite: { conditions: ['charmed'] } })).toBeNull();
    expect(parseLegendaryAllyPrerequisite({ name: 'X', target_prerequisite: { conditions: [], any_ally_of_attacker: true } })).toBeNull();
  });

  it.each([
    ['met: Charmed, provenance source = monster', 'TestPC', ['charmed'], { charmed: { dc: 15, source: M } }, { satisfied: true, targetName: 'TestPC', condition: 'charmed' }],
    ['met: MA-0018 tentacle-grapple provenance', 'Thug 1', ['grappled'], { grappled: { dc: 14, source: M } }, { satisfied: true, targetName: 'Thug 1', condition: 'grappled' }],
    ['unmet: no conditions at all', 'TestPC', [], {}, { satisfied: false }],
    ['unmet: condition attributed to ANOTHER creature (provenance fails)', 'TestPC', ['charmed'], { charmed: { source: 'Rival Hag' } }, { satisfied: false }],
    ['unmet: condition present but no provenance meta', 'TestPC', ['charmed'], {}, { satisfied: false }],
    ['unmet: the monster bearing its own condition is skipped', M, ['charmed'], { charmed: { source: M } }, { satisfied: false }],
    ['null prerequisite is trivially satisfied', null, null, null, { satisfied: true }],
  ])('%s', (_t, holder, conditions, meta, expected) => {
    const rt = (name, key) => (name === holder && key === 'activeConditions' ? conditions
      : name === holder && key === 'activeConditionMeta' ? meta : null);
    const creatures = holder === null ? [] : [{ name: M }, { name: holder === M ? 'Bystander' : holder }];
    expect(legendaryAllyPrerequisiteSatisfied({ prerequisite: holder === null ? null : PREREQ, creatures, monsterName: M, getRuntimeValue: rt })).toEqual(expected);
  });

  it('prerequisite refusal popup + psychic_drain_refused log, zero-spend wording exact', () => {
    const p = buildLegendaryPrerequisiteRefusalPopup({ monsterName: M, actionName: 'Psychic Drain', prerequisite: PREREQ });
    expect(p).toContain('Prerequisite Not Met');
    expect(p).toMatch(/no creature is currently Charmed or Grappled by/);
    const e = buildLegendaryPrerequisiteRefusalLog({ monsterName: M, actionName: 'Psychic Drain', prerequisite: PREREQ });
    expect(e.automationType).toBe('psychic_drain_refused');
    expect(e.description).toBe(`${M} Psychic Drain refused — no creature is Charmed or Grappled by ${M}. Zero spend, no roll, no healing.`);
  });

  it('self-heal: injected roll is deterministic; heal routed + hp_change log exact', async () => {
    const localCs = { creatures: [{ name: M, type: 'npc', currentHp: 140, maxHp: 150 }] };
    const healCalls = [];
    const entries = [];
    const r = await applyLegendarySelfHeal({
      monsterName: M, actionName: 'Psychic Drain', formula: '1d10', campaignName: 'test-campaign',
      deps: {
        rollExpression: () => ({ total: 7 }),
        getCombatContext: () => Promise.resolve(localCs),
        applyHealingToTarget: (_c, name, amount) => { healCalls.push({ name, amount }); return { actualHeal: amount, newHp: 147, maxHp: 150 }; },
        addEntry: (_c, e) => { entries.push(e); return Promise.resolve(); },
      },
    });
    expect(healCalls).toEqual([{ name: M, amount: 7 }]);
    expect(r).toEqual({ rolled: 7, applied: 7, newHp: 147, maxHp: 150 });
    expect(entries[0]).toMatchObject({ type: 'hp_change', isHealing: true, delta: 7, targetName: M });
    expect(entries[0].description).toBe(`${M} Psychic Drain self-heal: 1d10 rolled 7 — 7 HP regained (147/150).`);
  });

  it('real rollExpression + REAL applyHealingToTarget: HP rise, clamped at max; guards return null honestly', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const localCs = { creatures: [{ name: M, type: 'npc', currentHp: 148, maxHp: 150 }] };
    const r = await applyLegendarySelfHeal({
      monsterName: M, actionName: 'Psychic Drain', formula: '1d10', campaignName: 'test-campaign',
      deps: { getCombatContext: () => Promise.resolve(localCs), addEntry: () => Promise.resolve() },
    });
    expect(r.rolled).toBeGreaterThanOrEqual(1);
    expect(r.rolled).toBeLessThanOrEqual(10);
    expect(r.applied).toBe(Math.min(r.rolled, 2));
    expect(localCs.creatures[0].currentHp).toBe(148 + r.applied);

    // Guard branches reach honestly (#1035): unparseable roll → null; missing target → null.
    const badRoll = await applyLegendarySelfHeal({
      monsterName: M, actionName: 'Psychic Drain', formula: 'bogus', campaignName: 'test-campaign',
      deps: { rollExpression: () => null, getCombatContext: () => Promise.resolve(localCs), addEntry: () => Promise.resolve() },
    });
    expect(badRoll).toBeNull();
    const missingTarget = await applyLegendarySelfHeal({
      monsterName: 'Ghost 9', actionName: 'Psychic Drain', formula: '1d10', campaignName: 'test-campaign',
      deps: { getCombatContext: () => Promise.resolve({ creatures: [] }), addEntry: () => Promise.resolve() },
    });
    expect(missingTarget).toBeNull();
    expect(errSpy).toHaveBeenCalledTimes(2);
  });
});

// CITE-CHECK — MA-0051 check-row/bonus/label vocab (@ma2002 #1114, @garuda
// #1108, @quetzal): dict-vs-bare-number skills shapes resolve here.
describe('MA-0051 legendary ability-check rows', () => {
  const dracolich = monstersData.find(m => m.index === 'adult-blue-dracolich');
  const CHECK = { ability_check: { ability: 'wisdom', skill: 'perception' } };
  // #1116 invalid-shape rows below are LOUD by law — silence here, pin the
  // bytes in the dedicated console.error test; vi.restoreAllMocks @:100.
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });

  it('data: Detect authors ability_check wisdom/perception; dict skills.Perception is +14', () => {
    const detect = dracolich.legendary_actions.find(a => a.name === 'Detect');
    expect(detect.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(dracolich.skills.Perception.modifier).toBe(14);
  });

  it('legendaryCheckRow: only rows with a non-empty ability_check qualify', () => {
    expect(legendaryCheckRow({ name: 'Detect', ability_check: { ability: 'wisdom', skill: 'perception' } })).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(legendaryCheckRow({ name: 'Tail Attack' })).toBeNull();
    expect(legendaryCheckRow({ name: 'Bad', ability_check: {} })).toBeNull();
    expect(legendaryCheckRow(null)).toBeNull();
  });

  it.each([
    ['real dracolich dict shape: skill mod beats ability fallback', dracolich, { ability_check: { ability: 'wisdom', skill: 'perception' } }, 14],
    ['case-insensitive skill lookup', { skills: { PeRcEPTION: { modifier: 9 } } }, { ability_check: { ability: 'wisdom', skill: 'perception' } }, 9],
    ['bare-number skills shape (MA-2002 Smaug census): +11, not collapsed +0', { skills: { Perception: 11 } }, { ability_check: { ability: 'wisdom', skill: 'perception' } }, 11],
    ['numeric-string primitive coerces (the ??-entry arm is FOR primitives — intact)', { skills: { Perception: '11' } }, { ability_check: { ability: 'wisdom', skill: 'perception' } }, 11],
    ['explicit dict modifier:0 is honest +0 (authored zero, not a collapse)', { skills: { Perception: { modifier: 0 } } }, CHECK, 0],
    ['#1116 dict w/o modifier (disk-census-zero INVALID shape) → loud null, never silent +0', { skills: { Perception: {} } }, CHECK, null],
    ['#1116 dict modifier:null → null (closes the Number(null)=0 silent hole)', { skills: { Perception: { modifier: null } } }, CHECK, null],
    ['#1116 dict modifier:"proficient" non-numeric → null', { skills: { Perception: { modifier: 'proficient' } } }, CHECK, null],
    ['#1116 null skill entry → null (was Number(null)=0 silent)', { skills: { Perception: null } }, CHECK, null],
    ['#1116 empty-string primitive → null (no Number("")=0)', { skills: { Perception: '' } }, CHECK, null],
    ['skill-less check falls to 3-letter abbr ability mod', { ability_score_modifiers: { wis: 3 } }, { ability_check: { ability: 'wisdom' } }, 3],
    ['negative ability mod preserved', { ability_score_modifiers: { wis: -2 } }, { ability_check: { ability: 'wisdom' } }, -2],
    ['unresolvable → null (caller refuses before spend)', {}, { ability_check: { ability: 'wisdom', skill: 'perception' } }, null],
    ['non-check row → null', dracolich, { name: 'Tail Attack' }, null],
  ])('%s', (_t, monster, action, bonus) => {
    expect(legendaryCheckBonus(monster, action)).toBe(bonus);
  });

  // #1116: dict-shaped entry lacking a numeric modifier was collapsing
  // Number({}) → NaN → the finite ternary's :0 tail to a SILENT +0 → spend
  // + d20+0 on garbage (dishonest RAW). Verdict by census (disk read
  // 2026-10-22, monsters.json 807 skill rows): 770 dict-with-numeric-
  // modifier + 37 bare-number + ZERO dict-without-modifier → invalid shape
  // → LOUD console.error citing the entry bytes + null, so the consumer
  // refuses with 'no-check-bonus' at ZERO spend (MonsterCardModal :913).
  it('#1116 invalid shapes console.error citing entry bytes; honest shapes log nothing', () => {
    expect(legendaryCheckBonus({ skills: { Perception: {} } }, CHECK)).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error.mock.calls[0][0]).toContain('skills.Perception');
    expect(console.error.mock.calls[0][0]).toContain('{}');
    console.error.mockClear();
    expect(legendaryCheckBonus({ skills: { Perception: { modifier: 'proficient' } } }, CHECK)).toBeNull();
    expect(console.error.mock.calls[0][0]).toContain('{"modifier":"proficient"}');
    console.error.mockClear();
    expect(legendaryCheckBonus({ skills: { Perception: 11 } }, CHECK)).toBe(11);
    expect(legendaryCheckBonus({ skills: { Perception: { modifier: 14 } } }, CHECK)).toBe(14);
    expect(legendaryCheckBonus({ skills: { Perception: 0 } }, CHECK)).toBe(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('legendaryCheckLabel: Wisdom (Perception) / ability-only fallback', () => {
    expect(legendaryCheckLabel({ ability_check: { ability: 'wisdom', skill: 'perception' } })).toBe('Wisdom (Perception)');
    expect(legendaryCheckLabel({ ability_check: { ability: 'strength' } })).toBe('Strength check');
    expect(legendaryCheckLabel({ name: 'Lash' })).toBeNull();
  });
});

// CITE-ADVISORY — CANON advisory popup/log bytes (@ma1581 old :607).
describe('MA-0058 advisory rows (Cloaked Flight)', () => {
  const row = monstersData.find(m => m.index === 'adult-blue-dragon').legendary_actions.find(a => a.name === 'Cloaked Flight');

  it('advisory popup + ability_use log name the spell and the GM-enforced residual', () => {
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'Adult Blue Dragon 1', action: row });
    expect(html).toMatch(/Legendary Action — Cloaked Flight/);
    expect(html).toMatch(/casts invisibility on itself via Spellcasting\./);
    expect(html).toMatch(/GM-enforced \(no invisibility\/movement-distance consumer\)/);
    const e = buildLegendaryAdvisoryLog({ monsterName: 'Adult Blue Dragon 1', action: row });
    expect(e.type).toBe('ability_use');
    expect(e.abilityName).toBe('Cloaked Flight');
    expect(e.description).toBe('Adult Blue Dragon 1 legendary action Cloaked Flight: casts invisibility on itself — advisory record: invisibility and half-Fly-Speed movement are GM-enforced (no invisibility/movement-distance consumer, CLA-325).');
  });
});

const BRASS = monstersData.find(m => m.name === 'Adult Brass Dragon');
const SANDS = BRASS.legendary_actions.find(a => a.name === 'Scorching Sands');

// CITE-COOLDOWN — MA-0073 prose match/non-match region (@ma1868 #1106).
describe('MA-0073 per-action cooldown — clause parse + vocabulary', () => {
  it.each([
    ['real Scorching Sands row matches', SANDS, true],
    ["'cannot' variant matches too (honest regex)", { description: 'It cannot take this action again until the start of its next turn.' }, true],
    ['row without the clause does not match', BRASS.legendary_actions.find(a => a.name === 'Pounce'), false],
    ['"can" (not can\'t) does not match', { description: 'It can take this action again until the start of its next turn.' }, false],
    ['"your next turn" wording does not match', { description: 'It can\'t take this action again until the start of your next turn.' }, false],
    ['"use" instead of "take" does not match (MA-1868 field-vs-prose inert floor)', { once_per_turn: true, description: 'Cthulhu can\'t use this action again until its next turn.' }, false],
    ['null / description-less rows never match', null, false],
  ])('%s', (_t, action, expected) => {
    expect(hasLegendaryCooldownClause(action)).toBe(expected);
  });

  it('slug derivation + refusal popup/log bytes exact', () => {
    expect(legendaryActionSlug('Scorching Sands')).toBe('scorching_sands');
    expect(legendaryActionSlug('Grave-Dust Flight')).toBe('grave_dust_flight');
    expect(legendaryActionSlug(null)).toBe('action');
    expect(buildLegendaryCooldownRefusalPopup({ monsterName: 'Adult Brass Dragon 1', actionName: 'Scorching Sands' })).toBe('<div class="mc-prerequisite-refusal"><h3>Legendary Action Refused</h3><p>Adult Brass Dragon 1 can\'t take Scorching Sands again until the start of its next turn. Nothing spent, no roll.</p></div>');
    const e = buildLegendaryCooldownRefusalLog({ monsterName: 'Adult Brass Dragon 1', actionName: 'Scorching Sands' });
    expect(e.automationType).toBe('scorching_sands_refused (once per turn)');
    expect(e.description).toBe('Adult Brass Dragon 1 Scorching Sands refused (once per turn) — can\'t take this action again until the start of its next turn. Zero spend, no save rolled.');
  });
});

describe('MA-0073 expendLegendaryUse cooldown gate (canonical brass lifecycle)', () => {
  function brassMonster() { return { legendary_actions: BRASS.legendary_actions }; }

  it('first spend stamps the cooldown; later boundary re-click refused zero-spend; regain re-arms', async () => {
    const first = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster: brassMonster(), actionName: 'Scorching Sands', action: SANDS, campaignName: 'test-campaign', deps });
    expect(first.spent).toBe(true);
    expect(store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(store['Adult Brass Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toMatchObject({ scorching_sands: { round: 1 } });

    // New boundary, same round — the MA-0070 boundary latch would allow, the
    // row's own gate refuses: zero spend, refused (once per turn) log.
    cs.activeCreatureName = 'AasimarTest';
    const second = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster: brassMonster(), actionName: 'Scorching Sands', action: SANDS, campaignName: 'test-campaign', deps });
    expect(second).toMatchObject({ spent: false, reason: 'cooldown' });
    expect(store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(logs.some(e => e.automationType === 'scorching_sands_refused (once per turn)')).toBe(true);

    // Other legendary rows are unaffected by Scorching Sands' cooldown.
    cs.activeCreatureName = 'HexWarlock';
    const other = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster: brassMonster(), actionName: 'Blazing Light', action: BRASS.legendary_actions.find(a => a.name === 'Blazing Light'), campaignName: 'test-campaign', deps });
    expect(other.spent).toBe(true);
    expect(store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });

    // Monster's own turn-start regain clears the cooldown — row re-fires.
    cs.activeCreatureName = 'Adult Brass Dragon 1';
    const regain = await regainLegendaryUses({ monsterName: 'Adult Brass Dragon 1', campaignName: 'test-campaign', deps });
    expect(regain.regained).toBe(true);
    expect(store['Adult Brass Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toBeNull();
    cs.activeCreatureName = 'AberrantSorcerer';
    const third = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster: brassMonster(), actionName: 'Scorching Sands', action: SANDS, campaignName: 'test-campaign', deps });
    expect(third.spent).toBe(true);
  });

  it('rows without the clause stamp no cooldown (byte-inert legacy semantics)', async () => {
    const pounce = BRASS.legendary_actions.find(a => a.name === 'Pounce');
    const first = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster: brassMonster(), actionName: 'Pounce', action: pounce, campaignName: 'test-campaign', deps });
    expect(first.spent).toBe(true);
    expect(store['Adult Brass Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toBeUndefined();
    cs.activeCreatureName = 'AasimarTest';
    const second = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster: brassMonster(), actionName: 'Pounce', action: pounce, campaignName: 'test-campaign', deps });
    expect(second.spent).toBe(true);
  });

  // CITE-NOSPURIOUS — monster-agnostic turn-start branch (@ma1868 #1106).
  it('cooldown-only clear at turn-start with no uses spent: no spurious writes', async () => {
    cs = { round: 2, activeCreatureName: 'Adult Brass Dragon 1' };
    const r = await regainLegendaryUses({ monsterName: 'Nobody Dragon 1', campaignName: 'test-campaign', deps });
    expect(r).toEqual({ regained: false });
    expect(deps.setRuntimeValue.mock.calls.some(c => String(c[1]).includes(MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY))).toBe(false);
  });
});

// CITE-HEADER-CENSUS — uses:3 many-monsters header re-pins (@nidhogg #1101
// generic uses owner). Economy is monster-agnostic; each monster pins its
// header bytes + one live press through the shared gate.
describe('monsters.json legendary census — header pins + live press', () => {
  it.each([
    ['aboleth', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['adult-black-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['adult-blue-dracolich', 'General', 3, false],
    ['adult-blue-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['adult-white-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['adult-gold-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['adult-brass-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['adult-bronze-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['adult-copper-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['ancient-black-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['ancient-gold-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, false],
    ['ancient-brass-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['ancient-bronze-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['ancient-copper-dragon', 'Legendary Action Uses: 3 (4 in Lair)', 3, true],
    ['Death Tyrant', 'Legendary Action Uses: 2', 2, false],
    ['Demilich', 'Legendary Action Uses: 3', 3, false],
    ['Elemental Cataclysm', 'Legendary Action Uses: 3', 3, false],
  ])('%s header arms %s uses:%i', (index, name, uses, lair) => {
    const monster = monstersData.find(m => m.index === index || m.name === index);
    const header = legendaryHeaderAction(monster);
    expect(header).toBe(monster.legendary_actions[0]);
    expect(header.name).toBe(name);
    expect(header.uses).toBe(uses);
    expect(legendaryMaxUses(header, {})).toBe(uses);
    expect(legendaryUsesRemaining(header, {})).toBe(uses);
    expect(/lair/i.test(header.description)).toBe(lair);
  });

  it('Death Tyrant + Demilich children never carry a swallowed uses counter (§99)', () => {
    for (const name of ['Death Tyrant', 'Demilich']) {
      monstersData.find(m => m.name === name).legendary_actions.slice(1).forEach(row => {
        expect(row.uses == null).toBe(true);
      });
    }
  });

  it.each([
    ['aboleth', 'Lash'],
    ['adult-black-dragon', 'Pounce'],
    ['adult-blue-dracolich', 'Detect'],
    ['adult-blue-dragon', 'Tail Swipe'],
    ['adult-white-dragon', 'Pounce'],
    ['adult-gold-dragon', 'Pounce'],
    ['adult-brass-dragon', 'Blazing Light'],
    ['adult-bronze-dragon', 'Thunderclap'],
    ['adult-copper-dragon', 'Pounce'],
    ['ancient-black-dragon', 'Pounce'],
    ['ancient-gold-dragon', 'Pounce'],
    ['ancient-brass-dragon', 'Pounce'],
    ['ancient-bronze-dragon', 'Thunderclap'],
    ['ancient-copper-dragon', 'Pounce'],
    ['Death Tyrant', 'Chomp'],
    ['Demilich', 'Necrosis'],
    ['Elemental Cataclysm', 'Eruption'],
  ])('%s economy is live: one legal-boundary press of %s spends exactly 1', async (index, rowName) => {
    const monster = monstersData.find(m => m.index === index || m.name === index);
    const name = `${monster.name} 1`;
    const r = await expendLegendaryUse({ monsterName: name, monster, actionName: rowName, campaignName: 'test-campaign', deps });
    const max = legendaryHeaderAction(monster).uses;
    expect(r).toEqual({ spent: true, remaining: max - 1, max });
    expect(store[`${name}.monsterLegendaryUses`]).toEqual({ max, used: 1 });
    expect(store[`${name}._legendaryUses_usedRound`]).toEqual({ round: 1, activeCreature: 'Thug 1' });
  });
});

describe('monsters.json legendary row census — delegates, saves, advisories', () => {
  // Plain-"Chomp" twin cited @ma1582 (old :1330).
  it.each([
    ['adult-black-dragon', 'Pounce', 'Rend', 11, '2d6 + 6', 'Slashing'],
    ['adult-blue-dracolich', 'Tail Attack', 'Tail', 13, '2d8 + 7', 'bludgeoning'],
    ['adult-blue-dragon', 'Tail Swipe', 'Rend', 12, '2d8 + 7', 'Slashing'],
    ['adult-white-dragon', 'Pounce', 'Rend', 11, '2d6 + 6', 'Slashing'],
    ['ancient-black-dragon', 'Pounce', 'Rend', 15, '2d8 + 8', 'Slashing'],
    ['ancient-gold-dragon', 'Pounce', 'Rend', 17, '2d8 + 10', 'Slashing'],
    ['ancient-brass-dragon', 'Pounce', 'Rend', 14, '2d10 + 8', 'Slashing'],
    ['ancient-bronze-dragon', 'Pounce', 'Rend', 16, '2d8 + 9', 'Slashing'],
    ['ancient-copper-dragon', 'Pounce', 'Rend', 15, '2d10 + 8', 'Slashing'],
    ['Death Tyrant', 'Chomp', 'Bite', 9, '2d8 + 4', 'Piercing'],
    ['Demilich', 'Necrosis', 'Necrotic Burst', 11, '7d6', 'Necrotic'],
    ['Elemental Cataclysm', 'Eruption', 'Elemental Burst', 15, '5d6 + 8', 'Acid'],
  ])('%s %s delegates_to the real %s row (+%i / %s %s)', (index, rowName, target, bonus, dice, type) => {
    const monster = monstersData.find(m => m.index === index || m.name === index);
    const row = monster.legendary_actions.find(r => r.name === rowName);
    expect(row.delegates_to).toBe(target);
    expect(row.attack_bonus == null && row.save_dc == null).toBe(true);
    const d = legendaryDelegateAction(monster, row);
    expect(d).toBe(monster.actions.find(a => a.name === target));
    expect(d.attack_bonus).toBe(bonus);
    expect(d.damage_dice_primary).toBe(dice);
    expect(d.damage_type_primary).toBe(type);
    expect(legendaryDelegateAttackName(row, d)).toBe(`${rowName} (${target} attack)`);
  });

  it('Death Tyrant Glare delegates_to Eye Rays carrying the rays[] picker', () => {
    const tyrant = monstersData.find(m => m.name === 'Death Tyrant');
    const glare = tyrant.legendary_actions.find(r => r.name === 'Glare');
    const rays = legendaryDelegateAction(tyrant, glare);
    expect(rays.save_dc).toBe(17);
    expect(rays.rays).toHaveLength(10);
  });

  it.each([
    ['ancient-blue-dragon', 'adult-blue-dragon', 'Cloaked Flight'],
    ['ancient-blue-dragon', 'adult-blue-dragon', 'Tail Swipe'],
    ['ancient-brass-dragon', 'adult-brass-dragon', 'Pounce'],
    ['ancient-bronze-dragon', 'adult-bronze-dragon', 'Pounce'],
    ['ancient-copper-dragon', 'adult-copper-dragon', 'Pounce'],
  ])('%s %s byte-matches its verified adult sibling verbatim', (aIdx, bIdx, rowName) => {
    const a = monstersData.find(m => m.index === aIdx).legendary_actions.find(r => r.name === rowName);
    const b = monstersData.find(m => m.index === bIdx).legendary_actions.find(r => r.name === rowName);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it.each([
    ['ancient-brass-dragon', 'adult-brass-dragon'],
    ['ancient-bronze-dragon', 'adult-bronze-dragon'],
    ['ancient-copper-dragon', 'adult-copper-dragon'],
  ])('%s header byte-matches adult sibling header', (aIdx, bIdx) => {
    const a = monstersData.find(m => m.index === aIdx).legendary_actions[0];
    const b = monstersData.find(m => m.index === bIdx).legendary_actions[0];
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  // nullFields pins "no own numeric mechanic" (old per-ticket == null legs).
  it.each([
    ['adult-blue-dragon', 'Sonic Boom', { save_dc: 18, save_type: 'Constitution', damage_dice_primary: '3d8', damage_type_primary: 'Thunder' }, null, null, /Half damage/i, true],
    ['adult-blue-dragon', 'Cloaked Flight', { advisory: 'invisibility' }, ['attack_bonus', 'save_dc'], /movement advisory/i, null, true],
    ['adult-white-dragon', 'Freezing Burst', { save_dc: 14, save_type: 'Constitution', damage_dice_primary: '2d6' }, null, null, null, true],
    ['adult-white-dragon', 'Frightful Presence', { save_dc: 14, save_type: 'Charisma' }, null, null, null, true],
    ['adult-white-dragon', 'Pounce', { delegates_to: 'Rend' }, ['attack_bonus', 'save_dc', 'uses'], /movement advisory/i, null, false],
    ['ancient-black-dragon', 'Pounce', { delegates_to: 'Rend' }, ['attack_bonus', 'save_dc', 'uses'], /movement advisory — GM moves the token; no movement-distance consumer/i, null, false],
    ['ancient-blue-dragon', 'Sonic Boom', { save_dc: 22, save_type: 'Constitution', damage_dice_primary: '4d8', damage_type_primary: 'Thunder', dc_success: 'half' }, ['attack_bonus', 'delegates_to', 'advisory', 'uses'], /\(level 3 version\)[\s\S]*10-ft-radius sphere/, null, true],
    ['ancient-black-dragon', 'Cloud of Insects', { save_dc: 21, save_type: 'Dexterity', damage_dice_primary: '6d10', damage_type_primary: 'Poison' }, null, null, null, true],
    ['ancient-black-dragon', 'Frightful Presence', { save_dc: 21, save_type: 'Wisdom', repeat_save: { save_type: 'Wisdom' } }, ['delegates_to', 'uses'], /can't take this action again until the start of its next turn/, null, true],
    ['ancient-gold-dragon', 'Banish', { save_dc: 24, save_type: 'Charisma', damage_dice_primary: '7d6', damage_type_primary: 'Force' }, null, null, null, true],
    ['ancient-brass-dragon', 'Scorching Sands', { save_dc: 20, save_type: 'Dexterity', dc_success: 'none', damage_dice_primary: '8d8', damage_type_primary: 'Fire' }, ['delegates_to', 'advisory', 'uses'], null, /Success: no damage/, true],
    ['ancient-brass-dragon', 'Blazing Light', { attack_bonus: 12, spell_attack_bonus: 12, damage_dice_primary: '2d6' }, null, null, null, false],
    ['ancient-bronze-dragon', 'Thunderclap', { save_dc: 22, dc_success: 'none', damage_dice_primary: '3d8' }, null, null, /Success: no damage/, false],
    ['ancient-copper-dragon', 'Giggling Magic', { dc_success: 'none' }, null, null, /Success: no damage and no debuff/, true],
    ['ancient-copper-dragon', 'Mind Jolt', { save_dc: 21, save_type: 'Wisdom', dc_success: 'half', damage_dice_primary: '6d8', damage_type_primary: 'Psychic' }, null, /level 5 version/, null, true],
    ['Demilich', 'Energy Drain', { save_dc: 19, save_type: 'Constitution', range: '120 feet' }, ['uses'], null, null, true],
    ['Demilich', 'Grave-Dust Flight', { save_dc: 19, save_type: 'Constitution' }, ['uses'], null, null, true],
  ])('%s %s numeric/advisory pin', (index, rowName, fields, nullFields, descRe, seRe, cooldown) => {
    const monster = monstersData.find(m => m.index === index || m.name === index);
    const row = monster.legendary_actions.find(r => r.name === rowName);
    expect(row).toMatchObject(fields);
    (nullFields || []).forEach(k => { expect(row[k] == null).toBe(true); });
    if (descRe) expect(row.description).toMatch(descRe);
    if (seRe) expect(row.save_effect).toMatch(seRe);
    expect(hasLegendaryCooldownClause(row)).toBe(cooldown);
  });

  it('ancient-copper Mind Jolt keeps adult-shape key parity (only values scale)', () => {
    const mj = monstersData.find(m => m.index === 'ancient-copper-dragon').legendary_actions.find(r => r.name === 'Mind Jolt');
    const adult = monstersData.find(m => m.index === 'adult-copper-dragon').legendary_actions.find(r => r.name === 'Mind Jolt');
    expect(Object.keys(mj).sort()).toEqual(Object.keys(adult).sort());
  });
});
