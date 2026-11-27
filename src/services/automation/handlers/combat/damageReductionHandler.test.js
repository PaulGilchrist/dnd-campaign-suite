// @maintained-by-ai 2026-11-27
// damageReductionHandler — EQUIPMENT GATE lane of the damageReduction quint.
// Owns equipmentRefusal / hasShield / hasShieldOrWeapon (handle() runs this gate
// before every other branch). The lane map (handle() flow in damageReductionHandler.js):
//   - THIS FILE: shield / shield-or-weapon refusals + pass-through, requirement priority,
//     hasShield/hasShieldOrWeapon magic-item ('+1') base-name catalog resolution and
//     non-string equipped-item guard.
//   - zero_on_success effect (Intervene Shield)                 -> damageReductionHandler.zero-on-success.test.js
//   - 'falling' trigger gate + reaction round latch (Slow Fall) -> damageReductionHandler.slow-fall.test.js
//   - flat/typed reduction, matchesTrigger, deflect heal/log/popup -> damageReductionHandler.normal.test.js
//   - damage-reduced-to-0 redirect modal (redirect / executeRedirect / getMonkLevel) -> damageReductionHandler.redirect.test.js
// Gate evidence only: refusals pin the full refusal-popup shape + a zero-spend census of
// every downstream collaborator; pass-throughs only prove execution reached findLastAttack
// without a refusal — downstream popup composition is normal's canon. Turn-based only; no
// game timers.

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
import * as diceRoller from '../../../dice/diceRoller.js';
import * as logService from '../../../ui/logService.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

const SHIELD_MSG =
  'Defensive Reaction: You must be holding a Shield to use this Reaction.';
const SHIELD_OR_WEAPON_MSG =
  'Defensive Reaction: You must be holding a Shield or a Simple or Martial weapon to use this Reaction.';

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

// Every collaborator the gate must short-circuit before touching.
const downstreamMocks = [
  ['findLastAttack', damageRollback.findLastAttack],
  ['evaluateAutoExpression', automationService.evaluateAutoExpression],
  ['rollExpression', diceRoller.rollExpression],
  ['getCombatContext', damageUtils.getCombatContext],
  ['applyHealingToTarget', applyHealing.applyHealingToTarget],
  ['addEntry', logService.addEntry],
];

// ── Tests ──────────────────────────────────────────────────────

describe('damageReductionHandler — equipment gates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    armGateDownstream();
  });

  // ── Refusals (equipment-lane popup composition is owned here) ──

  const refusalRows = [
    [
      'requiresShield refuses when nothing is equipped',
      { inventory: { equipped: [] } },
      { requiresShield: true, reductionExpression: '2d6' },
      SHIELD_MSG,
    ],
    [
      'requiresShieldOrWeapon refuses when only armour is equipped',
      {
        inventory: { equipped: ['Leather Armor'] },
        equipment: [{ name: 'Leather Armor', armor_category: 'Light Armor' }],
      },
      { requiresShieldOrWeapon: true, reductionExpression: '2d6' },
      SHIELD_OR_WEAPON_MSG,
    ],
    [
      "requiresShield refuses a magic '+1 Shield' whose base name is missing from the equipment catalog",
      { inventory: { equipped: ['+1 Shield'] }, equipment: [] },
      { requiresShield: true, reductionExpression: '2d6' },
      SHIELD_MSG,
    ],
    [
      "requiresShieldOrWeapon refuses a magic '+1 Longsword' whose base name is missing from the equipment catalog",
      { inventory: { equipped: ['+1 Longsword'] }, equipment: [] },
      { requiresShieldOrWeapon: true, reductionExpression: '2d6' },
      SHIELD_OR_WEAPON_MSG,
    ],
  ];

  it.each(refusalRows)('%s', async (_name, statsOverrides, automation, expectedDescription) => {
    const ps = makePlayerStats(statsOverrides);
    const action = makeAction(automation);

    const result = await handle(action, ps, campaignName, null);

    // Full refusal-popup shape owned by this lane.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: action.name,
        automationType: 'damage_reduction',
        description: expectedDescription,
        automation: action.automation,
      },
    });
    // Gate short-circuits: zero spend on every downstream collaborator.
    for (const [label, mock] of downstreamMocks) {
      expect(mock.mock.calls, label).toEqual([]);
    }
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

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: action.name,
        automationType: 'damage_reduction',
        description: SHIELD_MSG,
        automation: action.automation,
      },
    });
    expect(damageRollback.findLastAttack.mock.calls).toEqual([]);
  });

  // ── Pass-through: gate evidence only (reached findLastAttack, no refusal) ──

  const passThroughRows = [
    [
      'requiresShield passes when a shield is equipped',
      { equipped: ['Shield'] },
      [{ name: 'Shield', armor_category: 'Shield' }],
      { requiresShield: true },
    ],
    [
      'requiresShieldOrWeapon passes when a weapon is equipped (weapon branch)',
      { equipped: ['Longsword'] },
      [{ name: 'Longsword', equipment_category: 'Weapon' }],
      { requiresShieldOrWeapon: true },
    ],
    [
      'requiresShieldOrWeapon passes when a shield is equipped (shield branch of the OR)',
      { equipped: ['Shield'] },
      [{ name: 'Shield', armor_category: 'Shield' }],
      { requiresShieldOrWeapon: true },
    ],
    [
      "hasShield resolves a magic '+1 Shield' to its base equipment entry",
      { equipped: ['+1 Shield'] },
      [{ name: 'Shield', armor_category: 'Shield' }],
      { requiresShield: true },
    ],
    [
      "hasShield reads a malformed '+ Shield' via the shared fix#201 parser — no 'hield' corruption (old local substring(3) parser yielded a catalog miss and refusal)",
      { equipped: ['+ Shield'] },
      [{ name: 'Shield', armor_category: 'Shield' }],
      { requiresShield: true },
    ],
    [
      'hasShield ignores non-string equipped entries but still recognises the shield',
      { equipped: [null, 42, 'Shield'] },
      [{ name: 'Shield', armor_category: 'Shield' }],
      { requiresShield: true },
    ],
    [
      'gate is inert when neither requirement flag is set',
      { equipped: [] },
      [],
      {},
    ],
  ];

  it.each(passThroughRows)(
    '%s',
    async (_name, inventory, equipment, automationOverrides) => {
      const ps = makePlayerStats({ inventory, equipment });
      const action = makeAction({ ...automationOverrides, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('must be holding');
      expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
    }
  );
});
