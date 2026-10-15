// @maintained-by-ai: 2026-10-14
//
// SP-110 gateSpareTheDying lane (spellGates.js) + isSpareTheDyingTarget
// (spellGateHelpers.js). Rules checked against spells.json (5e + 2024):
// "You touch a living creature that has 0 hit points... no effect on undead
// or constructs" / "0 Hit Points and isn't dead" (range 15 feet in 2024,
// Touch in 5e). The app keeps the undead/construct exclusion for BOTH
// rulesets (see helper comment in spellGateHelpers.js). Canonical HP truth:
// PCs via the runtime store, monsters via combatSummary currentHp only
// (pitfall 29) — same dying-not-dead dead-state model the revivify gate
// uses for the opposite polarity. Downstream execution lives in the
// spareTheDyingHandler lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

import { tryGateSpell } from './spellGates.js';
import { isSpareTheDyingTarget } from './spellGateHelpers.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';

const CAMPAIGN = 'TestCampaign';
const spell = { name: 'Spare the Dying', level: 0, range: '15 feet', casting_time: 'Action' };

// Default roster: Cleric (caster, alive), two other PCs (runtime stubs),
// Thug 1 (alive), Thug 2 (canonical-dead at 0 HP), plus undead/construct
// dying-modelled as fully eligible — so rejecting them proves exclusion,
// not just the canonical-dead rule.
function defaultCreatures() {
  return {
    creatures: [
      { name: 'Cleric', type: 'player', currentHp: 1, maxHp: 1 },
      { name: 'LightfootHalfling', type: 'player', currentHp: 1, maxHp: 12 },
      { name: 'War_Cleric', type: 'player', currentHp: 1, maxHp: 45 },
      { name: 'Thug 1', type: 'npc', monsterType: 'humanoid', currentHp: 32, maxHp: 32 },
      { name: 'Thug 2', type: 'npc', monsterType: 'humanoid', currentHp: 0, maxHp: 32 },
      { name: 'Zombie 1', type: 'npc', monsterType: 'Undead', currentHp: 0, maxHp: 22, deathSaves: [false, false, false] },
      { name: 'Golem', type: 'npc', monsterType: 'Construct', currentHp: 0, maxHp: 95, deathSaves: [false, false, false] },
    ],
  };
}

function patch(cs, name, changes) {
  Object.assign(cs.creatures.find(c => c.name === name), changes);
  return cs;
}

// Runtime store stand-in: named per-creature key map, null elsewhere.
function runtimeMap(map) {
  return (name, key) => map[name]?.[key] ?? null;
}

function gate({ runtime = {}, setPopupHtml = vi.fn() } = {}) {
  getRuntimeValue.mockImplementation(runtimeMap(runtime));
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('Spare the Dying', CAMPAIGN, cfSetPending, {
    spell,
    playerStats: { name: 'Cleric' },
    setPopupHtml,
  });
  return { handled, cfSetPending, setPopupHtml };
}

describe('SP-110 isSpareTheDyingTarget — canonical 0-HP-not-dead predicate', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { desc: 'accepts a dying PC (runtime 0 HP, not dead, not stable)', target: 'LightfootHalfling', runtime: { LightfootHalfling: { currentHitPoints: 0 } }, expected: true },
    { desc: 'accepts a dying-modelled monster (cs 0 HP + unstable deathSaves)', target: 'Thug 2', mutate: cs => patch(cs, 'Thug 2', { deathSaves: [false, false, false] }), expected: true },
    { desc: 'rejects a healthy PC via runtime currentHitPoints', target: 'War_Cleric', runtime: { War_Cleric: { currentHitPoints: 45 } }, expected: false },
    { desc: 'rejects a dead PC via runtime isDead', target: 'LightfootHalfling', runtime: { LightfootHalfling: { currentHitPoints: 0, isDead: 1 } }, expected: false },
    { desc: 'rejects an already-Stable PC (three death-save successes)', target: 'LightfootHalfling', runtime: { LightfootHalfling: { currentHitPoints: 0, deathSaves: [true, true, true] } }, expected: false },
    { desc: 'rejects a healthy monster via cs.currentHp (never runtime — pitfall 29)', target: 'Thug 1', expected: false },
    { desc: 'rejects a canonical-dead monster (cs 0 HP without deathSaves)', target: 'Thug 2', expected: false },
    { desc: 'rejects a Stable monster (three death-save successes)', target: 'Thug 2', mutate: cs => patch(cs, 'Thug 2', { deathSaves: [true, true, true] }), expected: false },
  ])('$desc', ({ target, runtime, mutate, expected }) => {
    getRuntimeValue.mockImplementation(runtimeMap(runtime));
    expect(isSpareTheDyingTarget(mutate ? mutate(defaultCreatures()) : defaultCreatures(), target)).toBe(expected);
  });

  it('rejects undead and constructs even when dying-modelled', () => {
    const cs = defaultCreatures(); // Zombie 1 + Golem are 0 HP with unstable deathSaves
    expect(isSpareTheDyingTarget(cs, 'Zombie 1')).toBe(false);
    expect(isSpareTheDyingTarget(cs, 'Golem')).toBe(false);
  });
});

describe('SP-110 gateSpareTheDying — dying-target picker gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(defaultCreatures());
  });

  it.each([
    {
      desc: 'offers ONLY the dying PC — healthy PCs, healthy/canonical-dead monsters and undead never appear',
      runtime: { LightfootHalfling: { currentHitPoints: 0 }, War_Cleric: { currentHitPoints: 45 } },
      expected: ['LightfootHalfling'],
    },
    {
      desc: 'lists every dying creature (PCs and dying-modelled monster) in cs order',
      runtime: { LightfootHalfling: { currentHitPoints: 0 }, War_Cleric: { currentHitPoints: 0 } },
      cs: cs => patch(cs, 'Thug 2', { deathSaves: [false, false, false] }),
      expected: ['LightfootHalfling', 'War_Cleric', 'Thug 2'],
    },
  ])('$desc', ({ runtime, cs, expected }) => {
    if (cs) getCombatSummary.mockReturnValue(cs(defaultCreatures()));
    const { handled, cfSetPending } = gate({ runtime });
    expect(handled).toBe(true);
    expect(cfSetPending).toHaveBeenCalledWith('spareTheDying', expect.objectContaining({
      range: '15 feet',
      creatureTargets: expected,
    }));
  });

  it.each([
    {
      desc: 'nobody is at 0 HP',
      cs: { creatures: [{ name: 'Cleric', type: 'player' }, { name: 'AllyPC', type: 'player' }, { name: 'Thug 1', type: 'npc', monsterType: 'humanoid', currentHp: 7 }] },
      runtime: {},
    },
    { desc: 'only the caster is dying (self-target excluded)', cs: null, runtime: { Cleric: { currentHitPoints: 0 } } },
    { desc: 'only undead and constructs are at 0 HP (spells.json exclusion)', cs: null, runtime: {} },
  ])('refuses with an automation_info popup and no picker when $desc', ({ cs, runtime }) => {
    if (cs) getCombatSummary.mockReturnValue(cs);
    const { handled, cfSetPending, setPopupHtml } = gate({ runtime });
    expect(handled).toBe(true);
    expect(cfSetPending).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      automationType: 'spareTheDying',
      description: expect.stringContaining('0 Hit Points'),
    }));
  });
});
