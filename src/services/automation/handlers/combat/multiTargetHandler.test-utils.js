// @cleaned-by-ai
import { vi } from 'vitest';

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
  isWithinRange: vi.fn().mockResolvedValue(true),
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

// ── Helpers ────────────────────────────────────────────────────

export const campaignName = 'TestCampaign';
export const mapName = 'tavern-map';

export function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiencyBonus: 3,
    hitPoints: 30,
    ...overrides,
  };
}

export function makeAction(automation = {}, overrides = {}) {
  return {
    name: 'Word of Creation',
    automation: {
      range: '30 ft',
      ...automation,
    },
    ...overrides,
  };
}

export function makeCombatSummary(creatures = [], players = []) {
  return { creatures, players, placedItems: [] };
}

