import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockImplementation(() => Promise.resolve(true)),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './multiTargetHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

import {
  campaignName,
  mapName,
  makePlayerStats,
  makeAction,
  makeCombatSummary,
} from './multiTargetHandler.test-utils.js';


function makeBaseCs(creatures = [], players = []) {
  return makeCombatSummary(creatures, players);
}

describe('multiTargetHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue(makeBaseCs());
    getCombatSummary.mockImplementation(() => makeBaseCs());
  });

  // ── combat context validation ────────────────────────────────

  describe('combat context validation', () => {
    it('should return automation_info popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Word of Creation');
      expect(result.payload.description).toContain('No combat context found');
    });

    it('should return automation_info popup when first target not found in combat summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction({}, { payload: { targetName: 'Goblin' } });
      getCombatContext.mockResolvedValue(makeBaseCs([{ name: 'Orc' }]));

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No first target found');
    });

    it('should return automation_info popup when action.payload or targetName is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({}, { payload: null });
      getCombatContext.mockResolvedValue(makeBaseCs([{ name: 'Goblin' }]));

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No first target found');
    });
  });

  // ── multi-target selection popup ─────────────────────────────

  describe('multi-target selection popup', () => {
    function setupContext(creatures = [], players = []) {
      const cs = makeBaseCs(creatures, players);
      getCombatContext.mockResolvedValue(cs);
      getCombatSummary.mockReturnValue(cs);
      rangeToFeet.mockReturnValue(30);
    }

    it('should return multi_target_selection popup with correct payload structure', async () => {
      setupContext(
        [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
        ],
        [{ name: 'TestHero', gridX: 5, gridY: 10 }]
      );

      const result = await handle(
        makeAction({}, { payload: { targetName: 'Goblin' } }),
        makePlayerStats(),
        campaignName,
        mapName
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('multi_target_selection');
      expect(result.payload.name).toBe('Word of Creation');
      expect(result.payload.firstTargetName).toBe('Goblin');
      expect(result.payload.range).toBe('30 ft');
      expect(result.payload.creatureTargets).toEqual(['Orc']);
      expect(result.payload.spellFilter).toEqual([]);
      expect(result.payload.automation).toEqual({ range: '30 ft' });
    });

    it('should exclude the first target from creatureTargets', async () => {
      setupContext([
        { name: 'Goblin', type: 'monster' },
        { name: 'Orc', type: 'monster' },
        { name: 'Ally', type: 'player' },
      ]);

      const result = await handle(
        makeAction({}, { payload: { targetName: 'Goblin' } }),
        makePlayerStats(),
        campaignName,
        mapName
      );

      expect(result.payload.creatureTargets).not.toContain('Goblin');
      expect(result.payload.creatureTargets).toContain('Orc');
      expect(result.payload.creatureTargets).toContain('Ally');
    });

    it('should use default range when automation.range is missing', async () => {
      rangeToFeet.mockReturnValue(10);
      getCombatContext.mockResolvedValue(makeBaseCs([{ name: 'Goblin' }]));
      getCombatSummary.mockReturnValue(makeBaseCs([{ name: 'Goblin' }]));

      const result = await handle(
        makeAction({ range: undefined }, { payload: { targetName: 'Goblin' } }),
        makePlayerStats(),
        campaignName,
        mapName
      );

      expect(result.payload.range).toBe('10 ft');
    });

    it('should include spellFilter in payload when provided', async () => {
      setupContext([{ name: 'Goblin' }]);

      const result = await handle(
        makeAction({ spellFilter: ['evocation', 'conjuration'] }, { payload: { targetName: 'Goblin' } }),
        makePlayerStats(),
        campaignName,
        mapName
      );

      expect(result.payload.spellFilter).toEqual(['evocation', 'conjuration']);
    });

    it('should return empty creatureTargets when combat summary has no creatures', async () => {
      getCombatContext.mockResolvedValue(makeBaseCs([{ name: 'Goblin' }]));
      getCombatSummary.mockReturnValue(makeBaseCs());

      const result = await handle(
        makeAction({}, { payload: { targetName: 'Goblin' } }),
        makePlayerStats(),
        campaignName,
        mapName
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('multi_target_selection');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should return empty creatureTargets when first target is the only creature', async () => {
      setupContext([{ name: 'Goblin' }]);

      const result = await handle(
        makeAction({}, { payload: { targetName: 'Goblin' } }),
        makePlayerStats(),
        campaignName,
        mapName
      );

      expect(result.payload.creatureTargets).toEqual([]);
    });
  });

  // ── range-based creature filtering ───────────────────────────

  describe('range-based creature filtering', () => {
    it('should include all creatures when range filtering is disabled (null range or null attackerPos)', async () => {
      const cs = makeBaseCs(
        [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster' },
          { name: 'Ally', type: 'player' },
        ],
        [{ name: 'TestHero', gridX: 5, gridY: 10 }]
      );
      getCombatContext.mockResolvedValue(cs);
      getCombatSummary.mockReturnValue(cs);
      rangeToFeet.mockReturnValue(null);
      vi.mocked(resolveMapPositions).mockResolvedValue(null);

      const result = await handle(
        makeAction({ range: undefined }, { payload: { targetName: 'Goblin' } }),
        makePlayerStats(),
        campaignName,
        mapName
      );

      expect(result.payload.creatureTargets).toContain('Orc');
      expect(result.payload.creatureTargets).toContain('Ally');
      expect(result.payload.creatureTargets).not.toContain('Goblin');
    });

    it('should include all creatures when attackerPos is null even with valid range', async () => {
      const cs = makeBaseCs(
        [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster' },
          { name: 'Ally', type: 'player' },
        ],
        [{ name: 'TestHero', gridX: 5, gridY: 10 }]
      );
      getCombatContext.mockResolvedValue(cs);
      getCombatSummary.mockReturnValue(cs);
      rangeToFeet.mockReturnValue(30);
      vi.mocked(resolveMapPositions).mockResolvedValue(null);

      const result = await handle(
        makeAction({}, { payload: { targetName: 'Goblin' } }),
        makePlayerStats(),
        campaignName,
        mapName
      );

      expect(result.payload.creatureTargets).toContain('Orc');
      expect(result.payload.creatureTargets).toContain('Ally');
      expect(result.payload.creatureTargets).not.toContain('Goblin');
    });
  });
});
