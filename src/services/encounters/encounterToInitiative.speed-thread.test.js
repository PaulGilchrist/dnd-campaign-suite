// @maintained-by-ai
// Lane: EB join → combatSummary `speed` threading
// (bug-movement-budget-caps-all-movers-at-30, monster face).
//
// Regression pin: joined monster rows carried no speed key at all (live GET
// witnessed the key set without `speed`), so the card economy strip fell to
// the universal 30 ft while the bestiary authored Wolf = 40 ft. Both row
// builders (new-combat expand + mid-round join add) now stamp the numeric
// walk speed in feet — the same numeric shape executeAttackRider's
// `ally?.speed || 30` reader already expected on cs rows. Blocks that author
// no usable speed keep `speed: null` (honest unknown → 30 ft display), same
// idiom as size/monsterIndex.
//
// Mock block mirrored from encounterToInitiative.test.js.
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

import {
  expandMonstersToCreatures,
  addMonstersToInitiative,
} from './encounterToInitiative.js';
import { rollD20 } from '../dice/diceRoller.js';
import { loadCombatSummary } from './combatData.js';

beforeEach(() => {
  vi.clearAllMocks();
  rollD20.mockReturnValue(10);
  loadCombatSummary.mockResolvedValue(null);
});

const WOLF = {
  index: 'wolf', name: 'Wolf', type: 'Beast', size: 'Medium', qty: 1,
  hit_points: 11, armor_class: 12, speed: { walk: '40 ft.' },
};

describe('EB join threads the bestiary walk speed onto combatSummary rows', () => {
  it('new-combat expand: Wolf joins with numeric speed 40 (feet — the cs-row reader shape)', async () => {
    const { creatures } = await expandMonstersToCreatures([WOLF], [], 'TestCampaign');
    expect(creatures[0].speed).toBe(40);
  });

  it('mid-round join: Wolf joins with numeric speed 40', async () => {
    loadCombatSummary.mockResolvedValue({ round: 1, creatures: [] });
    const result = await addMonstersToInitiative([WOLF], [], 'TestCampaign');
    expect(result.creatures[0].speed).toBe(40);
  });

  it('plain-string and number speed shapes fold to feet; an unauthored block keeps null (never a fabricated 0)', async () => {
    const { creatures } = await expandMonstersToCreatures([
      { ...WOLF, name: 'Goblin', speed: '30 ft.' },
      { ...WOLF, name: 'Ogre', speed: 40 },
      { ...WOLF, name: 'Shadow', speed: undefined },
    ], [], 'TestCampaign');
    expect(creatures.map((c) => c.speed)).toEqual([30, 40, null]);
  });

  it('a fly-only block folds to its fly speed (no walk authored)', async () => {
    const { creatures } = await expandMonstersToCreatures(
      [{ ...WOLF, name: 'Bat', speed: { fly: '60 ft.', walk: '' } }], [], 'TestCampaign');
    expect(creatures[0].speed).toBe(60);
  });
});
