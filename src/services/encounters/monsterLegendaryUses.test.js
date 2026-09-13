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
