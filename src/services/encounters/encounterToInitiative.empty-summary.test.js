// @maintained-by-ai
// Regression: bug-eb-join-empty-combatsummary-silent-fail — a corrupted,
// creature-less combatSummary (the store holding `{}` — truthy but with no
// `creatures` array) made addMonstersToInitiative die on
// `combatSummary.creatures.some(...)` (TypeError reading 'some') inside
// hasMonsterVariant, silently aborting the Join Encounter lane mid-way
// while the pre-written `encounter/joined` log row stood in the campaign
// log. Fix: normalize missing OR creature-less summaries to a fresh
// { round: 1, creatures: [] } (same self-heal seam as the Initiative mount
// guard, Initiative.jsx `initialSummary && initialSummary.creatures`).
// Mock setup mirrors sibling encounterToInitiative.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));

vi.mock('../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../ui/utils.js', () => ({ default: { getName: vi.fn((n) => n || 'Unknown') } }));

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('./combatData.js', () => ({
  loadCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}));

import { addMonstersToInitiative } from './encounterToInitiative.js';
import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { loadCombatSummary } from './combatData.js';

beforeEach(() => {
  vi.clearAllMocks();
  rollD20.mockReturnValue(10);
  loadCombatSummary.mockResolvedValue(null);
});

describe('addMonstersToInitiative — corrupted creature-less combatSummary', () => {
  it.each([
    ['empty object {}', {}],
    ['round without creatures', { round: 3 }],
  ])('%s in the store self-heals to a fresh board instead of throwing', async (_label, poisoned) => {
    loadCombatSummary.mockResolvedValue(poisoned);

    const result = await addMonstersToInitiative(
      [{ name: 'Goblin', qty: 1, armor_class: 13 }], [], 'TestCampaign');

    // Join SUCCEEDS: lone monster with a new name keeps it plain (the same
    // contract as the null-summary lane — `{}` is exactly a new combat).
    expect(result.round).toBe(1);
    expect(result.creatures).toHaveLength(1);
    expect(result.creatures[0]).toMatchObject({ name: 'Goblin', type: 'npc', ac: 13 });
    // The healed board reaches the store — no silent half-write.
    expect(storage.set).toHaveBeenCalledWith(
      'combatSummary',
      expect.objectContaining({ round: 1, creatures: [expect.objectContaining({ name: 'Goblin' })] }),
      'TestCampaign');
    expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Goblin', 'TestCampaign');
  });
});
