// @maintained-by-ai
// damageReductionHandler — ZERO-ON-SUCCESS (Intervene Shield) lane of the damageReduction quint.
// Owns handle() dispatch into handleZeroOnSuccess, the handleZeroOnSuccess-internal shield
// gate, the interveneShieldTriggerRefusal gate table, the floor(rawDamage/2) heal maths, and
// the ability_use + hp_change log composition. Lane map (handle() flow in damageReductionHandler.js):
//   - equipment gates (requiresShield / requiresShieldOrWeapon, hasShield internals) -> damageReductionHandler.test.js
//   - 'falling' trigger gate + reaction round latch (Slow Fall) -> damageReductionHandler.slow-fall.test.js
//   - flat/typed reduction, matchesTrigger, deflect heal/log/popup -> damageReductionHandler.normal.test.js
//   - damage-reduced-to-0 redirect modal (redirect / executeRedirect / getMonkLevel) -> damageReductionHandler.redirect.test.js
// The internal shield gate is pinned WITHOUT the requiresShield flag so the outer equipment
// gate stays inert (its inertness is main's canon) — the refusal proves the inner gate fired.
// Turn-based only; no game timers.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
  resolveDiceExpression: vi.fn((expr) => expr),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './damageReductionHandler.js';
import * as logService from '../../../ui/logService.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makeAction(automation = {}) {
  return {
    name: 'Defensive Reaction',
    automation: {
      type: 'damage_reduction',
      effect: 'zero_on_success',
      ...automation,
    },
  };
}

// PlayerStats that satisfy handleZeroOnSuccess's internal shield gate.
function shieldHolder(overrides = {}) {
  return {
    name: 'TestHero',
    inventory: { equipped: ['Shield'] },
    equipment: [{ name: 'Shield', armor_category: 'Shield' }],
    ...overrides,
  };
}

// A lastAttack attackEvent that passes every interveneShieldTriggerRefusal gate.
// Overrides MERGE onto the valid default, so each row invalidates one field.
function validSaveEvent(overrides = {}) {
  return {
    rollType: 'save',
    targetName: 'TestHero',
    saveType: 'DEX',
    saveResult: 'success',
    rawDamage: 10,
    attackerName: 'Goblin',
    ...overrides,
  };
}

function armSave(overrides) {
  damageRollback.findLastAttack.mockResolvedValue({ attackEvent: validSaveEvent(overrides) });
}

// Refusal popups carry no automationType — only handleZeroOnSuccess's inner gate omits it,
// so this distinguishes inner-gate refusals from the outer equipmentRefusal shape.
function expectRefusal(result, description) {
  expect(result.type).toBe('popup');
  expect(result.payload.type).toBe('automation_info');
  expect(result.payload.name).toBe('Defensive Reaction');
  expect(result.payload.description).toBe(description);
  expect(logService.addEntry).not.toHaveBeenCalled();
  expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
}

function loggedEntries(type) {
  return logService.addEntry.mock.calls.map(([, entry]) => entry).filter(e => e.type === type);
}

function setupMocks() {
  logService.addEntry.mockResolvedValue({});
  damageRollback.findLastAttack.mockResolvedValue({ attackEvent: validSaveEvent() });
  damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
  // Pass-through heal: whatever amount reaches the heal is what comes back, so pins
  // exercise the real floor(rawDamage / 2) arithmetic rather than a fixed mock number.
  applyHealing.applyHealingToTarget.mockImplementation((_cs, _name, amount) =>
    Promise.resolve({ actualHeal: amount }),
  );
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageReductionHandler — zero_on_success (Intervene Shield)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  describe('internal shield gate', () => {
    it('refuses without a shield, before findLastAttack or any log', async () => {
      // No requiresShield flag: the outer equipmentRefusal is inert, so this refusal can
      // only have come from handleZeroOnSuccess's own hasShield check.
      const ps = shieldHolder({ inventory: { equipped: [] }, equipment: [] });

      const result = await handle(makeAction(), ps, campaignName, null);

      expectRefusal(result, 'Defensive Reaction: You must be holding a Shield to use this Reaction.');
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
    });
  });

  describe('interveneShieldTriggerRefusal gate table', () => {
    const rows = [
      ['no lastAttack event', null, 'No recent attack or saving throw found.'],
      ['not a saving throw', { rollType: 'attack' }, 'The last roll was not a saving throw.'],
      ['holder not the target', { targetName: 'Ally' }, 'You were not the target of the last saving throw.'],
      ['not a DEX save', { saveType: 'CON' }, 'The last saving throw was not a Dexterity save.'],
      ['save did not succeed', { saveResult: 'failure' }, 'The last saving throw did not succeed.'],
      ['no damage dealt', { rawDamage: 0 }, 'No damage was dealt by the last attack.'],
    ];

    it.each(rows)('refuses when %s', async (_name, override, message) => {
      damageRollback.findLastAttack.mockResolvedValue(
        override === null ? { attackEvent: null } : { attackEvent: validSaveEvent(override) },
      );

      const result = await handle(makeAction(), shieldHolder(), campaignName, null);

      expectRefusal(result, `Defensive Reaction: ${message}`);
    });

    it('first failing gate wins when several conditions fail', async () => {
      armSave({ rollType: 'attack', targetName: 'Ally', saveType: 'CON' });

      const result = await handle(makeAction(), shieldHolder(), campaignName, null);

      expect(result.payload.description).toBe('Defensive Reaction: The last roll was not a saving throw.');
    });
  });

  describe('heal and logging', () => {
    it('heals half rawDamage and logs ability_use plus hp_change', async () => {
      const ps = shieldHolder({ computedStats: { currentHp: 20, maxHp: 50 } });
      armSave({ rawDamage: 20 });

      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.automationType).toBe('damage_reduction');
      expect(result.payload.description).toBe('Defensive Reaction: You interpose your shield and heal for 10 HP!');
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'TestHero',
        10,
        campaignName,
      );
      expect(loggedEntries('ability_use')).toEqual([
        expect.objectContaining({
          characterName: 'TestHero',
          abilityName: 'Defensive Reaction',
          description: "TestHero used Intervene Shield to heal for 10 HP after a successful Dexterity save against Goblin's attack.",
        }),
      ]);
      expect(loggedEntries('hp_change')).toEqual([
        expect.objectContaining({
          targetName: 'TestHero',
          delta: 10,
          currentHp: 20,
          maxHp: 50,
          isHealing: true,
          abilityName: 'Defensive Reaction',
        }),
      ]);
    });

    it('floors odd rawDamage', async () => {
      armSave({ rawDamage: 11 });

      const result = await handle(makeAction(), shieldHolder(), campaignName, null);

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'TestHero',
        5,
        campaignName,
      );
      expect(result.payload.description).toBe('Defensive Reaction: You interpose your shield and heal for 5 HP!');
    });

    it('uses primaryDamage fallback through the damage gate and the heal', async () => {
      armSave({ rawDamage: 0, primaryDamage: 16 });

      const result = await handle(makeAction(), shieldHolder(), campaignName, null);

      expect(result.payload.description).toBe('Defensive Reaction: You interpose your shield and heal for 8 HP!');
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'TestHero',
        8,
        campaignName,
      );
    });

    it('does not heal without a combat context but still logs the ability_use', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), shieldHolder(), campaignName, null);

      expect(result.payload.description).toBe('Defensive Reaction: You interpose your shield and heal for 0 HP!');
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
      expect(loggedEntries('hp_change')).toHaveLength(0);
      expect(loggedEntries('ability_use')).toHaveLength(1);
    });

    it('does not throw when addEntry rejects (both log writes are caught)', async () => {
      logService.addEntry.mockRejectedValue(new Error('log save failed'));

      const result = await handle(makeAction(), shieldHolder(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(logService.addEntry).toHaveBeenCalledTimes(2);
    });
  });
});
