// @maintained-by-ai
// CLA-034 Beguiling Twist (ranger reaction, routed via automation/index.js `reaction_save`).
// Deterministic seam pins: getCombatContext / getRuntimeValue('campaign','lastAttack') /
// isWithinRange are mocked; buildSaveDc + rangeToFeet run REAL (wiring only — internals
// owned by savePrompt.test.js / rangeValidation suites). Trigger gate is the strict table
// below; popup descriptions are own-composition full-string pins and fail deliberately on
// copy changes. Overlaps with cla-081-defensive-tactics: none (miss-gated, no charmed/
// frightened triggers). Turn-based only — no timers here or in the handler.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './beguilingTwistHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

const campaignName = 'TestCampaign';
const playerName = 'TestRanger';
const TIMESTAMP = 1700000000000;

// Own-composition popup descriptions (exact copy pins).
const NO_TRIGGER_DESC = 'No recent save against Charmed or Frightened found. Beguiling Twist must be used shortly after a successful save against Charmed or Frightened.';
const NO_COMBAT_DATA_DESC = 'Cannot determine targets. Beguiling Twist requires combat data to identify potential targets.';
const NO_CREATURES_DESC = 'No creatures available to target with Beguiling Twist.';
const NO_ELIGIBLE_DESC = 'Beguiling Twist targets a DIFFERENT creature within 120 feet — TestRanger succeeded on that save and cannot be the target, and no other creature is eligible.';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Charisma', bonus: -1 }],
    // CLA-034: Ranger spellcasting is WIS — the spell_save_dc seam resolves
    // 8 + WIS 3 + prof 4 = 15 here; CHA (-1) would wrongly give 11.
    spellAbilities: { saveDc: 15, modifier: 3, spellCastingAbility: 'WIS' },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Beguiling Twist',
    automation: {
      type: 'reaction_save',
      saveDc: 'spell_save_dc',
      range: '120_ft',
      duration: '1_minute',
      target: 'different_creature',
      ...automation,
    },
  };
}

function defaultCreatures() {
  return [
    { name: 'Ally1', type: 'player' },
    { name: playerName, type: 'player' },
    { name: 'Goblin', type: 'monster' },
  ];
}

function mockLastAttack(lastAttack) {
  getRuntimeValue.mockImplementation((name, key, _campaign) => {
    if (name === 'campaign' && key === 'lastAttack') return lastAttack;
    return undefined;
  });
}

function popupResult(description, automation) {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Beguiling Twist',
      description,
      automation,
    },
  };
}

describe('beguilingTwistHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue({ creatures: defaultCreatures() });
    isWithinRange.mockResolvedValue(true);
    mockLastAttack(null);
  });

  describe('trigger gate — refusals (exact runtime key, strict table)', () => {
    // Handler reads ONLY ('campaign','lastAttack',campaignName) — pin once.
    const NON_TRIGGERS = [
      ['no lastAttack exists', null],
      ['lastAttack is an attack roll', { rollType: 'attack', attackerName: 'Goblin', targetName: playerName, hit: true }],
      ['lastAttack is a failed save against charmed', { rollType: 'save', targetName: playerName, saveResult: 'failure', saveConditions: ['charmed'] }],
      ['failed save whose saveType is charmed', { rollType: 'save', targetName: playerName, saveResult: 'failure', saveType: 'charmed' }],
      ['successful save without charmed/frightened saveConditions', { rollType: 'save', targetName: playerName, saveResult: 'success', saveConditions: ['prone'] }],
      ['successful save with no saveConditions key at all', { rollType: 'save', targetName: playerName, saveResult: 'success' }],
      ['condition event with a non-charmed/frightened conditionKey', { rollType: 'condition', conditionKey: 'prone', targetName: playerName, timestamp: TIMESTAMP }],
    ];

    for (const [label, lastAttack] of NON_TRIGGERS) {
      it(`should refuse with the no-trigger popup when ${label}`, async () => {
        mockLastAttack(lastAttack);
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result).toEqual(popupResult(NO_TRIGGER_DESC, action.automation));
        expect(getRuntimeValue).toHaveBeenCalledTimes(1);
        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', campaignName);
      });
    }
  });

  describe('trigger gate — modals (all three trigger shapes × charmed/frightened, exact payload pins)', () => {
    const TRIGGERS = [
      ['condition event charmed', { rollType: 'condition', conditionKey: 'charmed', targetName: playerName, timestamp: TIMESTAMP }, 'charmed'],
      ['condition event frightened', { rollType: 'condition', conditionKey: 'frightened', targetName: 'Ally1', timestamp: TIMESTAMP }, 'frightened'],
      ['successful save with charmed in saveConditions', { rollType: 'save', targetName: playerName, saveType: 'WIS', saveDc: 12, saveResult: 'success', saveConditions: ['charmed'], actionName: 'Charm Person' }, 'charmed'],
      ['successful save with frightened in saveConditions', { rollType: 'save', targetName: 'Ally1', saveType: 'WIS', saveDc: 13, saveResult: 'success', saveConditions: ['frightened'], actionName: 'Frightful Presence' }, 'frightened'],
      ['successful save whose saveType is charmed', { rollType: 'save', targetName: playerName, saveResult: 'success', saveType: 'charmed', saveConditions: [], saveDc: 13 }, 'charmed'],
      ['successful save whose saveType is frightened', { rollType: 'save', targetName: playerName, saveResult: 'success', saveType: 'frightened', saveConditions: [], saveDc: 13 }, 'frightened'],
    ];

    for (const [label, lastAttack, conditionKey] of TRIGGERS) {
      it(`should open the beguilingTwist modal on ${label}`, async () => {
        mockLastAttack(lastAttack);
        const action = makeAction();
        const playerStats = makePlayerStats();

        const result = await handle(action, playerStats, campaignName);

        // CLA-034: target:"different_creature" — the triggering saver is excluded
        // from the redirect picker; DC comes from the spell_save_dc seam (15).
        expect(result).toEqual({
          type: 'modal',
          modalName: 'beguilingTwist',
          payload: {
            targets: defaultCreatures().filter(c => c.name !== lastAttack.targetName),
            action,
            playerStats,
            campaignName,
            conditionKey,
            saveDc: 15,
            featureName: 'Beguiling Twist',
            rangeFt: 120,
            triggeredBy: lastAttack.targetName,
          },
        });
      });
    }
  });

  describe('combat context gate', () => {
    it('should return popup when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);
      mockLastAttack({ rollType: 'condition', conditionKey: 'charmed', targetName: playerName, timestamp: TIMESTAMP });
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result).toEqual(popupResult(NO_COMBAT_DATA_DESC, action.automation));
      expect(getCombatContext).toHaveBeenCalledWith(campaignName);
    });

    it('should return popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      mockLastAttack({ rollType: 'condition', conditionKey: 'charmed', targetName: playerName, timestamp: TIMESTAMP });
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result).toEqual(popupResult(NO_CREATURES_DESC, action.automation));
    });
  });

  describe('save DC seam (CLA-034: spell_save_dc via buildSaveDc, never CHA)', () => {
    it('should resolve DC from playerStats.spellAbilities.saveDc and never bake in CHA', async () => {
      mockLastAttack({ rollType: 'condition', conditionKey: 'charmed', targetName: playerName, timestamp: TIMESTAMP });

      // FeyRanger discriminator: WIS +3, PB +6 → 17; 8 + CHA(-1) + 6 = 13 was the
      // defect and must never surface. (buildSaveDc internals owned by savePrompt.test.js.)
      const result = await handle(
        makeAction(),
        { ...makePlayerStats(), proficiency: 6, spellAbilities: { saveDc: 17, modifier: 3, spellCastingAbility: 'WIS' } },
        campaignName,
      );

      expect(result.payload.saveDc).toBe(17);
      expect(result.payload.saveDc).not.toBe(13);
    });
  });

  describe('range gating (CLA-034: isWithinRange seam)', () => {
    function frightenedTrigger() {
      mockLastAttack({ rollType: 'save', targetName: playerName, saveResult: 'success', saveConditions: ['frightened'] });
    }

    it('should consult isWithinRange per candidate with the data 120 ft band', async () => {
      frightenedTrigger();

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(isWithinRange).toHaveBeenCalledTimes(2);
      expect(isWithinRange).toHaveBeenCalledWith(playerName, 'Ally1', 120);
      expect(isWithinRange).toHaveBeenCalledWith(playerName, 'Goblin', 120);
    });

    it('should drop creatures reported out of range', async () => {
      frightenedTrigger();
      isWithinRange.mockImplementation(async (_source, target) => target !== 'Goblin');

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.targets).toEqual([{ name: 'Ally1', type: 'player' }]);
    });

    it('should resolve a custom data range through rangeToFeet', async () => {
      frightenedTrigger();

      const result = await handle(makeAction({ range: '30_ft' }), makePlayerStats(), campaignName);

      expect(result.payload.rangeFt).toBe(30);
      expect(isWithinRange).toHaveBeenCalledWith(playerName, 'Ally1', 30);
      expect(isWithinRange).toHaveBeenCalledWith(playerName, 'Goblin', 30);
    });

    it('should fall back to the 120 ft default when auto.range is absent', async () => {
      frightenedTrigger();

      const result = await handle(makeAction({ range: undefined }), makePlayerStats(), campaignName);

      expect(result.payload.rangeFt).toBe(120);
      expect(isWithinRange).toHaveBeenCalledWith(playerName, 'Ally1', 120);
    });

    it('should refuse with a popup when no eligible different creature remains', async () => {
      frightenedTrigger();
      getCombatContext.mockResolvedValue({ creatures: [{ name: playerName, type: 'player' }] });
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result).toEqual(popupResult(NO_ELIGIBLE_DESC, action.automation));
      expect(isWithinRange).not.toHaveBeenCalled();
    });
  });

  describe('feature name', () => {
    beforeEach(() => {
      mockLastAttack({ rollType: 'condition', conditionKey: 'charmed', targetName: playerName, timestamp: TIMESTAMP });
    });

    it('should use custom feature name from action', async () => {
      const customResult = await handle(
        { ...makeAction(), name: 'My Feature' },
        makePlayerStats(),
        campaignName,
      );

      expect(customResult.modalName).toBe('beguilingTwist');
      expect(customResult.payload.featureName).toBe('My Feature');
    });

    it('should default feature name to Beguiling Twist when action has no name', async () => {
      const defaultResult = await handle(
        { automation: makeAction().automation },
        makePlayerStats(),
        campaignName,
      );

      expect(defaultResult.payload.featureName).toBe('Beguiling Twist');
    });
  });
});
