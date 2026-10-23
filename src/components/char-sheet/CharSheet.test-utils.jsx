// ---------------------------------------------------------------------------
// CharSheet Test Utilities — shared helpers for all CharSheet test files
// ---------------------------------------------------------------------------

// Mock store shared across tests
export const createMockStore = () => new Map();

// Mock player summary
export const mockPlayerSummary = {
  name: 'Test Character',
  rules: '5e',
};

// Default props for CharSheet rendering
export const createDefaultProps = (overrides = {}) => ({
  allAbilityScores: [],
  allClasses: [],
  allClasses2024: [],
  allEquipment: [],
  allMagicItems: [],
  allRaces: [],
  allSpells: [],
  allSpells2024: [],
  playerSummary: mockPlayerSummary,
  allRaces2024: [],
  allMagicItems2024: [],
  campaignName: 'test-campaign',
  activeMapName: null,
  characters: [],
  onDeleteCharacter: vi.fn(),
  onEditCharacter: vi.fn(),
  onUploadClick: vi.fn(),
  onSaveClick: vi.fn(),
  ...overrides,
});

// Mock player stats factory
export const createMockPlayerStats = (overrides = {}) => ({
  name: 'Test Character',
  level: 5,
  hitPoints: { current: 40, max: 40 },
  abilities: [{ name: 'Strength', bonus: 2, save: 4, skills: [] }],
  spellAbilities: { spells: [], maxPreparedSpells: 5 },
  rules: '5e',
  automation: { passives: [] },
  class: { name: 'Fighter' },
  speed: 30,
  race: { speed: 30, traits: [] },
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  characterAdvancement: [],
  skillProficiencies: [],
  saveModifiers: [],
  ...overrides,
});

// Popup return value factory
export const createSharedPopupReturnValue = () => ({
  popupHtml: null,
  setPopupHtml: vi.fn(),
  value: {},
  Provider: ({ children }) => children,
});

// Set popup helper — mutates the shared popup return value
export const setPopup = (popupReturnValue, html) => {
  popupReturnValue.popupHtml = html;
};

// beforeEach reset helper — call this in each describe block's beforeEach
export const resetTestState = (popupReturnValue) => {
  vi.clearAllMocks();
  popupReturnValue.popupHtml = null;
  popupReturnValue.setPopupHtml = vi.fn();
  popupReturnValue.value = {};
};
