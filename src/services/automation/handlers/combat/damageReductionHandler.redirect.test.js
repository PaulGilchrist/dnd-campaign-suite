// @maintained-by-ai
// damageReductionHandler — REDIRECT lane of the damageReduction quint.
// Lane map (handle() flow in damageReductionHandler.js):
//   - equipment gates (requiresShield / requiresShieldOrWeapon) -> damageReductionHandler.test.js
//   - zero_on_success effect (Intervene Shield)                 -> damageReductionHandler.zero-on-success.test.js
//   - 'falling' trigger gate + reaction round latch (Slow Fall) -> damageReductionHandler.slow-fall.test.js
//   - flat/typed reduction, matchesTrigger, deflect heal logs  -> damageReductionHandler.normal.test.js
//   - THIS FILE: handleRedirect / executeRedirect / redirectSaveDc / getMonkLevel
//     (sole getMonkLevel home in the repo — it is only reachable via redirectSaveDc).
// Full-string pins here own deflectRedirect modal + executeRedirect log composition.
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

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
  computeDamageAfterSave: vi.fn((damage, _success) => damage),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './damageReductionHandler.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as logService from '../../../ui/logService.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

// Monk 5 (+1 Rogue), Dex +2, proficiency +3
// → redirectSaveDc fallback = 8 + 2 + 5 + 3 = 18; martial arts die defaults to 4.
function makeMonkPlayerStats(overrides = {}) {
  return {
    name: 'MonkHero',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Dexterity', bonus: 2 }],
    class: {
      class_levels: [
        { class: 'Monk', name: 'Monk', level: 5 },
        { class: 'Rogue', name: 'Rogue', level: 1 },
      ],
    },
    inventory: { equipped: ['Shield'] },
    equipment: [{ name: 'Shield', armor_category: 'Shield' }],
    computedStats: { currentHp: 30, maxHp: 50 },
    ...overrides,
  };
}

// Redirect automations share a base shape; overrides MERGE, never replace.
function makeRedirectAction(overrides = {}) {
  return {
    name: 'Deflect Attacks',
    automation: {
      type: 'damage_reduction',
      reductionExpression: '2d10',
      redirect: true,
      redirectCost: { amount: 1, resource: 'focus_points' },
      ...overrides,
    },
  };
}

const goblinContext = () => ({
  creatures: [{ name: 'Goblin', type: 'enemy', currentHp: 7, maxHp: 7 }],
});

// Arm the save + damage stack executeRedirect delegates to.
function armRedirectExecution({ success = true, damageOnSave = 10 } = {}) {
  savePrompt.createSaveListener.mockReturnValue({
    promptId: 'test-prompt',
    promise: Promise.resolve({ success }),
  });
  applyDamage.computeDamageAfterSave.mockReturnValue(damageOnSave);
  applyDamage.applyDamageToTarget.mockResolvedValue({});
}

function setupBaseMocks() {
  automationService.evaluateAutoExpression.mockReturnValue(20);
  diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [20] });
  logService.addEntry.mockResolvedValue({});
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: { targetName: 'MonkHero' },
    targetName: 'MonkHero',
    totalDamage: 10,
    damageTypes: ['Slashing'],
  });
  damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
  applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 10 });
  runtimeState.getRuntimeValue.mockReturnValue(3);
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageReductionHandler - redirect flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupBaseMocks();
  });

  describe('redirect when damage reduced to 0 (handleRedirect modal)', () => {
    it('returns deflectRedirect modal with full payload composition', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(goblinContext());

      const result = await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('deflectRedirect');
      expect(result.payload.title).toBe('Deflect Attacks — Redirect Force');
      expect(result.payload.confirmLabel).toBe('Redirect Force');
      expect(result.payload.confirmIcon).toBe('fa-bolt');
      expect(result.payload.description).toBe(
        'You reduced the damage to 0. You expend 1 focus points to redirect the force to a creature.',
      );
    });

    const exprCases = [
      { label: 'default', redirectDamage: undefined, expectedExpr: '2 * 4 + DEX modifier' },
      { label: 'authored redirectDamage', redirectDamage: '2d6 + DEX modifier', expectedExpr: '2d6 + DEX modifier' },
    ];
    for (const ec of exprCases) {
      it(`evaluates ${ec.label} redirect damage expression in executeRedirect`, async () => {
        runtimeState.getRuntimeValue.mockReturnValue(1);
        damageUtils.getCombatContext.mockResolvedValue(goblinContext());
        armRedirectExecution();

        const ps = makeMonkPlayerStats();
        const action = makeRedirectAction({ redirectDamage: ec.redirectDamage });

        const result = await handle(action, ps, campaignName, null);
        await result.payload.onTargetSelected('Goblin');

        expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith(ec.expectedExpr, ps);
      });
    }

    it('uses custom saveDc when provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(goblinContext());
      const ps = makeMonkPlayerStats();

      const result = await handle(makeRedirectAction({ saveDc: 17 }), ps, campaignName, null);

      expect(result.payload.featureDescription).toContain('DC 17');
    });

    it('maps combat creatures to modal targets (enemy HP from context, player HP from runtime)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(3);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'enemy', currentHp: 7, maxHp: 7 },
          { name: 'MonkHero', type: 'player', currentHp: 30, maxHp: 50 },
        ],
      });

      const result = await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);

      expect(result.payload.targets.map(t => t.name)).toEqual(['Goblin', 'MonkHero']);
      expect(result.payload.targets[0].currentHp).toBe(7);
      expect(result.payload.targets[0].maxHp).toBe(7);
      // Player rows take runtime HP, overriding the stale context values.
      expect(result.payload.targets[1].currentHp).toBe(3);
      expect(result.payload.targets[1].maxHp).toBe(3);
    });
  });

  describe('redirect - insufficient focus points', () => {
    it('returns popup and deducts nothing when player lacks required focus points', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const action = makeRedirectAction({ redirectCost: { amount: 2, resource: 'focus_points' } });
      const result = await handle(action, makeMonkPlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Deflect Attacks');
      expect(result.payload.automation).toBe(action.automation);
      expect(result.payload.description).toBe(
        'Deflect Attacks: You need 2 focus points to redirect force. You only have 0.',
      );
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('redirect - no creatures available', () => {
    it('returns popup when combat context has no creatures', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Deflect Attacks: No creatures available to redirect force to.',
      );
    });
  });

  describe('executeRedirect (onTargetSelected)', () => {
    for (const { success, damageOnSave } of [
      { success: false, damageOnSave: 10 },
      { success: true, damageOnSave: 5 },
    ]) {
      it(`computes and applies ${damageOnSave} Force damage when DEX save ${success ? 'succeeds' : 'fails'}`, async () => {
        runtimeState.getRuntimeValue.mockReturnValue(1);
        damageUtils.getCombatContext.mockResolvedValue(goblinContext());
        armRedirectExecution({ success, damageOnSave });

        const result = await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);
        await result.payload.onTargetSelected('Goblin');

        // redirectDamage = 20 (numeric evaluation), delegated to computeDamageAfterSave.
        expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledWith(20, success, null);
        expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
          expect.anything(),
          'Goblin',
          damageOnSave,
          ['Force'],
          { campaignName, characters: expect.anything(), ignoreResistance: false, attackerName: 'MonkHero' },
        );
      });
    }

    it('does not apply damage when damageOnSave is 0', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(goblinContext());
      armRedirectExecution({ success: true, damageOnSave: 0 });

      const result = await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);
      await result.payload.onTargetSelected('Goblin');

      expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledWith(20, true, null);
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('handles null targetName gracefully', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(goblinContext());

      const result = await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);
      await result.payload.onTargetSelected(null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('deducts the focus point cost when the modal opens', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(3);
      damageUtils.getCombatContext.mockResolvedValue(goblinContext());

      await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);

      // Cost is spent when the redirect offer is presented, before target choice.
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'MonkHero',
        'focus_points',
        2,
        campaignName,
      );
    });

    it('creates save listener with computed fallback DC (8 + DEX + monk level + proficiency)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(goblinContext());
      armRedirectExecution();

      const result = await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);
      await result.payload.onTargetSelected('Goblin');

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 18,
        actionName: 'Deflect Attacks',
      });
    });

    it('logs ability_use with exact redirect result description', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(goblinContext());
      armRedirectExecution({ success: false, damageOnSave: 10 });

      const result = await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);
      await result.payload.onTargetSelected('Goblin');

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'MonkHero',
          abilityName: 'Deflect Attacks',
          targetName: 'Goblin',
          description: 'MonkHero redirected force to Goblin. Goblin failed DEX save (DC 18) and took 10 Force damage (2 * 4 + DEX modifier = 20).',
        }),
      );
    });
  });

  describe('redirect - damage calculation (evaluate → roll → apply)', () => {
    const damageCalcTests = [
      { name: 'numeric result', redirectDamage: '12', evaluateResult: 12, rollResult: undefined, expectedDamage: 12 },
      { name: 'dice expression', redirectDamage: '2d6', evaluateResult: '2d6', rollResult: { total: 8, rolls: [3, 5] }, expectedDamage: 8 },
      { name: 'failed dice roll', redirectDamage: '2d6', evaluateResult: '2d6', rollResult: null, expectedDamage: 0 },
    ];

    for (const dct of damageCalcTests) {
      it(`uses ${dct.name} for redirect damage`, async () => {
        runtimeState.getRuntimeValue.mockReturnValue(1);
        damageUtils.getCombatContext.mockResolvedValue(goblinContext());
        // First evaluation is the reduction expression (20 ≥ 10 damage → full reduce → redirect).
        automationService.evaluateAutoExpression
          .mockReturnValueOnce(20)
          .mockReturnValue(dct.evaluateResult);
        diceRoller.rollExpression.mockReturnValue(dct.rollResult ?? null);
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt',
          promise: Promise.resolve({ success: true }),
        });
        // Pass-through so the real redirect total flows to applyDamageToTarget.
        applyDamage.computeDamageAfterSave.mockImplementation((damage) => damage);
        applyDamage.applyDamageToTarget.mockResolvedValue({});

        const result = await handle(makeRedirectAction({ redirectDamage: dct.redirectDamage }), makeMonkPlayerStats(), campaignName, null);
        await result.payload.onTargetSelected('Goblin');

        if (dct.expectedDamage > 0) {
          expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
            expect.anything(),
            'Goblin',
            dct.expectedDamage,
            ['Force'],
            { campaignName, characters: expect.anything(), ignoreResistance: false, attackerName: 'MonkHero' },
          );
        } else {
          expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
        }

        if (typeof dct.evaluateResult === 'number') {
          expect(diceRoller.rollExpression).not.toHaveBeenCalled();
        } else {
          expect(diceRoller.rollExpression).toHaveBeenCalledWith(dct.evaluateResult);
        }
      });
    }
  });

  describe('redirect - onSkip callback', () => {
    it('logs when player skips redirect', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(goblinContext());

      const result = await handle(makeRedirectAction(), makeMonkPlayerStats(), campaignName, null);
      await result.payload.onSkip();

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'MonkHero',
          abilityName: 'Deflect Attacks',
          description: 'MonkHero used Deflect Attacks to reduce damage to 0 but chose not to redirect force.',
        }),
      );
    });
  });

  describe('redirect - getMonkLevel edge cases (sole home — only reachable via redirectSaveDc)', () => {
    it('handles playerStats with no class_levels', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(goblinContext());
      armRedirectExecution({ success: true, damageOnSave: 10 });

      // getMonkLevel → 0 ⇒ fallback DC is 8 + 2 + 0 + 3 = 13 (not NaN).
      const ps = makeMonkPlayerStats({ class: {} });
      const result = await handle(makeRedirectAction(), ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.featureDescription).toContain('DC 13');
      await result.payload.onTargetSelected('Goblin');
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'Goblin',
        10,
        ['Force'],
        { campaignName, characters: expect.anything(), ignoreResistance: false, attackerName: 'MonkHero' },
      );
    });
  });
});
