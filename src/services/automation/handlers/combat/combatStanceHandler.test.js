import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../buffs/tempHpBuffHandler.js', () => ({
  grantTempHpOnRage: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  clearExtendedFlag: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

import { handle, applyStanceOption } from './combatStanceHandler.js';

import * as useRuntimeState from '../../../../hooks/useRuntimeState.js';
import * as tempHpBuffHandler from '../buffs/tempHpBuffHandler.js';
import * as tempTeleportHandler from '../class-warlock/tempTeleportHandler.js';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'Barbarian',
    level: 3,
    class: {
      name: 'Barbarian',
      class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
    },
    automation: {},
    armorClassFormula: '',
    ...overrides,
  };
}

function makeAction(automation = {}, actionOverrides = {}) {
  return {
    name: 'Rage',
    automation: {
      type: 'combat_stance',
      effect: 'stance',
      duration: '10_minutes',
      resistanceTypes: [],
      advantages: [],
      damageBonusExpression: '',
      blocksSpellcasting: false,
      options: [],
      uses: 0,
      resourceKey: null,
      flySpeed: null,
      reactionSave: null,
      ...automation,
    },
    ...actionOverrides,
  };
}

const campaignName = 'TestCampaign';

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear().mockReset();
  useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
  tempHpBuffHandler.grantTempHpOnRage.mockClear().mockReset();
  tempTeleportHandler.clearExtendedFlag.mockClear().mockReset();
}

// ── resolveResistanceTypes (tested via public paths) ──────────

describe('resolveResistanceTypes', () => {
  beforeEach(() => resetMocks());

  it('expands "all_except_force_necrotic_psychic_radiant" into the full list', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(1); // all reads return 1 > 0

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');
    expect(result.type).toBe('popup');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeBuffs' && Array.isArray(c[2])
    );
    expect(setCall).toBeDefined();
    const rageBuff = setCall[2].find(b => b.name === 'Rage');
    expect(rageBuff.resistanceTypes).toEqual([
      'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
      'piercing', 'poison', 'slashing', 'thunder',
    ]);
  });

  it('leaves individual resistance types unchanged', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Custom', resistanceTypes: ['acid', 'fire'] }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(1);

    await applyStanceOption(action, ps, campaignName, 'Custom');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeBuffs' && Array.isArray(c[2])
    );
    expect(setCall).toBeDefined();
    expect(setCall[2][0].resistanceTypes).toEqual(['acid', 'fire']);
  });

  it('handles mixed special + individual types via flatMap', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Mixed', resistanceTypes: ['all_except_force_necrotic_psychic_radiant', 'necrotic'] }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(1);

    await applyStanceOption(action, ps, campaignName, 'Mixed');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeBuffs' && Array.isArray(c[2])
    );
    expect(setCall[2][0].resistanceTypes).toContain('necrotic');
    expect(setCall[2][0].resistanceTypes.length).toBe(10); // 9 expanded + necrotic
  });
});

// ── handle() ───────────────────────────────────────────────────

describe('handle', () => {
  beforeEach(() => resetMocks());

  describe('toggle off — stance already active', () => {
    it('removes the stance from activeBuffs and returns popup', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

      useRuntimeState.getRuntimeValue.mockReturnValueOnce([
        { name: 'Rage', effect: 'stance' },
        { name: 'Shield' },
      ]);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Rage ended');
      expect(result.payload.name).toBe('Rage');

      const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        c => c[1] === 'activeBuffs'
      );
      expect(setCall).toBeDefined();
      expect(setCall[2]).toEqual([{ name: 'Shield' }]);
    });

    it('clears extended teleport flag when deactivating Rage', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

      useRuntimeState.getRuntimeValue.mockReturnValueOnce([{ name: 'Rage' }]);

      await handle(action, ps, campaignName);

      expect(tempTeleportHandler.clearExtendedFlag).toHaveBeenCalledWith('Barbarian', campaignName);
    });

    it('does NOT clear extended flag when deactivating non-Rage stance', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({}, { name: 'Second Wind' });

      useRuntimeState.getRuntimeValue.mockReturnValueOnce([{ name: 'Second Wind' }]);

      await handle(action, ps, campaignName);

      expect(tempTeleportHandler.clearExtendedFlag).not.toHaveBeenCalled();
    });

    it('handles activeBuffs stored as non-array (treated as [])', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({}, { name: 'Some Stance' });

      useRuntimeState.getRuntimeValue.mockReturnValueOnce(null); // not an array → []

      // No match for "Some Stance" in empty-fallback → proceeds to activation.
      // uses=0, no options → resource path with default ragePoints.
      useRuntimeState.getRuntimeValue.mockReturnValue(1); // ragePoints > 0

      await handle(action, ps, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
    });

    it('returns correct payload structure on deactivation', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      useRuntimeState.getRuntimeValue.mockReturnValueOnce([{ name: 'Rage' }]);

      const result = await handle(action, ps, campaignName);

      expect(result.payload).toMatchObject({
        type: 'automation_info',
        name: 'Rage',
        automationType: 'combat_stance',
        description: 'Rage ended',
        automation: action.automation,
      });
    });
  });

  describe('options present — returns modal', () => {
    it('returns modal when options array has items and stance not active', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({
        uses: 0, resourceKey: 'ragePoints',
        options: [{ name: 'Bear' }, { name: 'Eagle' }],
      });

      useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // Rage not active

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('combatStance');
      expect(result.payload).toEqual({ action, playerStats: ps, campaignName });
    });

    it('does not activate stance when options exist — even with uses configured', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({
        uses: 3,
        options: [{ name: 'OnlyOption' }],
      });

      useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('modal');
    });
  });

  describe('no options and not active — activates directly', () => {
    it('calls activateStance with null option when no options present (resource path)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

      useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
      useRuntimeState.getRuntimeValue.mockReturnValue(1); // ragePoints > 0

      await handle(action, ps, campaignName);

      const ragePtsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        c => c[1] === 'ragePoints' && c[2] === 0
      );
      expect(ragePtsCall).toBeDefined();
    });

    it('uses default ragePoints resourceKey when uses=0 and no custom key', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses: 0 }); // no resourceKey → defaults to 'ragePoints'

      useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
      useRuntimeState.getRuntimeValue.mockReturnValue(2); // ragePoints=2 > 0

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Barbarian', 'ragePoints', 1, campaignName
      );
    });
  });
});

// ── applyStanceOption() ────────────────────────────────────────

describe('applyStanceOption', () => {
  beforeEach(() => resetMocks());

  it('returns popup with "Invalid option" when optionName not found', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

    const result = await applyStanceOption(action, ps, campaignName, 'NonExistent');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Invalid option: NonExistent');
    expect(result.payload.name).toBe('Rage');
  });

  it('activates stance when valid option name provided', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

    useRuntimeState.getRuntimeValue.mockReturnValue(1); // ragePoints > 0

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Bear chosen');
  });

  it('returns invalid option popup when options array is empty', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' }); // no options on action

    useRuntimeState.getRuntimeValue.mockReturnValue(1);

    const result = await applyStanceOption(action, ps, campaignName, 'Ghost');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Invalid option: Ghost');
  });
});
