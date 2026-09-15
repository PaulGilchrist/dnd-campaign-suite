// MA-0021: legendary-uses economy — expend / gate / turn-latch / regain /
// refusal. Mirrors MA-0005/MA-0020 finite-uses runtime-map tracking.
// MA-0022: non-numeric legendary rows delegate their mechanic to a named
// attack row on the same monster (`delegates_to`).
// MA-0023: Psychic Drain any-ally prerequisite gate + self_heal 1d10 via
// the canonical applyHealingToTarget helper.
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('MA-0021 header / max / remaining', () => {
  it('header is legendary_actions[0] when it authors uses; max + remaining derive', () => {
    expect(legendaryHeaderAction(AB).uses).toBe(3);
    expect(legendaryMaxUses(AB.legendary_actions[0], {})).toBe(3);
    expect(legendaryUsesRemaining(AB.legendary_actions[0], {})).toBe(3);
    expect(legendaryUsesRemaining(AB.legendary_actions[0], { max: 3, used: 2 })).toBe(1);
    expect(legendaryUsesRemaining(AB.legendary_actions[0], { max: 3, used: 3 })).toBe(0);
  });

  it('max rides the stamped map when the header block is absent (turn-start regain seam)', () => {
    expect(legendaryHeaderAction({ legendary_actions: [{ name: 'No Uses' }] })).toBeNull();
    expect(legendaryMaxUses(null, { max: 3 })).toBe(3);
  });
});

describe('MA-0021 expend gate', () => {
  it('allows the first expend after another creature\'s turn', () => {
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: {}, round: 1, activeCreatureName: 'Thug 1', monsterName: 'Aboleth 1', latch: null });
    expect(g.allowed).toBe(true);
    expect(g.remaining).toBe(3);
  });

  it('refuses a second expend within the same creature turn (round+turn latch)', () => {
    const latch = { round: 1, activeCreature: 'Thug 1' };
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: { max: 3, used: 1 }, round: 1, activeCreatureName: 'Thug 1', monsterName: 'Aboleth 1', latch });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('turn');
  });

  it('refuses on its own turn', () => {
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: {}, round: 2, activeCreatureName: 'Aboleth 1', monsterName: 'Aboleth 1', latch: null });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('own-turn');
  });

  it('refuses when exhausted (0 left)', () => {
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: { max: 3, used: 3 }, round: 1, activeCreatureName: 'Thug 1', monsterName: 'Aboleth 1', latch: null });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('exhausted');
  });

  it('allows again on the next other-creature turn (different activeCreature)', () => {
    const latch = { round: 1, activeCreature: 'Thug 1' };
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: { max: 3, used: 1 }, round: 1, activeCreatureName: 'Cleric 2', monsterName: 'Aboleth 1', latch });
    expect(g.allowed).toBe(true);
  });
});

describe('MA-0021 expend spend flow', () => {
  it('spends 1, writes the map + latch, logs ability_use with N left', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: 'Lash', campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(true);
    expect(r.remaining).toBe(2);
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(store['Aboleth 1._legendaryUses_usedRound']).toEqual({ round: 1, activeCreature: 'Thug 1' });
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/expends a legendary use for Lash .* 2 of 3 left/s);
  });

  it('exhausted click: zero spend, zero latch, legendary_use_refused log', async () => {
    store['Aboleth 1.monsterLegendaryUses'] = { max: 3, used: 3 };
    const r = await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: 'Lash', campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('exhausted');
    expect(r.popupHtml).toMatch(/Legendary Action Refused/);
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(store['Aboleth 1._legendaryUses_usedRound']).toBeUndefined();
    expect(logs.some(e => e.automationType === 'legendary_use_refused')).toBe(true);
    expect(logs.some(e => e.type === 'ability_use')).toBe(false);
  });

  it('same-turn second click refused, no spend', async () => {
    await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: 'Lash', campaignName: 'test-campaign', deps });
    const second = await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: 'Psychic Drain', campaignName: 'test-campaign', deps });
    expect(second.spent).toBe(false);
    expect(second.reason).toBe('turn');
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

describe('MA-0021 turn-start regain', () => {
  it('regains all uses at the start of the monster turn, clears latch, logs ability_use', async () => {
    store['Aboleth 1.monsterLegendaryUses'] = { max: 3, used: 2 };
    store['Aboleth 1._legendaryUses_usedRound'] = { round: 1, activeCreature: 'Thug 1' };
    const r = await regainLegendaryUses({ monsterName: 'Aboleth 1', campaignName: 'test-campaign', deps });
    expect(r.regained).toBe(true);
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(store['Aboleth 1._legendaryUses_usedRound']).toBeNull();
    const log = logs.find(e => e.type === 'ability_use');
    expect(log).toBeTruthy();
    expect(log.description).toMatch(/regains all expended legendary action uses .* 3 available/);
  });

  it('silent no-op when nothing was spent', async () => {
    const r = await regainLegendaryUses({ monsterName: 'Aboleth 1', campaignName: 'test-campaign', deps });
    expect(r.regained).toBe(false);
    expect(logs.length).toBe(0);
  });

  it('refusal log carries the legendary_use_refused automationType + zero-spend wording', () => {
    const e = buildLegendaryRefusalLog({ monsterName: 'Aboleth 1', actionName: 'Lash', reason: 'turn' });
    expect(e.automationType).toBe('legendary_use_refused');
    expect(e.description).toMatch(/refused \(turn\).*zero spend, no roll/s);
  });
});

describe('MA-0022 legendary delegation (Lash → Tentacle)', () => {
  it('delegates_to resolves to the named attack row with its own numbers', () => {
    const lash = AB.legendary_actions[1];
    const d = legendaryDelegateAction(AB, lash);
    expect(d).toBe(TENTACLE);
    expect(d.attack_bonus).toBe(9);
    expect(d.damage_dice_primary).toBe('2d6 + 5');
  });

  it('finds delegates among legendary_actions siblings too', () => {
    const m = {
      legendary_actions: [
        AB.legendary_actions[0],
        { name: 'Lash', delegates_to: 'Tentacle' },
        TENTACLE,
      ],
    };
    expect(legendaryDelegateAction(m, m.legendary_actions[1])).toBe(TENTACLE);
  });

  it('null when no delegates_to, unknown name, or self-reference', () => {
    expect(legendaryDelegateAction(AB, AB.legendary_actions[2])).toBeNull();
    expect(legendaryDelegateAction(AB, { name: 'Lash', delegates_to: 'Bite' })).toBeNull();
    expect(legendaryDelegateAction(AB, TENTACLE)).toBeNull();
    expect(legendaryDelegateAction(null, { name: 'Lash', delegates_to: 'Tentacle' })).toBeNull();
  });

  it('delegate attack log name reads "Lash (Tentacle attack)"', () => {
    const lash = AB.legendary_actions[1];
    expect(legendaryDelegateAttackName(lash, TENTACLE)).toBe('Lash (Tentacle attack)');
  });

  it('spend with the delegate name spends 1 use and logs "Lash (Tentacle attack)"', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: legendaryDelegateAttackName(AB.legendary_actions[1], TENTACLE), campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(true);
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/expends a legendary use for Lash \(Tentacle attack\)/);
  });

  it('no-delegate refusal popup + log wording, zero spend', () => {
    const p = buildLegendaryRefusalPopup({ monsterName: 'Aboleth 1', actionName: 'Lash', reason: 'no-delegate' });
    expect(p).toMatch(/Legendary Action Refused/);
    expect(p).toMatch(/delegates to an attack that could not be found/);
    const e = buildLegendaryRefusalLog({ monsterName: 'Aboleth 1', actionName: 'Lash', reason: 'no-delegate' });
    expect(e.automationType).toBe('legendary_use_refused');
    expect(e.description).toMatch(/refused \(no-delegate\).*zero spend, no roll/s);
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

describe('MA-0023 monsters.json data: Psychic Drain structured fields', () => {
  it('row carries delegates_to Consume Memories + self_heal 1d10 + any_ally target_prerequisite', () => {
    const aboleth = monstersData.find(m => m.name === 'Aboleth');
    const row = aboleth.legendary_actions.find(a => a.name === 'Psychic Drain');
    expect(row.delegates_to).toBe('Consume Memories');
    expect(row.self_heal).toBe('1d10');
    expect(row.target_prerequisite.conditions).toEqual(['charmed', 'grappled']);
    expect(row.target_prerequisite.any_ally_of_attacker).toBe(true);
  });

  it('delegates_to resolves to the real Consume Memories save row', () => {
    const aboleth = monstersData.find(m => m.name === 'Aboleth');
    const row = aboleth.legendary_actions.find(a => a.name === 'Psychic Drain');
    const d = legendaryDelegateAction(aboleth, row);
    expect(d.name).toBe('Consume Memories');
    expect(d.save_dc).toBe(16);
    expect(legendaryDelegateAttackName(row, d)).toBe('Psychic Drain (Consume Memories save)');
  });
});

describe('MA-0023 any-ally prerequisite gate', () => {
  it('parses only any_ally_of_attacker shaped prerequisites', () => {
    expect(parseLegendaryAllyPrerequisite(PSYCHIC_DRAIN).conditions).toEqual(['charmed', 'grappled']);
    expect(parseLegendaryAllyPrerequisite(CONSUME_MEMORIES)).toBeNull();
    expect(parseLegendaryAllyPrerequisite({ name: 'X' })).toBeNull();
  });

  it('met: creature Charmed with provenance source = monster', () => {
    const rt = (name, key) => (name === 'TestPC' && key === 'activeConditions' ? ['charmed']
      : name === 'TestPC' && key === 'activeConditionMeta' ? { charmed: { dc: 15, source: 'Aboleth 1' } } : null);
    const r = legendaryAllyPrerequisiteSatisfied({ prerequisite: parseLegendaryAllyPrerequisite(PSYCHIC_DRAIN), creatures: [{ name: 'Aboleth 1' }, { name: 'TestPC' }], monsterName: 'Aboleth 1', getRuntimeValue: rt });
    expect(r.satisfied).toBe(true);
    expect(r.targetName).toBe('TestPC');
  });

  it('met: MA-0018 tentacle-grapple provenance (grappled, source stamped by hit clause)', () => {
    const rt = (name, key) => (name === 'Thug 1' && key === 'activeConditions' ? ['grappled']
      : name === 'Thug 1' && key === 'activeConditionMeta' ? { grappled: { dc: 14, source: 'Aboleth 1' } } : null);
    const r = legendaryAllyPrerequisiteSatisfied({ prerequisite: parseLegendaryAllyPrerequisite(PSYCHIC_DRAIN), creatures: [{ name: 'Aboleth 1' }, { name: 'Thug 1' }], monsterName: 'Aboleth 1', getRuntimeValue: rt });
    expect(r.satisfied).toBe(true);
    expect(r.condition).toBe('grappled');
  });

  it('unmet: no conditions at all', () => {
    const r = legendaryAllyPrerequisiteSatisfied({ prerequisite: parseLegendaryAllyPrerequisite(PSYCHIC_DRAIN), creatures: [{ name: 'Aboleth 1' }, { name: 'TestPC' }], monsterName: 'Aboleth 1', getRuntimeValue: () => null });
    expect(r.satisfied).toBe(false);
  });

  it('unmet: condition present but attributed to ANOTHER creature (provenance fails)', () => {
    const rt = (name, key) => (name === 'TestPC' && key === 'activeConditions' ? ['charmed']
      : name === 'TestPC' && key === 'activeConditionMeta' ? { charmed: { source: 'Rival Hag' } } : null);
    const r = legendaryAllyPrerequisiteSatisfied({ prerequisite: parseLegendaryAllyPrerequisite(PSYCHIC_DRAIN), creatures: [{ name: 'Aboleth 1' }, { name: 'TestPC' }], monsterName: 'Aboleth 1', getRuntimeValue: rt });
    expect(r.satisfied).toBe(false);
  });

  it('refusal popup + psychic_drain_refused log, zero-spend wording', () => {
    const p = buildLegendaryPrerequisiteRefusalPopup({ monsterName: 'Aboleth 1', actionName: 'Psychic Drain', prerequisite: parseLegendaryAllyPrerequisite(PSYCHIC_DRAIN) });
    expect(p).toMatch(/Prerequisite Not Met/);
    expect(p).toMatch(/Charmed or Grappled/);
    const e = buildLegendaryPrerequisiteRefusalLog({ monsterName: 'Aboleth 1', actionName: 'Psychic Drain', prerequisite: parseLegendaryAllyPrerequisite(PSYCHIC_DRAIN) });
    expect(e.automationType).toBe('psychic_drain_refused');
    expect(e.description).toMatch(/no creature is Charmed or Grappled by Aboleth 1.*[Zz]ero spend, no roll, no healing/s);
  });
});

describe('MA-0023 self-heal leg', () => {
  it('rolls 1d10 (1..10 range), heals via canonical applyHealingToTarget, logs hp_change naming Psychic Drain', async () => {
    const cs = { creatures: [{ name: 'Aboleth 1', type: 'npc', currentHp: 140, maxHp: 150 }] };
    const healCalls = [];
    const entries = [];
    const r = await applyLegendarySelfHeal({
      monsterName: 'Aboleth 1',
      actionName: 'Psychic Drain',
      formula: '1d10',
      campaignName: 'test-campaign',
      deps: {
        getCombatContext: () => Promise.resolve(cs),
        applyHealingToTarget: (c, name, amount) => { healCalls.push({ name, amount }); return { actualHeal: amount, newHp: c.creatures[0].currentHp + amount, maxHp: 150 }; },
        addEntry: (_c, e) => { entries.push(e); return Promise.resolve(); },
      },
    });
    expect(healCalls[0]).toEqual({ name: 'Aboleth 1', amount: r.rolled });
    expect(r.rolled).toBeGreaterThanOrEqual(1);
    expect(r.rolled).toBeLessThanOrEqual(10);
    expect(entries[0].type).toBe('hp_change');
    expect(entries[0].isHealing).toBe(true);
    expect(entries[0].delta).toBe(r.rolled);
    expect(entries[0].description).toContain('Psychic Drain');
  });

  it('real rollExpression over many rolls stays in 1..10 and logs hp_change isHealing', async () => {
    const entryLogs = [];
    for (let i = 0; i < 30; i++) {
      const cs = { creatures: [{ name: 'Aboleth 1', type: 'npc', currentHp: 100, maxHp: 150 }] };
      const r = await applyLegendarySelfHeal({
        monsterName: 'Aboleth 1',
        actionName: 'Psychic Drain',
        formula: '1d10',
        campaignName: 'test-campaign',
        deps: {
          getCombatContext: () => Promise.resolve(cs),
          applyHealingToTarget: (c, _n, amount) => ({ actualHeal: amount, newHp: c.creatures[0].currentHp + amount, maxHp: 150 }),
          addEntry: (_c, e) => { entryLogs.push(e); return Promise.resolve(); },
        },
      });
      expect(r.rolled).toBeGreaterThanOrEqual(1);
      expect(r.rolled).toBeLessThanOrEqual(10);
    }
    const e = entryLogs[0];
    expect(e.type).toBe('hp_change');
    expect(e.isHealing).toBe(true);
    expect(e.targetName).toBe('Aboleth 1');
    expect(e.description).toMatch(/Psychic Drain self-heal: 1d10 rolled/);
  });

  it('healed via the REAL applyHealingToTarget: combatSummary currentHp rises, clamped at max', async () => {
    const cs = { creatures: [{ name: 'Aboleth 1', type: 'npc', currentHp: 148, maxHp: 150 }] };
    const r = await applyLegendarySelfHeal({
      monsterName: 'Aboleth 1',
      actionName: 'Psychic Drain',
      formula: '1d10',
      campaignName: 'test-campaign',
      deps: {
        getCombatContext: () => Promise.resolve(cs),
        addEntry: vi.fn(() => Promise.resolve()),
      },
    });
    expect(cs.creatures[0].currentHp).toBeGreaterThan(148);
    expect(cs.creatures[0].currentHp).toBeLessThanOrEqual(150);
    expect(r.applied).toBe(cs.creatures[0].currentHp - 148);
    expect(r.applied).toBeLessThanOrEqual(10);
  });
});

describe('MA-0040 Adult Black Dragon Pounce delegates_to Rend', () => {
  const dragon = monstersData.find(m => m.index === 'adult-black-dragon');
  const pounce = dragon.legendary_actions.find(a => a.name === 'Pounce');
  const rend = dragon.actions.find(a => a.name === 'Rend');

  it('row carries delegates_to Rend + movement advisory in description', () => {
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.attack_bonus == null && pounce.save_dc == null).toBe(true);
    expect(pounce.description).toMatch(/movement advisory/i);
  });

  it('delegates_to resolves to the real Rend attack row (+11 / 2d6 + 6 Slashing + 1d8 Acid)', () => {
    const d = legendaryDelegateAction(dragon, pounce);
    expect(d).toBe(rend);
    expect(d.attack_bonus).toBe(11);
    expect(d.damage_dice_primary).toBe('2d6 + 6');
    expect(d.damage_type_primary).toBe('Slashing');
    expect(d.damage_dice_secondary).toBe('1d8');
    expect(d.damage_type_secondary).toBe('Acid');
  });

  it('attack log name reads "Pounce (Rend attack)"', () => {
    expect(legendaryDelegateAttackName(pounce, rend)).toBe('Pounce (Rend attack)');
  });

  it('spend with the delegate name spends 1 use and logs "Pounce (Rend attack)"', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Adult Black Dragon 1', monster: dragon, actionName: legendaryDelegateAttackName(pounce, rend), campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(true);
    expect(store['Adult Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/expends a legendary use for Pounce \(Rend attack\)/);
  });
});

describe('MA-0050 Adult Blue Dracolich "General" header authors uses:3', () => {
  const dracolich = monstersData.find(m => m.index === 'adult-blue-dracolich');

  it('legendary_actions[0] is the General header with uses:3', () => {
    const header = legendaryHeaderAction(dracolich);
    expect(header?.name).toBe('General');
    expect(header?.uses).toBe(3);
    expect(legendaryMaxUses(header, {})).toBe(3);
  });

  it('economy is live: expend after another turn, exhaust, refuse, regain', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Adult Blue Dracolich 1', monster: dracolich, actionName: 'Detect', campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Adult Blue Dracolich 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });

    const sameTurn = await expendLegendaryUse({ monsterName: 'Adult Blue Dracolich 1', monster: dracolich, actionName: 'Tail Attack', campaignName: 'test-campaign', deps });
    expect(sameTurn.spent).toBe(false);
    expect(sameTurn.reason).toBe('turn');

    cs.activeCreatureName = 'AasimarTest';
    await expendLegendaryUse({ monsterName: 'Adult Blue Dracolich 1', monster: dracolich, actionName: 'Tail Attack', campaignName: 'test-campaign', deps });
    cs.activeCreatureName = 'HexWarlock';
    const third = await expendLegendaryUse({ monsterName: 'Adult Blue Dracolich 1', monster: dracolich, actionName: 'Tail Attack', campaignName: 'test-campaign', deps });
    expect(third).toEqual({ spent: true, remaining: 0, max: 3 });
    cs.activeCreatureName = 'FeyRanger';
    const exhausted = await expendLegendaryUse({ monsterName: 'Adult Blue Dracolich 1', monster: dracolich, actionName: 'Detect', campaignName: 'test-campaign', deps });
    expect(exhausted.reason).toBe('exhausted');

    const regain = await regainLegendaryUses({ monsterName: 'Adult Blue Dracolich 1', campaignName: 'test-campaign', deps });
    expect(regain).toEqual({ regained: true, max: 3 });
    expect(store['Adult Blue Dracolich 1.monsterLegendaryUses'].used).toBe(0);
  });
});

// MA-0051: Adult Blue Dracolich "Detect" — authored ability_check row.
describe('MA-0051 legendary ability-check rows', () => {
  const dracolich = monstersData.find(m => m.name === 'Adult Blue Dracolich');

  it('data: Detect row authors ability_check wisdom/perception; skills.Perception is +14', () => {
    const detect = dracolich.legendary_actions.find(a => a.name === 'Detect');
    expect(detect.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(dracolich.skills.Perception.modifier).toBe(14);
    expect(dracolich.skills.Preception).toBeUndefined();
  });

  it('legendaryCheckRow: only rows with ability_check qualify', () => {
    expect(legendaryCheckRow({ name: 'Detect', ability_check: { ability: 'wisdom', skill: 'perception' } })).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(legendaryCheckRow({ name: 'Tail Attack' })).toBeNull();
    expect(legendaryCheckRow({ name: 'Bad', ability_check: {} })).toBeNull();
    expect(legendaryCheckRow(null)).toBeNull();
  });

  it('legendaryCheckBonus: skill mod wins (case-insensitive), ability mod fallback, null when unresolvable', () => {
    const check = { ability: 'wisdom', skill: 'perception' };
    expect(legendaryCheckBonus(dracolich, { name: 'Detect', ability_check: check })).toBe(14);
    expect(legendaryCheckBonus({ skills: { PeRcEPTION: { modifier: 9 } } }, { ability_check: check })).toBe(9);
    expect(legendaryCheckBonus({ ability_score_modifiers: { wis: 3 } }, { ability_check: check })).toBe(3);
    expect(legendaryCheckBonus({ ability_score_modifiers: { wis: -2 } }, { ability_check: check })).toBe(-2);
    expect(legendaryCheckBonus({}, { ability_check: check })).toBeNull();
    expect(legendaryCheckBonus(dracolich, { name: 'Tail Attack' })).toBeNull();
  });

  it('legendaryCheckLabel: Wisdom (Perception) / ability-only fallback', () => {
    expect(legendaryCheckLabel({ ability_check: { ability: 'wisdom', skill: 'perception' } })).toBe('Wisdom (Perception)');
    expect(legendaryCheckLabel({ ability_check: { ability: 'strength' } })).toBe('Strength check');
    expect(legendaryCheckLabel({ name: 'Lash' })).toBeNull();
  });

  it('no-check-bonus refusal popup names the stat block gap', () => {
    const html = buildLegendaryRefusalPopup({ monsterName: 'Adult Blue Dracolich 1', actionName: 'Detect', reason: 'no-check-bonus' });
    expect(html).toContain('ability check');
    expect(html).toContain('Nothing spent, no roll');
    expect(buildLegendaryRefusalPopup({ monsterName: 'X', actionName: 'Y', reason: 'no-uses' })).toContain('no legendary uses');
  });
});

// MA-0052: Adult Blue Dracolich "Tail Attack" legendary row — data fix
// mirroring MA-0040 Pounce: delegates_to the monster's own Tail action.
describe('MA-0052 Adult Blue Dracolich Tail Attack delegates_to Tail', () => {
  const dracolich = monstersData.find(m => m.index === 'adult-blue-dracolich');
  const tailAttack = dracolich.legendary_actions.find(a => a.name === 'Tail Attack');
  const tail = dracolich.actions.find(a => a.name === 'Tail');

  it('row carries delegates_to Tail with no own numeric mechanic', () => {
    expect(tailAttack.delegates_to).toBe('Tail');
    expect(tailAttack.attack_bonus == null && tailAttack.save_dc == null && tailAttack.damage_dice_primary == null).toBe(true);
  });

  it('delegates_to resolves to the real Tail attack row (+13 / 2d8 + 7 bludgeoning / reach 15 ft.)', () => {
    const d = legendaryDelegateAction(dracolich, tailAttack);
    expect(d).toBe(tail);
    expect(d.attack_bonus).toBe(13);
    expect(d.damage_dice_primary).toBe('2d8 + 7');
    expect(d.damage_type_primary).toBe('bludgeoning');
    expect(d.reach).toBe('15 ft.');
  });

  it('attack log name reads "Tail Attack (Tail attack)"', () => {
    expect(legendaryDelegateAttackName(tailAttack, tail)).toBe('Tail Attack (Tail attack)');
  });

  it('no-delegate refusal fires when the named row is absent', () => {
    const dangling = { name: 'Tail Attack', delegates_to: 'Wing Buffet', description: '…' };
    expect(legendaryDelegateAction(dracolich, dangling)).toBeNull();
    const html = buildLegendaryRefusalPopup({ monsterName: 'Adult Blue Dracolich 1', actionName: 'Tail Attack', reason: 'no-delegate' });
    expect(html).toContain('could not be found');
    expect(html).toContain('Nothing spent, no roll');
  });

  it('spend with the delegate name spends 1 use and logs "Tail Attack (Tail attack)"', async () => {
    cs.activeCreatureName = 'Thug 1';
    const r = await expendLegendaryUse({ monsterName: 'Adult Blue Dracolich 1', monster: dracolich, actionName: legendaryDelegateAttackName(tailAttack, tail), campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(true);
    expect(store['Adult Blue Dracolich 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/expends a legendary use for Tail Attack \(Tail attack\)/);
  });

  it('exhausted refusal after 3 spends logs legendary_use_refused with zero roll', async () => {
    cs.activeCreatureName = 'Thug 1';
    await expendLegendaryUse({ monsterName: 'Drac 1', monster: dracolich, actionName: 'Tail Attack (Tail attack)', campaignName: 'test-campaign', deps });
    cs.activeCreatureName = 'AasimarTest';
    await expendLegendaryUse({ monsterName: 'Drac 1', monster: dracolich, actionName: 'Tail Attack (Tail attack)', campaignName: 'test-campaign', deps });
    cs.activeCreatureName = 'HexWarlock';
    await expendLegendaryUse({ monsterName: 'Drac 1', monster: dracolich, actionName: 'Tail Attack (Tail attack)', campaignName: 'test-campaign', deps });
    cs.activeCreatureName = 'FeyRanger';
    const refused = await expendLegendaryUse({ monsterName: 'Drac 1', monster: dracolich, actionName: 'Tail Attack (Tail attack)', campaignName: 'test-campaign', deps });
    expect(refused).toMatchObject({ spent: false, reason: 'exhausted' });
    expect(refused.popupHtml).toContain('no legendary uses left');
    const refusal = logs.find(e => e.automationType === 'legendary_use_refused');
    expect(refusal.description).toMatch(/refused \(exhausted\) — zero spend, no roll/);
  });
});

// MA-0058: Adult Blue Dragon "Legendary Action Uses: 3 (4 in Lair)" —
// data fix mirroring MA-0037/0050: header authors uses:3 (+ lair advisory);
// the three verbatim rows classified post-MA-0021/0051 — Tail Swipe attack
// delegate (MA-0022), Sonic Boom save row (MA-0039 shape, spell save DC 18
// Constitution 3d8 Thunder per MA-0054 Shatter truth), Cloaked Flight
// advisory row (MA-0024/CLA-325 — no invisibility/movement consumer).
describe('MA-0058 Adult Blue Dragon legendary header + row classification', () => {
  const dragon = monstersData.find(m => m.index === 'adult-blue-dragon');

  it('header authors uses:3 with lair advisory', () => {
    const header = legendaryHeaderAction(dragon);
    expect(header?.name).toBe('Legendary Action Uses: 3 (4 in Lair)');
    expect(header?.uses).toBe(3);
    expect(legendaryMaxUses(header, {})).toBe(3);
    expect(header.description).toMatch(/In its lair the dragon has 4 uses \(advisory .* GM-enforced\)/);
  });

  it('Cloaked Flight: advisory row, no own numeric mechanic, movement advisory text', () => {
    const row = dragon.legendary_actions.find(a => a.name === 'Cloaked Flight');
    expect(row.advisory).toBe('invisibility');
    expect(row.attack_bonus == null && row.save_dc == null).toBe(true);
    expect(row.description).toMatch(/movement advisory/i);
  });

  it('Sonic Boom: authored Constitution save row at spell save DC 18, 3d8 Thunder', () => {
    const row = dragon.legendary_actions.find(a => a.name === 'Sonic Boom');
    expect(row.save_dc).toBe(18);
    expect(row.save_type).toBe('Constitution');
    expect(row.damage_dice_primary).toBe('3d8');
    expect(row.damage_type_primary).toBe('Thunder');
    expect(row.save_effect).toMatch(/Half damage/i);
  });

  it('Tail Swipe delegates_to the real Rend attack row (+12 / 2d8 + 7 Slashing + 1d10 Lightning)', () => {
    const row = dragon.legendary_actions.find(a => a.name === 'Tail Swipe');
    expect(row.delegates_to).toBe('Rend');
    const d = legendaryDelegateAction(dragon, row);
    expect(d).toBe(dragon.actions.find(a => a.name === 'Rend'));
    expect(d.attack_bonus).toBe(12);
    expect(d.damage_dice_primary).toBe('2d8 + 7');
    expect(d.damage_type_primary).toBe('Slashing');
    expect(d.damage_dice_secondary).toBe('1d10');
    expect(d.damage_type_secondary).toBe('Lightning');
    expect(legendaryDelegateAttackName(row, d)).toBe('Tail Swipe (Rend attack)');
  });

  it('economy is live: 3 spends across other-creature turns, exhaustion refusal, turn-start regain', async () => {
    cs.activeCreatureName = 'Thug 1';
    const tail = await expendLegendaryUse({ monsterName: 'Adult Blue Dragon 1', monster: dragon, actionName: 'Tail Swipe (Rend attack)', campaignName: 'test-campaign', deps });
    expect(tail).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Adult Blue Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });

    const sameTurn = await expendLegendaryUse({ monsterName: 'Adult Blue Dragon 1', monster: dragon, actionName: 'Sonic Boom', campaignName: 'test-campaign', deps });
    expect(sameTurn.reason).toBe('turn');

    cs.activeCreatureName = 'AasimarTest';
    const sonic = await expendLegendaryUse({ monsterName: 'Adult Blue Dragon 1', monster: dragon, actionName: 'Sonic Boom', campaignName: 'test-campaign', deps });
    expect(sonic).toEqual({ spent: true, remaining: 1, max: 3 });
    cs.activeCreatureName = 'HexWarlock';
    const cloaked = await expendLegendaryUse({ monsterName: 'Adult Blue Dragon 1', monster: dragon, actionName: 'Cloaked Flight', campaignName: 'test-campaign', deps });
    expect(cloaked).toEqual({ spent: true, remaining: 0, max: 3 });

    cs.activeCreatureName = 'FeyRanger';
    const exhausted = await expendLegendaryUse({ monsterName: 'Adult Blue Dragon 1', monster: dragon, actionName: 'Tail Swipe (Rend attack)', campaignName: 'test-campaign', deps });
    expect(exhausted.reason).toBe('exhausted');
    expect(logs.some(e => e.automationType === 'legendary_use_refused')).toBe(true);

    cs.activeCreatureName = 'Adult Blue Dragon 1';
    const ownTurn = await expendLegendaryUse({ monsterName: 'Adult Blue Dragon 1', monster: dragon, actionName: 'Sonic Boom', campaignName: 'test-campaign', deps });
    expect(ownTurn.reason).toBe('exhausted');
    const regain = await regainLegendaryUses({ monsterName: 'Adult Blue Dragon 1', campaignName: 'test-campaign', deps });
    expect(regain).toEqual({ regained: true, max: 3 });
    expect(store['Adult Blue Dragon 1.monsterLegendaryUses'].used).toBe(0);
  });

  it('advisory popup + ability_use log name the spell and the GM-enforced residual', () => {
    const row = dragon.legendary_actions.find(a => a.name === 'Cloaked Flight');
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'Adult Blue Dragon 1', action: row });
    expect(html).toMatch(/Legendary Action — Cloaked Flight/);
    expect(html).toMatch(/casts invisibility on itself/);
    expect(html).toMatch(/GM-enforced/);
    const e = buildLegendaryAdvisoryLog({ monsterName: 'Adult Blue Dragon 1', action: row });
    expect(e.type).toBe('ability_use');
    expect(e.abilityName).toBe('Cloaked Flight');
    expect(e.description).toMatch(/casts invisibility on itself.*GM-enforced/s);
  });
});

// MA-0073: per-action once-per-turn cooldown (Scorching Sands "can't take
// this action again until the start of its next turn"). The MA-0070 latch
// is one-expend-per-boundary; the action-keyed map keeps the SAME row
// unusable across every later boundary until the monster's own turn-start
// regain clears it.
import {
  hasLegendaryCooldownClause,
  legendaryActionSlug,
  MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY,
  buildLegendaryCooldownRefusalLog,
  buildLegendaryCooldownRefusalPopup,
} from './monsterLegendaryUses.js';

const BRASS = monstersData.find(m => m.name === 'Adult Brass Dragon');
const SANDS = BRASS.legendary_actions.find(a => a.name === 'Scorching Sands');

describe('MA-0073 per-action cooldown clause parse', () => {
  it('matches the Scorching Sands row text, not rows without the clause', () => {
    expect(hasLegendaryCooldownClause(SANDS)).toBe(true);
    expect(hasLegendaryCooldownClause(BRASS.legendary_actions.find(a => a.name === 'Pounce'))).toBe(false);
    expect(hasLegendaryCooldownClause(null)).toBe(false);
    expect(legendaryActionSlug('Scorching Sands')).toBe('scorching_sands');
  });

  it('refusal log is <action>_refused (once per turn); popup names the gate', () => {
    const e = buildLegendaryCooldownRefusalLog({ monsterName: 'Adult Brass Dragon 1', actionName: 'Scorching Sands' });
    expect(e.automationType).toBe('scorching_sands_refused (once per turn)');
    expect(e.description).toMatch(/can't take this action again until the start of its next turn/);
    expect(buildLegendaryCooldownRefusalPopup({ monsterName: 'Adult Brass Dragon 1', actionName: 'Scorching Sands' })).toMatch(/can't take Scorching Sands again/);
  });
});

describe('MA-0073 expendLegendaryUse per-action cooldown gate', () => {
  function brassMonster() {
    return { legendary_actions: BRASS.legendary_actions };
  }

  it('first spend stamps the cooldown; later boundary re-click refused zero-spend; regain re-arms', async () => {
    cs = { round: 1, activeCreatureName: 'Thug 1' };
    const monster = brassMonster();
    const first = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster, actionName: 'Scorching Sands', action: SANDS, campaignName: 'test-campaign', deps });
    expect(first.spent).toBe(true);
    expect(store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(store['Adult Brass Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toMatchObject({ scorching_sands: { round: 1 } });

    // New boundary, same round — MA-0070 boundary latch would allow, the
    // row's own gate refuses: zero spend, refused (once per turn) log.
    cs.activeCreatureName = 'AasimarTest';
    const second = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster, actionName: 'Scorching Sands', action: SANDS, campaignName: 'test-campaign', deps });
    expect(second.spent).toBe(false);
    expect(second.reason).toBe('cooldown');
    expect(store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(logs.some(e => e.automationType === 'scorching_sands_refused (once per turn)')).toBe(true);

    // Other legendary rows are unaffected by Scorching Sands' cooldown.
    cs.activeCreatureName = 'HexWarlock';
    const other = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster, actionName: 'Blazing Light', action: BRASS.legendary_actions.find(a => a.name === 'Blazing Light'), campaignName: 'test-campaign', deps });
    expect(other.spent).toBe(true);
    expect(store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });

    // Monster's own turn-start regain clears the cooldown — row re-fires.
    cs.activeCreatureName = 'Adult Brass Dragon 1';
    const regain = await regainLegendaryUses({ monsterName: 'Adult Brass Dragon 1', campaignName: 'test-campaign', deps });
    expect(regain.regained).toBe(true);
    expect(store['Adult Brass Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toBeNull();
    cs.activeCreatureName = 'AberrantSorcerer';
    const third = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster, actionName: 'Scorching Sands', action: SANDS, campaignName: 'test-campaign', deps });
    expect(third.spent).toBe(true);
  });

  it('rows without the clause stamp no cooldown (byte-inert legacy semantics)', async () => {
    cs = { round: 1, activeCreatureName: 'Thug 1' };
    const pounce = BRASS.legendary_actions.find(a => a.name === 'Pounce');
    const first = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster: brassMonster(), actionName: 'Pounce', action: pounce, campaignName: 'test-campaign', deps });
    expect(first.spent).toBe(true);
    expect(store['Adult Brass Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toBeUndefined();
    cs.activeCreatureName = 'AasimarTest';
    const second = await expendLegendaryUse({ monsterName: 'Adult Brass Dragon 1', monster: brassMonster(), actionName: 'Pounce', action: pounce, campaignName: 'test-campaign', deps });
    expect(second.spent).toBe(true);
  });

  it('cooldown-only clear at turn-start with no uses spent: no spurious writes', async () => {
    cs = { round: 2, activeCreatureName: 'Adult Brass Dragon 1' };
    const r = await regainLegendaryUses({ monsterName: 'Nobody Dragon 1', campaignName: 'test-campaign', deps });
    expect(r).toEqual({ regained: false });
    expect(deps.setRuntimeValue.mock.calls.some(c => String(c[1]).includes(MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY))).toBe(false);
  });
});

// MA-0145: Adult White Dragon — data-only header fix (MA-0136 silver shape).
// Header authors uses:3 (4-in-lair advisory), Freezing Burst/Frightful
// Presence numerics untouched but now budget-gated with the MA-0073
// per-action cooldown clause, Pounce delegates_to the +11 Rend row.
describe('MA-0145 Adult White Dragon legendary economy (header uses:3)', () => {
  const white = monstersData.find(m => m.index === 'adult-white-dragon');
  const pounce = white.legendary_actions.find(a => a.name === 'Pounce');
  const rend = white.actions.find(a => a.name === 'Rend');
  const freezing = white.legendary_actions.find(a => a.name === 'Freezing Burst');
  const frightful = white.legendary_actions.find(a => a.name === 'Frightful Presence');

  it('header authors uses:3 + lair advisory; max resolves to 3 (gate engages)', () => {
    const header = legendaryHeaderAction(white);
    expect(header?.uses).toBe(3);
    expect(header?.description).toMatch(/lair.*advisory/i);
    expect(legendaryMaxUses(header, {})).toBe(3);
  });

  it('Freezing Burst/Frightful Presence numerics untouched; cooldown clause live', () => {
    expect(freezing.save_dc).toBe(14);
    expect(freezing.save_type).toBe('Constitution');
    expect(freezing.damage_dice_primary).toBe('2d6');
    expect(frightful.save_dc).toBe(14);
    expect(frightful.save_type).toBe('Charisma');
    expect(hasLegendaryCooldownClause(freezing)).toBe(true);
    expect(hasLegendaryCooldownClause(frightful)).toBe(true);
  });

  it('Pounce delegates_to the +11 Rend row with the verbatim advisory movement clause', () => {
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.attack_bonus == null && pounce.save_dc == null && pounce.uses == null).toBe(true);
    expect(pounce.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(legendaryDelegateAction(white, pounce)).toBe(rend);
    expect(legendaryDelegateAttackName(pounce, rend)).toBe('Pounce (Rend attack)');
  });

  it('economy is live: spend 3→2, turn latch, per-action cooldown refusal, exhaustion, turn-start regain', async () => {
    const first = await expendLegendaryUse({ monsterName: 'Adult White Dragon 1', monster: white, actionName: 'Freezing Burst', action: freezing, campaignName: 'test-campaign', deps });
    expect(first).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Adult White Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(store['Adult White Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toMatchObject({ freezing_burst: { round: 1 } });

    const sameTurn = await expendLegendaryUse({ monsterName: 'Adult White Dragon 1', monster: white, actionName: 'Freezing Burst', action: freezing, campaignName: 'test-campaign', deps });
    expect(sameTurn.spent).toBe(false);
    expect(sameTurn.reason).toBe('turn');

    cs.activeCreatureName = 'AasimarTest';
    const cooldown = await expendLegendaryUse({ monsterName: 'Adult White Dragon 1', monster: white, actionName: 'Freezing Burst', action: freezing, campaignName: 'test-campaign', deps });
    expect(cooldown.reason).toBe('cooldown');
    expect(store['Adult White Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(logs.some(e => e.automationType === 'freezing_burst_refused (once per turn)')).toBe(true);

    cs.activeCreatureName = 'HexWarlock';
    const fp = await expendLegendaryUse({ monsterName: 'Adult White Dragon 1', monster: white, actionName: 'Frightful Presence', action: frightful, campaignName: 'test-campaign', deps });
    expect(fp).toEqual({ spent: true, remaining: 1, max: 3 });
    cs.activeCreatureName = 'ElderPaladin';
    const pounceSpend = await expendLegendaryUse({ monsterName: 'Adult White Dragon 1', monster: white, actionName: legendaryDelegateAttackName(pounce, rend), action: pounce, campaignName: 'test-campaign', deps });
    expect(pounceSpend).toEqual({ spent: true, remaining: 0, max: 3 });

    cs.activeCreatureName = 'LightfootHalfling';
    const exhausted = await expendLegendaryUse({ monsterName: 'Adult White Dragon 1', monster: white, actionName: 'Freezing Burst', action: freezing, campaignName: 'test-campaign', deps });
    expect(exhausted.reason).toBe('exhausted');
    expect(store['Adult White Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });

    cs.activeCreatureName = 'Adult White Dragon 1';
    const regain = await regainLegendaryUses({ monsterName: 'Adult White Dragon 1', campaignName: 'test-campaign', deps });
    expect(regain).toEqual({ regained: true, max: 3 });
    expect(store['Adult White Dragon 1.monsterLegendaryUses'].used).toBe(0);
    expect(store['Adult White Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toBeNull();
  });
});

// MA-0161: Ancient Black Dragon — data-only header fix (MA-0145 white shape).
// Header authors uses:3 (4-in-lair advisory), Cloud of Insects numerics
// untouched but now budget-gated with the MA-0073 per-action cooldown
// clause; MA-0163 authored the FP save-cast shape; MA-0164 delegates Pounce.
describe('MA-0161 Ancient Black Dragon legendary economy (header uses:3)', () => {
  const ancient = monstersData.find(m => m.index === 'ancient-black-dragon');
  const cloud = ancient.legendary_actions.find(a => a.name === 'Cloud of Insects');
  const frightful = ancient.legendary_actions.find(a => a.name === 'Frightful Presence');
  const pounce = ancient.legendary_actions.find(a => a.name === 'Pounce');
  const rend = ancient.actions.find(a => a.name === 'Rend');

  it('header authors uses:3 + lair advisory; max resolves to 3 (gate engages)', () => {
    const header = legendaryHeaderAction(ancient);
    expect(header?.uses).toBe(3);
    expect(header?.description).toMatch(/lair.*advisory/i);
    expect(legendaryMaxUses(header, {})).toBe(3);
  });

  it('Cloud of Insects numerics untouched; cooldown clause live', () => {
    expect(cloud.save_dc).toBe(21);
    expect(cloud.save_type).toBe('Dexterity');
    expect(cloud.damage_dice_primary).toBe('6d10');
    expect(cloud.damage_type_primary).toBe('Poison');
    expect(hasLegendaryCooldownClause(cloud)).toBe(true);
  });

  it('FP row MA-0163 save-cast shape; MA-0164 Pounce delegates_to the +15 Rend row with the verbatim advisory movement clause', () => {
    expect(frightful.save_dc).toBe(21);
    expect(frightful.save_type).toBe('Wisdom');
    expect(frightful.repeat_save?.save_type).toBe('Wisdom');
    expect(frightful.delegates_to == null && frightful.uses == null).toBe(true);
    expect(frightful.description).toMatch(/can't take this action again until the start of its next turn/);
    expect(hasLegendaryCooldownClause(frightful)).toBe(true);
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.attack_bonus == null && pounce.save_dc == null && pounce.uses == null).toBe(true);
    expect(pounce.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(legendaryDelegateAction(ancient, pounce)).toBe(rend);
    expect(legendaryDelegateAttackName(pounce, rend)).toBe('Pounce (Rend attack)');
  });

  it('economy is live: Cloud spend 3→2, turn latch, cooldown refusal, exhaustion, turn-start regain', async () => {
    const first = await expendLegendaryUse({ monsterName: 'Ancient Black Dragon 1', monster: ancient, actionName: 'Cloud of Insects', action: cloud, campaignName: 'test-campaign', deps });
    expect(first).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(store['Ancient Black Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toMatchObject({ cloud_of_insects: { round: 1 } });

    const sameTurn = await expendLegendaryUse({ monsterName: 'Ancient Black Dragon 1', monster: ancient, actionName: 'Cloud of Insects', action: cloud, campaignName: 'test-campaign', deps });
    expect(sameTurn.spent).toBe(false);
    expect(sameTurn.reason).toBe('turn');

    cs.activeCreatureName = 'AasimarTest';
    const cooldown = await expendLegendaryUse({ monsterName: 'Ancient Black Dragon 1', monster: ancient, actionName: 'Cloud of Insects', action: cloud, campaignName: 'test-campaign', deps });
    expect(cooldown.reason).toBe('cooldown');
    expect(store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(logs.some(e => e.automationType === 'cloud_of_insects_refused (once per turn)')).toBe(true);

    cs.activeCreatureName = 'HexWarlock';
    const fp = await expendLegendaryUse({ monsterName: 'Ancient Black Dragon 1', monster: ancient, actionName: 'Frightful Presence', action: frightful, campaignName: 'test-campaign', deps });
    expect(fp).toEqual({ spent: true, remaining: 1, max: 3 });
    cs.activeCreatureName = 'ElderPaladin';
    const pounceSpend = await expendLegendaryUse({ monsterName: 'Ancient Black Dragon 1', monster: ancient, actionName: legendaryDelegateAttackName(pounce, rend), action: pounce, campaignName: 'test-campaign', deps });
    expect(pounceSpend).toEqual({ spent: true, remaining: 0, max: 3 });

    cs.activeCreatureName = 'LightfootHalfling';
    const exhausted = await expendLegendaryUse({ monsterName: 'Ancient Black Dragon 1', monster: ancient, actionName: 'Cloud of Insects', action: cloud, campaignName: 'test-campaign', deps });
    expect(exhausted.reason).toBe('exhausted');
    expect(store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });

    cs.activeCreatureName = 'Ancient Black Dragon 1';
    const regain = await regainLegendaryUses({ monsterName: 'Ancient Black Dragon 1', campaignName: 'test-campaign', deps });
    expect(regain).toEqual({ regained: true, max: 3 });
    expect(store['Ancient Black Dragon 1.monsterLegendaryUses'].used).toBe(0);
    expect(store['Ancient Black Dragon 1.' + MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY]).toBeNull();
  });
});
