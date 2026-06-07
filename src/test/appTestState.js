import { vi } from 'vitest';

export const mockState = {
  campaignName: 'test-campaign',
  characters: [],
};

export const dataLoaderMocks = {
  loadAbilityScores: vi.fn(),
  loadClassData: vi.fn(),
  loadEquipment: vi.fn(),
  loadMagicItems: vi.fn(),
  loadRaceData: vi.fn(),
  loadSpells: vi.fn(),
};
