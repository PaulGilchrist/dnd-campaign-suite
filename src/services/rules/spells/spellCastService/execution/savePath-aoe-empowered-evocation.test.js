// CLA-120: AoE save payload must NOT bake the INT adder into the shared per-target
// damage formula (RAW grants it on ONE damage roll). Ship dice-only damage plus the
// gated empoweredEvocationIntMod for the modal to fold onto the first target only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 8, rolls: [8] })),
}));

vi.mock('../../postCastRiderService.js', () => ({
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve()),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../../combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn((range) => {
    if (!range || typeof range !== 'string') return null;
    const match = String(range).match(/^(-?\d+(?:\.\d+)?)\s*(feet|foot|ft\.?)?$/i);
    return match ? parseFloat(match[1]) : null;
  }),
  computeRangeEffect: vi.fn(() => ({ mode: 'hit' })),
  computeEffectiveSpellRange: vi.fn(() => null),
  getDistanceFeet: vi.fn(() => 0),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}));

const { handleSavePath } = await import('./savePath.js');
const postCastRider = await import('../../postCastRiderService.js');

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '150 feet',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    dc: { dc_type: 'DEX', dc_success: 'half' },
    area_of_effect: { shape: 'sphere', size: '20-foot-radius Sphere' },
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'DivinationWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 6,
    spellAbilities: { spellCastingAbility: 'Intelligence', saveDc: 19, modifier: 5 },
    automation: { passives: [{ type: 'empowered_evocation' }] },
    hitPoints: 82,
    level: 20,
    ...overrides,
  };
}

function callSavePath(spellOverrides = {}) {
  const spell = makeSpell(spellOverrides);
  return handleSavePath({
    spell,
    fullSpell: spell,
    metaCtx: { slotLevel: 3 },
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    mapName: null,
    characters: [],
    getTargetInfo: async () => ({ name: 'NPC 1' }),
    getRuntimeValue: vi.fn(),
    innateSorceryActive: false,
    effectiveDamageType: 'Fire',
    spellSaveDc: 19,
    overchannelFormula: null,
    overchannelActive: false,
    overchannelUseCount: 0,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    formula: '8d6',
    hasInvisible: false,
  });
}

describe('savePath AoE — CLA-120 Empowered Evocation one-roll-per-cast payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postCastRider.getEmpoweredEvocationFeatures.mockReturnValue([{ name: 'Empowered Evocation' }]);
    postCastRider.getEmpoweredEvocationIntModifier.mockReturnValue(5);
  });

  it('evocation AoE: payload damage stays dice-only, INT mod rides its own payload key', async () => {
    const result = await callSavePath();

    expect(result.automationPopup.modalName).toBe('saveAttackAoe');
    expect(result.automationPopup.payload.damage).toBe('8d6');
    expect(result.automationPopup.payload.damage).not.toContain('[Empowered Evocation]');
    expect(result.automationPopup.payload.empoweredEvocationIntMod).toBe(5);
  });

  it('non-evocation AoE (school gate): zero INT mod, dice-only damage (control)', async () => {
    const result = await callSavePath({
      name: 'Stinking Cloud',
      school: 'Conjuration',
      damage: { damage_type: 'Poison', damage_at_slot_level: { 3: '8d6' } },
    });

    expect(result.automationPopup.payload.damage).toBe('8d6');
    expect(result.automationPopup.payload.empoweredEvocationIntMod).toBe(0);
  });

  it('zero INT modifier → int mod 0', async () => {
    postCastRider.getEmpoweredEvocationIntModifier.mockReturnValue(0);
    const result = await callSavePath();

    expect(result.automationPopup.payload.damage).toBe('8d6');
    expect(result.automationPopup.payload.empoweredEvocationIntMod).toBe(0);
  });
});
