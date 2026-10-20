// @maintained-by-ai
// Silence guard lane: applySilenceThunderImmunity (applyDamage.js:291-303),
// logSilenceImmunity (:332-340) and its log gate (:795-797). Generic immunity
// arithmetic is owned by applyDamage.helpers.test.js:53-86 — full-damage values
// appear here only as falsifier evidence that the guard did NOT arm (#1187).
// Zone membership geometry is owned by silenceService.test.js; the zone verdict is
// an explicit boolean input at this seam.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

// rangeValidation: live via wardingBondService in this lane's graph — kept inert.
vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

// The zone verdict itself is silenceService.test.js's contract — at this seam it
// is a boolean input into the guard.
vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(),
}));

vi.mock('../../combat/automation/automationPassives.js', () => ({
  getDamageReduction: vi.fn(() => null),
  getDamageResistances: vi.fn(() => []),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Fire-and-forget network legs in the import graph must never hit the wire here;
// never-resolving keeps any un-awaited call inert.
global.fetch = vi.fn(() => new Promise(() => {}));

// ── Imports ─────────────────────────────────────────────────────

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { isCreatureInSilenceZone } from '../../rules/features/silenceService.js';

// ── Helpers ─────────────────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';

// Store-faithful keyed stub (#1057): map keys are `${target}.${runtimeKey}`;
// every unstubbed read returns undefined (each consumer guards it), so the stub
// is independent of source call order.
function stubRuntime(map = {}) {
  getRuntimeValue.mockImplementation((target, key) => map[`${target}.${key}`]);
}

// Verbatim production Silence buff shape (SilenceModal.jsx:76-81).
function silenceBuff(sourceCharacter = 'Bard') {
  return { name: 'Silence', effect: 'silence', duration: 'concentration', sourceCharacter };
}

function playerCreature(name, currentHp) {
  return {
    name,
    type: 'player',
    maxHp: currentHp,
    currentHp,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
  };
}

function monsterCreature(name, currentHp) {
  return { ...playerCreature(name, currentHp), type: 'monster', template: [] };
}

function minimalCharacter(name) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
    },
  };
}

function apply(creature, rawDamage, damageTypes, characters = []) {
  return applyDamageToTarget(
    { round: 1, creatures: [creature] },
    creature.name,
    rawDamage,
    damageTypes,
    { campaignName: CAMPAIGN, characters },
  );
}

// Only logSilenceImmunity stamps name:'Silence' at this lane — the automation
// immunity record, isolated from hp_change/other logs.
const silenceLogs = () => addEntry.mock.calls.filter(([, entry]) => entry?.name === 'Silence');

beforeEach(() => {
  addEntry.mockClear();
  isCreatureInSilenceZone.mockReset();
});

// old -> new map (5 -> 3):
// - player armed thunder -> T1 leg A (+ immunity log fired, delta-0 hp_change suppressed)
// - thunder immunity does not affect other damage types -> T1 leg B (same armed zone,
//   fire passes full + silence log absent; old test asserted only finalDamage)
// - NPC armed thunder (SP-106) -> T2 (exact golden log bytes, summary object untouched)
// - three "does not arm" falsifiers (zone false / no sourceCharacter / no buff) -> T3,
//   zone forced TRUE on legs b/c so the short-circuit is the guard's, not the zone's

describe('Silence guard — Thunder immunity at the applyDamage seam', () => {
  it('player inside the zone: Thunder is negated and logged; other types still land in full', async () => {
    isCreatureInSilenceZone.mockReturnValue(true);
    stubRuntime({
      'Wizard.activeBuffs': [silenceBuff()],
      'Wizard.currentHitPoints': 20,
    });
    const wizard = playerCreature('Wizard', 20);

    const thunder = await apply(wizard, 10, ['Thunder'], [minimalCharacter('Wizard')]);

    expect(isCreatureInSilenceZone).toHaveBeenCalledWith('Wizard', 'Bard', CAMPAIGN);
    expect(thunder.finalDamage).toBe(0);
    expect(thunder.damageReduced).toBe(true);
    expect(thunder.newHp).toBe(20);

    const logs = silenceLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0][1].description).toContain('immune to Thunder');
    expect(logs[0][1].description).toContain('10 damage negated');
    // fully negated hit: delta === 0 suppresses the hp_change log (:1200) —
    // the Silence automation entry is the sole record of the hit.
    expect(addEntry.mock.calls.filter(([, e]) => e?.type === 'hp_change')).toHaveLength(0);

    // Thunder-only: Fire in the same armed zone passes through unguarded.
    addEntry.mockClear();
    const fire = await apply(wizard, 10, ['Fire'], [minimalCharacter('Wizard')]);

    expect(fire.finalDamage).toBe(10);
    expect(fire.newHp).toBe(10);
    expect(silenceLogs()).toHaveLength(0);
  });

  it('SP-106: monster inside the zone takes 0 Thunder, HP untouched, golden immunity log', async () => {
    isCreatureInSilenceZone.mockReturnValue(true);
    stubRuntime({
      'Thug 1.activeBuffs': [silenceBuff('Divine_Cleric')],
    });
    const thug = monsterCreature('Thug 1', 32);

    const result = await apply(thug, 9, ['Thunder']);

    expect(isCreatureInSilenceZone).toHaveBeenCalledWith('Thug 1', 'Divine_Cleric', CAMPAIGN);
    expect(result.finalDamage).toBe(0);
    expect(result.newHp).toBe(32);
    expect(thug.currentHp).toBe(32);
    // guard folds Thunder into a LOCAL immunities list — the combat-summary
    // creature object is never mutated.
    expect(thug.immunities).toEqual([]);

    const logs = silenceLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0][1].description).toBe(
      'Thug 1 is immune to Thunder damage inside the Silence zone — 9 damage negated.'
    );
  });

  it('guard stays silent when the zone cannot be verified: outside zone, no source, no silence buff', async () => {
    // a) buff + source present, zone FALSE → full damage lands, no immunity log
    isCreatureInSilenceZone.mockReturnValue(false);
    stubRuntime({
      'Wizard.activeBuffs': [silenceBuff()],
      'Wizard.currentHitPoints': 20,
    });
    const wizard = playerCreature('Wizard', 20);

    const outside = await apply(wizard, 9, ['Thunder'], [minimalCharacter('Wizard')]);

    expect(isCreatureInSilenceZone).toHaveBeenCalledWith('Wizard', 'Bard', CAMPAIGN);
    expect(outside.finalDamage).toBe(9);
    expect(outside.newHp).toBe(11);
    expect(silenceLogs()).toHaveLength(0);

    // b) Silence buff WITHOUT sourceCharacter → guard short-circuits BEFORE the
    // zone check; zone is forced TRUE so the silence is provably the guard's own.
    isCreatureInSilenceZone.mockClear().mockReturnValue(true);
    addEntry.mockClear();
    stubRuntime({
      // verbatim shape minus sourceCharacter (the modal always stamps it — this
      // leg proves the guard's :293 sourceCharacter requirement)
      'Thug 1.activeBuffs': [{ name: 'Silence', effect: 'silence', duration: 'concentration' }],
    });
    const thug = monsterCreature('Thug 1', 32);

    const noSource = await apply(thug, 9, ['Thunder']);

    expect(isCreatureInSilenceZone).not.toHaveBeenCalled();
    expect(noSource.finalDamage).toBe(9);
    expect(thug.currentHp).toBe(23);
    expect(silenceLogs()).toHaveLength(0);

    // c) unrelated buff only (effect filter) → zone never consulted, full damage.
    addEntry.mockClear();
    stubRuntime({
      'Cleric.activeBuffs': [{ name: 'Bless', effect: 'bless', sourceCharacter: 'Cleric' }],
      'Cleric.currentHitPoints': 20,
    });
    const cleric = playerCreature('Cleric', 20);

    const noSilence = await apply(cleric, 10, ['Thunder'], [minimalCharacter('Cleric')]);

    expect(isCreatureInSilenceZone).not.toHaveBeenCalled();
    expect(noSilence.finalDamage).toBe(10);
    expect(noSilence.newHp).toBe(10);
    expect(silenceLogs()).toHaveLength(0);
  });
});
