import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockReturnValue(Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import {
  handle,
  applyMasteryEffect,
  MASTERY_EFFECTS,
} from './weaponMasteryHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 2,
    abilities: [
      { name: 'STR', bonus: 3 },
      { name: 'DEX', bonus: 2 },
      { name: 'CON', bonus: 1 },
      { name: 'INT', bonus: 0 },
      { name: 'WIS', bonus: 2 },
      { name: 'CHA', bonus: 3 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Weapon Mastery',
    automation: {
      type: 'weapon_mastery',
      ...automation,
    },
  };
}

// ── Tests: MASTERY_EFFECTS constant ────────────────────────────

describe('weaponMasteryHandler.MASTERY_EFFECTS', () => {
  it('exports the MASTERY_EFFECTS object', () => {
    expect(MASTERY_EFFECTS).toBeDefined();
    expect(typeof MASTERY_EFFECTS).toBe('object');
  });

  it('contains all 8 mastery effects', () => {
    const expectedKeys = ['Push', 'Topple', 'Sap', 'Slow', 'Vex', 'Cleave', 'Nick', 'Graze'];
    expect(Object.keys(MASTERY_EFFECTS)).toHaveLength(8);
    expectedKeys.forEach(key => {
      expect(MASTERY_EFFECTS[key]).toBeDefined();
    });
  });

  it('Push has correct properties', () => {
    expect(MASTERY_EFFECTS.Push.label).toBe('Push (10 ft)');
    expect(MASTERY_EFFECTS.Push.effect).toBe('push');
    expect(MASTERY_EFFECTS.Push.value).toBe(10);
    expect(MASTERY_EFFECTS.Push.description).toContain('Push the creature');
  });

  it('Topple has correct properties with requiresSave', () => {
    expect(MASTERY_EFFECTS.Topple.label).toBe('Topple (Prone)');
    expect(MASTERY_EFFECTS.Topple.effect).toBe('topple');
    expect(MASTERY_EFFECTS.Topple.requiresSave).toBe(true);
    expect(MASTERY_EFFECTS.Topple.saveAbility).toBe('CON');
  });

  it('Sap has correct properties', () => {
    expect(MASTERY_EFFECTS.Sap.label).toBe('Sap (Disadvantage)');
    expect(MASTERY_EFFECTS.Sap.effect).toBe('disadvantage_next_attack');
  });

  it('Slow has correct properties', () => {
    expect(MASTERY_EFFECTS.Slow.label).toBe('Slow (Speed -10 ft)');
    expect(MASTERY_EFFECTS.Slow.effect).toBe('speed_reduction');
    expect(MASTERY_EFFECTS.Slow.value).toBe(10);
  });

  it('Vex has correct properties', () => {
    expect(MASTERY_EFFECTS.Vex.label).toBe('Vex (Advantage)');
    expect(MASTERY_EFFECTS.Vex.effect).toBe('next_attack_advantage');
    expect(MASTERY_EFFECTS.Vex.value).toBe(5);
  });

  it('Cleave has correct properties', () => {
    expect(MASTERY_EFFECTS.Cleave.label).toBe('Cleave (Extra Attack)');
    expect(MASTERY_EFFECTS.Cleave.effect).toBe('cleave');
  });

  it('Nick has correct properties', () => {
    expect(MASTERY_EFFECTS.Nick.label).toBe('Nick (Extra Attack)');
    expect(MASTERY_EFFECTS.Nick.effect).toBe('nick');
  });

  it('Graze has correct properties', () => {
    expect(MASTERY_EFFECTS.Graze.label).toBe('Graze (Miss Damage)');
    expect(MASTERY_EFFECTS.Graze.effect).toBe('graze');
  });
});

// ── Tests: handle ──────────────────────────────────────────────

describe('weaponMasteryHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a modal result with type "modal"', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push', 'Topple'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
  });

  it('returns a modal result with modalName "weaponMastery"', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.modalName).toBe('weaponMastery');
  });

  it('includes action in payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.action).toBe(action);
  });

  it('includes playerStats in payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.playerStats).toBe(ps);
  });

  it('includes campaignName in payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.campaignName).toBe(campaignName);
  });

  it('includes availableMasteries from auto.masteries in payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push', 'Topple', 'Sap'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.availableMasteries).toEqual(['Push', 'Topple', 'Sap']);
  });

  it('defaults availableMasteries to empty array when auto.masteries is missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({});

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.availableMasteries).toEqual([]);
  });

  it('defaults availableMasteries to empty array when auto.masteries is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: null });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.availableMasteries).toEqual([]);
  });

  it('sets targetName to null when combat context is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBeNull();
  });

  it('sets targetName to null when getTargetFromAttacker returns null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBeNull();
  });

  it('sets targetName from combat context target when available', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    const combatContext = { targets: [{ name: 'Goblin' }] };
    damageUtils.getCombatContext.mockResolvedValue(combatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBe('Goblin');
  });

  it('calls getCombatContext with campaignName', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    await handle(action, ps, campaignName, null);

    expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
  });

  it('calls getTargetFromAttacker when combat context exists', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    const combatContext = { targets: [] };
    damageUtils.getCombatContext.mockResolvedValue(combatContext);

    await handle(action, ps, campaignName, null);

    expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith(combatContext, 'TestHero');
  });

  it('skips getTargetFromAttacker when combat context is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    await handle(action, ps, campaignName, null);

    expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
  });

  it('calls addEntry with ability_use type', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestHero',
      abilityName: 'Weapon Mastery',
      description: expect.any(String),
    });
  });

  it('addEntry description includes action name', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    await handle(action, ps, campaignName, null);

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].description).toContain('Weapon Mastery available');
  });

  it('addEntry description includes target name when available', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    await handle(action, ps, campaignName, null);

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].description).toContain('against Orc');
  });

  it('addEntry description omits target name when target is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    await handle(action, ps, campaignName, null);

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].description).toBe('Weapon Mastery available');
  });

  it('handles combat context with target that has no name property', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue({});

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBeNull();
  });

  it('handles combat context with target that has empty string name', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: '' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBeNull();
  });

  it('handles getCombatContext returning undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(undefined);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.payload.targetName).toBeNull();
  });

  it('propagates error when getCombatContext throws', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockRejectedValue(new Error('Network error'));

    await expect(handle(action, ps, campaignName, null)).rejects.toThrow('Network error');
  });

  it('handles addEntry throwing an error without crashing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ masteries: ['Push'] });

    damageUtils.getCombatContext.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.reject(new Error('Log error')));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
  });
});

// ── Tests: applyMasteryEffect ──────────────────────────────────

describe('weaponMasteryHandler.applyMasteryEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Return value structure ───────────────────────────────────

  it('returns null when masteryName is not found in MASTERY_EFFECTS', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('NonExistent', ps, campaignName, 'Goblin');

    expect(result).toBeNull();
  });

  it('returns null when masteryName is undefined', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect(undefined, ps, campaignName, 'Goblin');

    expect(result).toBeNull();
  });

  it('returns null when masteryName is an empty string', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('', ps, campaignName, 'Goblin');

    expect(result).toBeNull();
  });

  it('returns a popup result with correct structure for valid mastery', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Push', ps, campaignName, 'Goblin');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Push');
    expect(result.payload.automation.type).toBe('mastery_rider');
    expect(result.payload.automation.masteries).toEqual(['Push']);
  });

  // ── Target effects storage ───────────────────────────────────

  it('stores new effect in runtime state targetEffects', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Push', ps, campaignName, 'Goblin');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    expect(setCall[1]).toBe('targetEffects');
    expect(setCall[3]).toBe(campaignName);
  });

  it('creates new effect with correct properties for Push', async () => {
    const ps = makePlayerStats();
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    await applyMasteryEffect('Push', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    const updatedEffects = setCall[2];
    expect(updatedEffects).toHaveLength(1);
    expect(updatedEffects[0].target).toBe('Goblin');
    expect(updatedEffects[0].source).toBe('Push');
    expect(updatedEffects[0].option).toBe('Push');
    expect(updatedEffects[0].effect).toBe('push');
    expect(updatedEffects[0].value).toBe(10);
    expect(updatedEffects[0].duration).toBe('until_start_of_next_turn');
  });

  it('appends to existing stored effects', async () => {
    const ps = makePlayerStats();
    useRuntimeState.getRuntimeValue.mockReturnValue([
      { target: 'Orc', source: 'Sap', effect: 'disadvantage_next_attack' },
    ]);

    await applyMasteryEffect('Push', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    const updatedEffects = setCall[2];
    expect(updatedEffects).toHaveLength(2);
    expect(updatedEffects[0].source).toBe('Sap');
    expect(updatedEffects[1].source).toBe('Push');
  });

  it('initializes stored effects as empty array when undefined', async () => {
    const ps = makePlayerStats();
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

    await applyMasteryEffect('Push', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    const updatedEffects = setCall[2];
    expect(updatedEffects).toHaveLength(1);
  });

  it('initializes stored effects as empty array when null', async () => {
    const ps = makePlayerStats();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    await applyMasteryEffect('Push', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    const updatedEffects = setCall[2];
    expect(updatedEffects).toHaveLength(1);
  });

  // ── Mastery-specific effects ─────────────────────────────────

  it('creates effect with value null for mastery without a value (Sap)', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Sap', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    expect(setCall[2][0].value).toBeNull();
  });

  it('creates effect with value null for Cleave', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Cleave', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    expect(setCall[2][0].value).toBeNull();
  });

  it('creates effect with value null for Nick', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Nick', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    expect(setCall[2][0].value).toBeNull();
  });

  it('creates effect with value null for Graze', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Graze', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    expect(setCall[2][0].value).toBeNull();
  });

  it('creates effect with value 10 for Slow', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Slow', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    expect(setCall[2][0].value).toBe(10);
  });

  it('creates effect with value 5 for Vex', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Vex', ps, campaignName, 'Goblin');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls[0];
    expect(setCall[2][0].value).toBe(5);
  });

  // ── Save-triggered mastery (Topple) ──────────────────────────

  it('calls addEntry with save_triggered for Topple mastery', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    expect(logService.addEntry).toHaveBeenCalled();
    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].type).toBe('save_triggered');
  });

  it('calculates save DC correctly for Topple (8 + CON mod + prof)', async () => {
    const ps = makePlayerStats({
      abilities: [{ name: 'CON', bonus: 3 }],
      proficiency: 3,
    });

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].saveDc).toBe(14); // 8 + 3 + 3
  });

  it('uses CON mod of 0 when CON ability is missing', async () => {
    const ps = makePlayerStats({
      abilities: [{ name: 'STR', bonus: 3 }],
      proficiency: 2,
    });

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].saveDc).toBe(10); // 8 + 0 + 2
  });

  it('uses CON mod of 0 when abilities array is empty', async () => {
    const ps = makePlayerStats({
      abilities: [],
      proficiency: 2,
    });

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].saveDc).toBe(10); // 8 + 0 + 2
  });

  it('uses CON mod of 0 when abilities is undefined', async () => {
    const ps = makePlayerStats({
      abilities: undefined,
      proficiency: 2,
    });

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].saveDc).toBe(10); // 8 + 0 + 2
  });

  it('uses proficiency of 0 when playerStats.proficiency is missing', async () => {
    const ps = makePlayerStats({
      abilities: [{ name: 'CON', bonus: 3 }],
      proficiency: undefined,
    });

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].saveDc).toBe(11); // 8 + 3 + 0
  });

  it('uses proficiency of 0 when playerStats.proficiency is null', async () => {
    const ps = makePlayerStats({
      abilities: [{ name: 'CON', bonus: 3 }],
      proficiency: null,
    });

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].saveDc).toBe(11); // 8 + 3 + 0
  });

  it('includes saveType in addEntry for Topple', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].saveType).toBe('CON');
  });

  it('includes targetName in addEntry for Topple', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].targetName).toBe('Goblin');
  });

  it('defaults targetName to "unknown" in addEntry when null', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Topple', ps, campaignName, null);

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].targetName).toBe('unknown');
  });

  it('defaults targetName to "unknown" in addEntry when undefined', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Topple', ps, campaignName, undefined);

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].targetName).toBe('unknown');
  });

  it('description for Topple mentions "fall Prone"', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    const callArgs = logService.addEntry.mock.calls[0];
    expect(callArgs[1].description).toContain('fall Prone');
  });

  it('does not call addEntry for non-save masteries (Push)', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Push', ps, campaignName, 'Goblin');

    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('does not call addEntry for non-save masteries (Sap)', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Sap', ps, campaignName, 'Goblin');

    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('does not call addEntry for non-save masteries (Slow)', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Slow', ps, campaignName, 'Goblin');

    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('does not call addEntry for non-save masteries (Vex)', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Vex', ps, campaignName, 'Goblin');

    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('does not call addEntry for non-save masteries (Cleave)', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Cleave', ps, campaignName, 'Goblin');

    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('does not call addEntry for non-save masteries (Nick)', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Nick', ps, campaignName, 'Goblin');

    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('does not call addEntry for non-save masteries (Graze)', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('Graze', ps, campaignName, 'Goblin');

    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  // ── Description generation (buildMasteryDescription) ─────────

  it('returns correct description for Push', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Push', ps, campaignName, 'Goblin');

    expect(result.payload.description).toBe('Push applied to Goblin — pushed up to 10 ft away.');
  });

  it('returns correct description for Topple', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    expect(result.payload.description).toBe('Topple applied to Goblin — forced CON save vs Prone.');
  });

  it('returns correct description for Sap', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Sap', ps, campaignName, 'Goblin');

    expect(result.payload.description).toBe('Sap applied to Goblin — Disadvantage on next attack roll.');
  });

  it('returns correct description for Slow', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Slow', ps, campaignName, 'Goblin');

    expect(result.payload.description).toBe('Slow applied to Goblin — Speed reduced by 10 ft.');
  });

  it('returns correct description for Vex', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Vex', ps, campaignName, 'Goblin');

    expect(result.payload.description).toBe('Vex applied to Goblin — you have Advantage on next attack.');
  });

  it('returns correct description for Cleave', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Cleave', ps, campaignName, 'Goblin');

    expect(result.payload.description).toBe('Cleave — make an extra attack against a second creature within 5 ft.');
  });

  it('returns correct description for Nick', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Nick', ps, campaignName, 'Goblin');

    expect(result.payload.description).toBe('Nick — make Light weapon extra attack as part of Attack action.');
  });

  it('returns correct description for Graze', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Graze', ps, campaignName, 'Goblin');

    expect(result.payload.description).toBe('Graze — deal damage equal to ability modifier on a miss.');
  });

  it('uses "target" as default when targetName is null', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Push', ps, campaignName, null);

    expect(result.payload.description).toBe('Push applied to target — pushed up to 10 ft away.');
  });

  it('uses "target" as default when targetName is undefined', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Push', ps, campaignName, undefined);

    expect(result.payload.description).toBe('Push applied to target — pushed up to 10 ft away.');
  });

  it('uses "target" as default when targetName is empty string', async () => {
    const ps = makePlayerStats();

    const result = await applyMasteryEffect('Push', ps, campaignName, '');

    expect(result.payload.description).toBe('Push applied to target — pushed up to 10 ft away.');
  });

  // ── Edge cases ───────────────────────────────────────────────

  it('handles addEntry error for save-triggered mastery without crashing', async () => {
    const ps = makePlayerStats();
    logService.addEntry.mockReturnValue(Promise.reject(new Error('Log error')));

    const result = await applyMasteryEffect('Topple', ps, campaignName, 'Goblin');

    // Should still return the popup result despite log error
    expect(result.type).toBe('popup');
    expect(result.payload.name).toBe('Topple');
  });

  it('handles all valid mastery names', async () => {
    const ps = makePlayerStats();

    for (const masteryName of Object.keys(MASTERY_EFFECTS)) {
      const result = await applyMasteryEffect(masteryName, ps, campaignName, 'Goblin');
      expect(result).not.toBeNull();
      expect(result.type).toBe('popup');
    }
  });

  it('does not store effect when masteryName is invalid', async () => {
    const ps = makePlayerStats();

    await applyMasteryEffect('NonExistent', ps, campaignName, 'Goblin');

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});
