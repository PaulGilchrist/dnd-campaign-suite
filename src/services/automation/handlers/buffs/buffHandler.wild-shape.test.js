// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
  isBuffActive: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/vowOfEnmityHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/sacredWeaponHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../class-druid/wildShapeCreatureBuilder.js', () => ({
  cleanupWildShape: vi.fn(),
}));

vi.mock('./tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

import { handle } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as wildShapeCreatureBuilder from '../class-druid/wildShapeCreatureBuilder.js';

const campaignName = 'test-campaign';

function makeDruidStats(overrides = {}) {
  return {
    name: 'Wild_Sage_Druid',
    level: 20,
    proficiency: 6,
    class: {
      major: { name: 'Druid' },
      subclass: { name: 'Circle of the Stars' },
      class_levels: [{ level: 20, wild_shape: 4 }],
    },
    ...overrides,
  };
}

function makeAction() {
  return {
    name: 'Wild Shape',
    automation: {
      type: 'temp_buff',
      effect: 'shape_shift',
      action: 'bonus_action',
      duration: 'half_druid_level_hours',
      tempHpExpression: 'druid_level',
      uses: 2,
      casting_time: '1 bonus action',
      blocksSpellcasting: true,
    },
  };
}

function mockRuntime({ activeBuffs = [], wildShapeUses = null } = {}) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeBuffs') return activeBuffs;
    if (key === 'wildShapeUses') return wildShapeUses;
    return undefined;
  });
}

describe('buffHandler Wild Shape uses-gate (CLA-391)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockResolvedValue(undefined);
  });

  it('still toggles the form OFF at 0 uses (OFF leg is ungated)', async () => {
    mockRuntime({
      activeBuffs: [{ name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true }],
      wildShapeUses: 0,
    });
    buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

    const result = await handle(makeAction(), makeDruidStats(), campaignName, null);

    expect(buffToggle.toggleBuff).toHaveBeenCalled();
    expect(wildShapeCreatureBuilder.cleanupWildShape).toHaveBeenCalledWith('Wild_Sage_Druid', campaignName);
    expect(result.payload.description).toBe('Wild Shape toggled OFF');
    expect(result.payload.description).not.toContain('No Wild Shape uses remaining');
  });

  it('refuses the ON leg at 0 uses with popup and wild-shape refused log, no toggle', async () => {
    mockRuntime({ activeBuffs: [], wildShapeUses: 0 });

    const result = await handle(makeAction(), makeDruidStats(), campaignName, null);

    expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No Wild Shape uses remaining');
    const refusal = logService.addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'wild_shape_refused');
    expect(refusal).toBeDefined();
    expect(refusal.description).toContain('No Wild Shape uses remaining');
  });

  it('activates with uses available and shows hours = half of Druid LEVEL', async () => {
    mockRuntime({ activeBuffs: [], wildShapeUses: 3 });
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

    const result = await handle(makeAction(), makeDruidStats(), campaignName, null);

    expect(result.payload.type).toBe('wild_shape_select');
    expect(buffToggle.toggleBuff).toHaveBeenCalled();
  });

  it('re-activation OFF at 0 uses logs deactivation', async () => {
    mockRuntime({
      activeBuffs: [{ name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true }],
      wildShapeUses: 0,
    });
    buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

    await handle(makeAction(), makeDruidStats(), campaignName, null);

    const log = logService.addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(log).toBeDefined();
    expect(log.description).toContain('deactivated Wild Shape');
  });
});
