// @maintained-by-ai
// Dedicated owner of the Wild Shape (shape_shift) lane in buffHandler.
// Pins the stable handler contract: CLA-391 uses-gate (ON leg gated, OFF leg
// always allowed to end the form), the ON-leg wild_shape_select payload echo
// (chooser modal receives the SAME action/playerStats/campaignName references),
// the class-data max fallback when the runtime counter is unset, and the
// CLA-013 5e lv20 Archdruid unlimited exemption / free-revert log token.
// hasUnlimitedWildShape input truth is pinned in archdruidWildShapeService.test.js —
// this suite only pins the handler wiring around it, one test per branch.
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

// wildShapeUses undefined models "runtime counter never initialized".
function mockRuntime({ activeBuffs = [], wildShapeUses = undefined } = {}) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeBuffs') return activeBuffs;
    if (key === 'wildShapeUses') return wildShapeUses;
    return undefined;
  });
}

function loggedEntries() {
  return logService.addEntry.mock.calls.map(c => c[1]);
}

describe('buffHandler Wild Shape uses-gate (CLA-391)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockResolvedValue(undefined);
  });

  it('OFF leg is ungated — toggles OFF at 0 uses, cleans up, logs deactivation, no revert token', async () => {
    mockRuntime({
      activeBuffs: [{ name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true }],
      wildShapeUses: 0,
    });
    buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

    const result = await handle(makeAction(), makeDruidStats(), campaignName, null);

    expect(buffToggle.toggleBuff).toHaveBeenCalled();
    expect(wildShapeCreatureBuilder.cleanupWildShape).toHaveBeenCalledWith('Wild_Sage_Druid', campaignName);
    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Wild Shape toggled OFF');
    expect(result.payload.description).not.toContain('No Wild Shape uses remaining');
    const entries = loggedEntries();
    expect(entries.find(e => e.type === 'ability_use').description).toContain('deactivated Wild Shape');
    expect(entries.find(e => e.automationType === 'shape_shift_reverted')).toBeUndefined();
  });

  it('refuses the ON leg at 0 uses with popup and wild_shape_refused log, no toggle, no cleanup', async () => {
    mockRuntime({ activeBuffs: [], wildShapeUses: 0 });

    const result = await handle(makeAction(), makeDruidStats(), campaignName, null);

    expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    expect(wildShapeCreatureBuilder.cleanupWildShape).not.toHaveBeenCalled();
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No Wild Shape uses remaining');
    const refusal = loggedEntries().find(e => e.automationType === 'wild_shape_refused');
    expect(refusal).toBeDefined();
    expect(refusal.description).toContain('No Wild Shape uses remaining');
  });

  it('activates with uses available — wild_shape_select chooser echoes action, playerStats and campaignName by reference', async () => {
    mockRuntime({ activeBuffs: [], wildShapeUses: 3 });
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
    const action = makeAction();
    const playerStats = makeDruidStats();

    const result = await handle(action, playerStats, campaignName, null);

    expect(buffToggle.toggleBuff).toHaveBeenCalled();
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('wild_shape_select');
    expect(result.payload.action).toBe(action);
    expect(result.payload.playerStats).toBe(playerStats);
    expect(result.payload.campaignName).toBe(campaignName);
  });

  it('ON leg falls back to class-data wild_shape max when the runtime counter is unset', async () => {
    mockRuntime({ activeBuffs: [] });
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
    const lv7Stats = makeDruidStats({
      level: 7,
      class: { major: { name: 'Druid' }, class_levels: [{ level: 7, wild_shape: 2 }] },
    });

    const result = await handle(makeAction(), lv7Stats, campaignName, null);

    expect(buffToggle.toggleBuff).toHaveBeenCalled();
    expect(result.payload.type).toBe('wild_shape_select');
    expect(loggedEntries().find(e => e.automationType === 'wild_shape_refused')).toBeUndefined();
  });

  describe('CLA-013 5e lv20 Archdruid — unlimited uses', () => {
    const makeUnlimitedDruidStats = () => makeDruidStats({
      rules: '5e',
      class: {
        major: { name: 'Druid' },
        class_levels: [{ level: 20, features: [{ name: 'Archdruid' }] }],
      },
    });

    it('ON leg is NOT refused at 0 uses or with no counter — shows the form chooser, no refusal log, and never consults the uses counter', async () => {
      mockRuntime({ activeBuffs: [], wildShapeUses: 0 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(makeAction(), makeUnlimitedDruidStats(), campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
      expect(result.payload.type).toBe('wild_shape_select');
      expect(loggedEntries().find(e => e.automationType === 'wild_shape_refused')).toBeUndefined();
      // Unlimited exemption short-circuits the gate: counter is never read.
      expect(runtimeState.getRuntimeValue.mock.calls.some(([, key]) => key === 'wildShapeUses')).toBe(false);
    });

    it('OFF leg logs the shape_shift_reverted free-revert token for Archdruid hosts', async () => {
      mockRuntime({
        activeBuffs: [{ name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true }],
        wildShapeUses: 0,
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(makeAction(), makeUnlimitedDruidStats(), campaignName, null);

      const entries = loggedEntries();
      const revert = entries.find(e => e.automationType === 'shape_shift_reverted');
      expect(revert).toBeDefined();
      expect(revert.type).toBe('automation');
      expect(revert.characterName).toBe('Wild_Sage_Druid');
      expect(revert.description).toContain('free');
      expect(entries.find(e => e.type === 'ability_use').description).toContain('deactivated Wild Shape');
    });
  });
});
