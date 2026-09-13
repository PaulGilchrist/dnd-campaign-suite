// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './countercharmHandler.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { removeCondition } from '../../../combat/conditions/conditionSaveService.js';

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/conditions/conditionSaveService.js', () => ({
  removeCondition: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../common/infoPopup.js', () => ({
  infoPopup: vi.fn((name, desc, auto) => ({
    type: 'popup',
    payload: { type: 'automation_info', name, description: desc, automation: auto },
  })),
}));

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'tavern-map';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Countercharm',
    automation: {
      range: '30 ft',
      ...automation,
    },
  };
}

function makeAttackResult(overrides = {}) {
  return {
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
    ...overrides,
  };
}

function makeAttackEvent(overrides = {}) {
  return {
    rollType: 'attack',
    d20: 8,
    bonus: 2,
    targetAc: 13,
    hit: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeSaveEvent(overrides = {}) {
  return {
    rollType: 'save',
    d20: 8,
    bonus: 2,
    saveDc: 13,
    saveResult: 'failure',
    saveType: 'Wisdom',
    actionName: 'Charm Person',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeCheckEvent(overrides = {}) {
  return {
    rollType: 'check',
    d20: 8,
    bonus: 2,
    checkName: 'Persuasion',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('countercharmHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findLastAttack.mockResolvedValue(makeAttackResult());
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestHero', type: 'player' },
        { name: 'Ally1', type: 'player' },
        { name: 'Goblin', type: 'npc' },
      ],
    });
    isWithinRange.mockResolvedValue(true);
  });

  describe('no recent roll', () => {
    it('should return popup when findLastAttack returns no attackEvent', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Countercharm');
      expect(result.payload.description).toContain('No recent D20 test found');
    });
  });

  describe('save roll type', () => {
    const saveRollTests = [
      { targetName: 'TestHero', label: 'self', expectedTarget: 'TestHero' },
      { targetName: 'Ally1', label: 'ally', expectedTarget: 'Ally1' },
      { targetName: 'Goblin', label: 'NPC', expectedTarget: 'Goblin' },
    ];

    it.each(saveRollTests)(
      'should identify $label as target when they failed their save',
      async ({ targetName, expectedTarget }) => {
        const ps = makePlayerStats();
        const action = makeAction();
        findLastAttack.mockResolvedValue(makeAttackResult({
          attackEvent: makeSaveEvent({ d20: 5, saveDc: 14, saveResult: 'failure' }),
          targetName,
        }));

        const result = await handle(action, ps, campaignName, mapName);

        expect(result.payload.description).toContain(`Target: ${expectedTarget}`);
        expect(result.payload.description).toContain('Original Wisdom save');
      },
    );

    it('should display no effect when save already succeeded', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 15, saveDc: 13, saveResult: 'success' }),
        targetName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Succeeded');
      expect(result.payload.description).toContain('already succeeded');
    });

    it('should display still a failure when reroll does not meet DC', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 3, saveDc: 15, saveResult: 'failure' }),
        targetName: 'TestHero',
      }));
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Failed');
      expect(result.payload.description).toContain('Still a failure');
    });

    it('should display turned failure into success when reroll meets DC', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 3, saveDc: 15, saveResult: 'failure' }),
        targetName: 'TestHero',
      }));
      vi.spyOn(Math, 'random').mockReturnValue(0.95);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('turned a failure into a success');
    });

    it('should remove charmed and frightened conditions when save is converted to success', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 3, saveDc: 15, saveResult: 'failure' }),
        targetName: 'TestHero',
      }));
      vi.spyOn(Math, 'random').mockReturnValue(0.95);

      await handle(action, ps, campaignName, null);

      expect(removeCondition).toHaveBeenCalledWith({
        combatSummary: expect.any(Object),
        creatureName: 'TestHero',
        condition: 'charmed',
        getRuntimeValue: expect.any(Function),
        setRuntimeValue: expect.any(Function),
      });
      expect(removeCondition).toHaveBeenCalledWith({
        combatSummary: expect.any(Object),
        creatureName: 'TestHero',
        condition: 'frightened',
        getRuntimeValue: expect.any(Function),
        setRuntimeValue: expect.any(Function),
      });
    });

    it('should not remove conditions when save already succeeded', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 15, saveDc: 13, saveResult: 'success' }),
        targetName: 'TestHero',
      }));

      await handle(action, ps, campaignName, null);

      expect(removeCondition).not.toHaveBeenCalled();
    });
  });

  describe('attack roll type', () => {
    const attackRollTests = [
      {
        label: 'miss into hit',
        event: makeAttackEvent({ d20: 8, targetAc: 13, hit: false }),
        random: 0.95,
        expectedTexts: ['MISS', 'turned a miss into a hit'],
      },
      {
        label: 'still a miss',
        event: makeAttackEvent({ d20: 2, targetAc: 18, hit: false }),
        random: 0.05,
        expectedTexts: ['MISS', 'Still a miss'],
      },
      {
        label: 'already hit',
        event: makeAttackEvent({ d20: 15, targetAc: 13, hit: true }),
        random: null,
        expectedTexts: ['already succeeded'],
      },
    ];

    it.each(attackRollTests)(
      'should display correct outcome when $label',
      async ({ event, random, expectedTexts }) => {
        const ps = makePlayerStats();
        const action = makeAction();
        findLastAttack.mockResolvedValue(makeAttackResult({
          attackEvent: event,
          attackerName: 'TestHero',
        }));
        if (random !== null) {
          vi.spyOn(Math, 'random').mockReturnValue(random);
        }

        const result = await handle(action, ps, campaignName, null);

        for (const text of expectedTexts) {
          expect(result.payload.description).toContain(text);
        }
      },
    );
  });

  describe('ability check roll type', () => {
    it('should identify character who made the check', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeCheckEvent({ d20: 8 }),
        attackerName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Target: TestHero');
      expect(result.payload.description).toContain('Persuasion');
      expect(result.payload.description).toContain('Reroll with Advantage');
    });

    it('should display "Ability check" when checkName is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeCheckEvent({ d20: 8, checkName: null }),
        attackerName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Ability check');
    });

    it('should display improved or unchanged result based on reroll', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      // Low original roll, high random → improvement
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeCheckEvent({ d20: 5 }),
        attackerName: 'TestHero',
      }));
      vi.spyOn(Math, 'random').mockReturnValue(0.95);

      let result = await handle(action, ps, campaignName, null);
      expect(result.payload.description).toContain('improved the result');

      // High original roll, low random → unchanged
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeCheckEvent({ d20: 15 }),
        attackerName: 'TestHero',
      }));

      result = await handle(action, ps, campaignName, null);
      expect(result.payload.description).not.toContain('improved the result');
    });
  });

  describe('custom feature name', () => {
    it('should use custom name in popup and description', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Bardic Countercharm',
        automation: { range: '30 ft' },
      };
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ saveResult: 'failure' }),
        targetName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Bardic Countercharm');
      expect(result.payload.description).toContain('<b>Bardic Countercharm</b>');
    });
  });

  describe('logging', () => {
    it('should log ability use with correct data', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ saveResult: 'failure' }),
        targetName: 'TestHero',
      }));

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Countercharm',
        description: expect.stringContaining('TestHero used Countercharm on TestHero'),
        targetName: 'TestHero',
        timestamp: expect.any(Number),
      });
    });

    it('should include creature types and outcome in log description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ saveResult: 'failure' }),
        targetName: 'TestHero',
      }));

      await handle(action, ps, campaignName, null);

      const logCall = addEntry.mock.calls[0][1];
      expect(logCall.description).toContain('Source: player');
      expect(logCall.description).toContain('Target: player');
      expect(logCall.description).toContain('save');
      expect(logCall.description).toContain('Outcome:');
    });
  });
});
