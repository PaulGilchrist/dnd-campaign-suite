// CLA-244 regression: AoE save-damage payload must carry overchannel context
// and a maximized-capable formula (mirroring the single-target save path).
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

vi.mock('../../../features/viciousMockeryService.js', () => ({
  triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));

const { handleSavePath } = await import('./savePath.js');
const postCastRider = await import('../../postCastRiderService.js');

/* ------------------------------------------------------------------ */
/*  Fixtures                                                         */
/* ------------------------------------------------------------------ */

function makeSpell(overrides = {}) {
  return {
    name: 'Burning Hands',
    level: 1,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: 'Self',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 1: '3d6' } },
    dc: { dc_type: 'DEX', dc_success: 'half' },
    area_of_effect: { shape: 'cone', size: '15-foot Cone' },
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    proficiency: 6,
    spellAbilities: { spellCastingAbility: 'Intelligence', saveDc: 17, modifier: 3 },
    automation: { passives: [{ type: 'overchannel' }] },
    hitPoints: 82,
    level: 20,
    ...overrides,
  };
}

function callSavePath(spellOverrides = {}, overchannel = {}, metaOverrides = {}) {
  const spell = makeSpell(spellOverrides);
  const [overchannelFormula, overchannelActive, overchannelUseCount] = [
    overchannel.formula ?? null,
    overchannel.active ?? false,
    overchannel.useCount ?? 0,
  ];
  return handleSavePath({
    spell,
    fullSpell: spell,
    metaCtx: { slotLevel: 1, ...metaOverrides },
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    mapName: null,
    characters: [],
    getTargetInfo: async () => ({ name: 'Zombie 1' }),
    getRuntimeValue: vi.fn(),
    innateSorceryActive: false,
    effectiveDamageType: 'Fire',
    spellSaveDc: 17,
    overchannelFormula,
    overchannelActive,
    overchannelUseCount,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    formula: '3d6',
    hasInvisible: false,
  });
}

describe('savePath AoE — CLA-244 overchannel context threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postCastRider.getEmpoweredEvocationFeatures.mockReturnValue([]);
    postCastRider.getEmpoweredEvocationIntModifier.mockReturnValue(0);
  });

  it('passes overchannel context in saveAttackAoe payload when active', async () => {
    const result = await callSavePath({}, { active: true, useCount: 1, formula: '3d6 [Overchannel Maximize]' });

    expect(result.automationPopup.modalName).toBe('saveAttackAoe');
    expect(result.automationPopup.payload.overchannelActive).toBe(true);
    expect(result.automationPopup.payload.overchannelUseCount).toBe(1);
    expect(result.automationPopup.payload.overchannelSpellLevel).toBe(1);
  });

  it('damage formula carries [Overchannel Maximize] suffix when active', async () => {
    const result = await callSavePath({}, { active: true, useCount: 1 });

    expect(result.automationPopup.payload.damage).toContain('[Overchannel Maximize]');
    expect(result.automationPopup.payload.damage).toMatch(/^3d6/);
  });

  it('damage formula includes Empowered Evocation bonus for Evocation spells when overchannel active', async () => {
    postCastRider.getEmpoweredEvocationFeatures.mockReturnValue([{ name: 'Empowered Evocation' }]);
    postCastRider.getEmpoweredEvocationIntModifier.mockReturnValue(3);

    const result = await callSavePath({}, { active: true, useCount: 1 });

    expect(result.automationPopup.payload.damage).toBe('3d6 + 3 [Empowered Evocation] [Overchannel Maximize]');
  });

  it('uses slot-level dice from damage_at_slot_level when upcast overchannel', async () => {
    const result = await callSavePath(
      { damage: { damage_type: 'Fire', damage_at_slot_level: { 1: '3d6', 2: '4d6', 3: '5d6' } } },
      { active: true, useCount: 2 },
      { slotLevel: 3 },
    );

    expect(result.automationPopup.payload.damage).toMatch(/^5d6 \[Overchannel Maximize\]/);
    expect(result.automationPopup.payload.overchannelSpellLevel).toBe(3);
  });

  it('no suffix and false flags when overchannel inactive', async () => {
    const result = await callSavePath({}, { active: false, useCount: 0 });

    expect(result.automationPopup.payload.damage).toBe('3d6');
    expect(result.automationPopup.payload.overchannelActive).toBe(false);
    expect(result.automationPopup.payload.overchannelUseCount).toBe(0);
    expect(result.automationPopup.payload.overchannelSpellLevel).toBe(1);
  });

  it('non-evocation AoE damage spell gets maximize suffix without empowered bonus', async () => {
    const result = await callSavePath(
      { name: 'Hunger of Hadar', school: 'Conjuration', damage: { damage_type: 'Cold', damage_at_slot_level: { 1: '2d6' } } },
      { active: true, useCount: 1 },
    );

    expect(result.automationPopup.payload.damage).toBe('2d6 [Overchannel Maximize]');
  });
});
