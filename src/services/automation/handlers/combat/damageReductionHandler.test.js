// @maintained-by-ai
// damageReductionHandler — EQUIPMENT GATE lane of the damageReduction quint.
// Owns equipmentRefusal / hasShield / hasShieldOrWeapon (handle() runs this gate
// before every other branch). The lane map (handle() flow in damageReductionHandler.js):
//   - THIS FILE: shield / shield-or-weapon refusals + pass-through, requirement priority,
//     hasShield magic-item ('+1') base-name resolution and non-string equipped-item guard.
//   - zero_on_success effect (Intervene Shield)                 -> damageReductionHandler.zero-on-success.test.js
//   - 'falling' trigger gate + reaction round latch (Slow Fall) -> damageReductionHandler.slow-fall.test.js
//   - flat/typed reduction, matchesTrigger, deflect heal/log/popup -> damageReductionHandler.normal.test.js
//   - damage-reduced-to-0 redirect modal (redirect / executeRedirect / getMonkLevel) -> damageReductionHandler.redirect.test.js
// Gate evidence only: refusals pin the refusal popup shape + short-circuit; pass-throughs
// only prove execution reached findLastAttack without a refusal — downstream popup
// composition is normal's canon. Turn-based only; no game timers.

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
import * as automationService from '../../../combat/automation/automationService.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Defensive Reaction',
    automation: {
      type: 'damage_reduction',
      ...automation,
    },
  };
}

// A valid lastAttack so a passed gate proceeds (rather than hitting the
// "No recent attack found" refusal) — enough to reach findLastAttack evidence.
function armGateDownstream() {
  automationService.evaluateAutoExpression.mockReturnValue(5);
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: { targetName: 'TestHero' },
    targetName: 'TestHero',
    totalDamage: 10,
    damageTypes: ['Slashing'],
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageReductionHandler — equipment gates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    armGateDownstream();
  });

  // ── Refusals (equipment-lane popup composition is owned here) ──

  describe('refusals', () => {
    it('requiresShield: refuses when no shield is equipped', async () => {
      const ps = makePlayerStats({ inventory: { equipped: [] } });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload).toMatchObject({
        type: 'automation_info',
        name: action.name,
        automationType: 'damage_reduction',
        automation: action.automation,
      });
      expect(result.payload.description).toBe(
        'Defensive Reaction: You must be holding a Shield to use this Reaction.',
      );
      // Gate short-circuits before any downstream work.
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    });

    it('requiresShieldOrWeapon: refuses when neither a shield nor a weapon is equipped', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Leather Armor'] },
        equipment: [{ name: 'Leather Armor', armor_category: 'Light Armor' }],
      });
      const action = makeAction({ requiresShieldOrWeapon: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload).toMatchObject({
        type: 'automation_info',
        name: action.name,
        automationType: 'damage_reduction',
        automation: action.automation,
      });
      expect(result.payload.description).toBe(
        'Defensive Reaction: You must be holding a Shield or a Simple or Martial weapon to use this Reaction.',
      );
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    });

    it('requiresShield outranks requiresShieldOrWeapon when both are set and only a weapon is equipped', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Longsword'] },
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon' }],
      });
      const action = makeAction({
        requiresShield: true,
        requiresShieldOrWeapon: true,
        reductionExpression: '2d6',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.automation).toBe(action.automation);
      expect(result.payload.automationType).toBe('damage_reduction');
      expect(result.payload.description).toBe(
        'Defensive Reaction: You must be holding a Shield to use this Reaction.',
      );
      expect(result.payload.description).not.toContain('Shield or a Simple or Martial weapon');
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
    });
  });

  // ── Pass-through: gate evidence only (reached findLastAttack, no refusal) ──

  describe('pass-through', () => {
    it('requiresShield: passes when a shield is equipped', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('must be holding');
      expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
    });

    it('requiresShieldOrWeapon: passes when a weapon is equipped', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Longsword'] },
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon' }],
      });
      const action = makeAction({ requiresShieldOrWeapon: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('must be holding');
      expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
    });

    it('requiresShieldOrWeapon: passes when a shield is equipped (satisfies the OR)', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShieldOrWeapon: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('must be holding');
      expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
    });

    it('hasShield: resolves a magic "+1 Shield" to its base equipment entry', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['+1 Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('must be holding');
      expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
    });

    it('hasShield: ignores non-string equipped entries but still recognises the shield', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: [null, 42, 'Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('must be holding');
      expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
    });

    it('gate is inert when neither requirement flag is set', async () => {
      const ps = makePlayerStats({ inventory: { equipped: [] } });
      const action = makeAction({ reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('must be holding');
      expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
    });
  });
});
