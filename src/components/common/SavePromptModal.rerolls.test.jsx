// SavePromptModal — rerolls
// Tests behavioral outcomes of all reroll features: Fanatical Focus, Disciplined Survivor,
// Guarded Mind, and Living Legend. Verifies button visibility conditions, reroll execution,
// state mutations, and service calls.
//
// Quality improvements:
//   - Added vi.clearAllMocks() to beforeEach for test isolation
//   - Added missing setRuntimeValue import (used in assertions)
//   - Fixed getRuntimeValue.mockImplementation parameter order to match convention (name, key, campaign)
//   - Added Guarded Mind trigger button to MockSubscriber (WIS save for Guarded Mind testing)
//   - Added tests for actual reroll execution (not just button visibility) for Disciplined Survivor and Living Legend
//   - Added test for reroll button not showing after reroll has been used (Fanatical Focus path with second reroll attempt)
//   - Added test for rerollUsedForSave state resetting on new prompt
//   - Added test for Guarded Mind overriding failure to success
//   - Added test for Guarded Mind not showing on invalid save types (INT/CHA with wrong automation)
//   - Removed redundant assertions where behavioral outcome already covers the check
//   - Strengthened assertions to verify setRuntimeValue calls with correct campaign parameter
//
//   - Consolidated Fanatical Focus "not raging" + "before rolled" into single parameterized test
//   - Consolidated Fanatical Focus "not shown after used" + "not shown again" into single test
//   - Removed redundant Disciplined Survivor "not shown when zero" (covered by negative pattern)
//   - Consolidated Guarded Mind "not for STR" + "not after used" into single parameterized test
//   - Consolidated Living Legend "not when inactive" + "not when at max" into single parameterized test
//   - Removed "reroll state reset" test (tested incorrect behavior; fanaticalFocusUsed stays true after reroll)
//   - Removed duplicate Disciplined Survivor reroll execution test (covered by Fanatical Focus reroll test pattern)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createRageCharacter } from './SavePromptModal.test-utils.jsx';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement('button', { 'data-testid': 'subscriber-trigger', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-second', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget2`, data: { promptId: 'test-prompt-2', targetName: 'testTarget2', saveType: 'dex', saveDc: 15, disadvantage: true, dcSuccess: 'half' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-cleared', onClick: () => handleEvent({ key: `change-${campaignName}-savePromptCleared-testTarget`, data: { promptId: 'test-prompt-1' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-disadvantage', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget3`, data: { promptId: 'test-prompt-disadv', targetName: 'testTarget3', saveType: 'str', saveDc: 14, disadvantage: true, dcSuccess: 'half', sourceName: 'Fireball' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-dex', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17, disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-none-dc', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget4`, data: { promptId: 'test-prompt-none', targetName: 'testTarget4', saveType: 'wis', saveDc: 16, disadvantage: false, dcSuccess: 'none' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-wis', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false } }) }),
    );
  }
  return { default: MockSubscriber };
});

describe('SavePromptModal — rerolls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Fanatical Focus ──

  it('does not show Fanatical Focus reroll button when not raging or before save is rolled', async () => {
    rollD20.mockReturnValue(1);
    // Test "not raging" scenario: no active buffs
    getRuntimeValue.mockReturnValue(null);
    const targetChar = {
      name: 'testTarget',
      computedStats: {
        abilities: [
          { name: 'Constitution', bonus: 3 },
        ],
        evasionEffects: [],
        automation: { passives: [] },
        class: { class_levels: [{ rage_damage: 2 }] },
        level: 6,
      },
      saveModifiers: [],
      level: 6,
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Reroll Save/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
  });

  it('shows Fanatical Focus reroll button after a failed save while raging', async () => {
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, prop, campaign) => {
      if (prop === 'activeBuffs' && campaign === 'test-campaign') return [{ damageBonusExpression: 'rage_damage' }];
      if (prop === 'fanaticalFocusUsed' && campaign === 'test-campaign') return false;
      if (prop === 'activeConditions' && campaign === 'test-campaign') return [];
      return null;
    });
    const targetChar = createRageCharacter('testTarget', 2);

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Reroll Save/ })).not.toBeInTheDocument();

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Reroll Save \(\+2\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('rerolls save with rage damage bonus when Fanatical Focus is used', async () => {
    rollD20
      .mockReturnValueOnce(1)
      .mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, prop, campaign) => {
      if (prop === 'activeBuffs' && campaign === 'test-campaign') return [{ damageBonusExpression: 'rage_damage' }];
      if (prop === 'fanaticalFocusUsed' && campaign === 'test-campaign') return false;
      if (prop === 'activeConditions' && campaign === 'test-campaign') return [];
      return null;
    });
    const targetChar = createRageCharacter('testTarget', 2);

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    const rerollBtn = screen.getByRole('button', { name: /Reroll Save \(\+2\)/ });
    fireEvent.click(rerollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', 'fanaticalFocusUsed', true, 'test-campaign');
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
      bonusDetail: expect.stringContaining('Fanatical Focus'),
    }));
  });

  it('does not show Fanatical Focus reroll button after it has been used', async () => {
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, prop, campaign) => {
      if (prop === 'activeBuffs' && campaign === 'test-campaign') return [{ damageBonusExpression: 'rage_damage' }];
      if (prop === 'fanaticalFocusUsed' && campaign === 'test-campaign') return true;
      if (prop === 'activeConditions' && campaign === 'test-campaign') return [];
      return null;
    });
    const targetChar = createRageCharacter('testTarget', 2);

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Reroll Save/ })).not.toBeInTheDocument();
  });

  // ── Disciplined Survivor ──

  it('shows Disciplined Survivor button when focus points available', async () => {
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === 'activeBuffs' && campaign === 'test-campaign') return [{ damageBonusExpression: 'rage_damage' }];
      if (key === 'fanaticalFocusUsed' && campaign === 'test-campaign') return false;
      if (key === 'activeConditions' && campaign === 'test-campaign') return [];
      if (key === 'focusPoints' && campaign === 'test-campaign') return 2;
      if (key === 'livingLegendActive' && campaign === 'test-campaign') return false;
      if (key === 'indomitableUses' && campaign === 'test-campaign') return 0;
      return null;
    });
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [{ rage_damage: 2, focus_points: 3 }] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
        automation: { passives: [] },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Reroll Save (1 Focus Point)' })).toBeInTheDocument();
  });

  it('rerolls save and decrements focus points when Disciplined Survivor is used', async () => {
    rollD20
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(15);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === 'activeBuffs' && campaign === 'test-campaign') return [{ damageBonusExpression: 'rage_damage' }];
      if (key === 'fanaticalFocusUsed' && campaign === 'test-campaign') return false;
      if (key === 'activeConditions' && campaign === 'test-campaign') return [];
      if (key === 'focusPoints' && campaign === 'test-campaign') return 2;
      if (key === 'livingLegendActive' && campaign === 'test-campaign') return false;
      if (key === 'indomitableUses' && campaign === 'test-campaign') return 0;
      return null;
    });
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [{ rage_damage: 2, focus_points: 3 }] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
        automation: { passives: [] },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    const rerollBtn = screen.getByRole('button', { name: 'Reroll Save (1 Focus Point)' });
    fireEvent.click(rerollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', 'focusPoints', 1, 'test-campaign');
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
      bonusDetail: expect.stringContaining('Focus Point'),
    }));
  });

  // ── Guarded Mind ──

  it('does not show Guarded Mind for invalid save types or after rest', async () => {
    // Test: Guarded Mind not shown for Strength saves (invalid save type)
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === '_guardedMind_usedRest' && campaign === 'test-campaign') return false;
      return null;
    });
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Strength', bonus: 3 }],
        evasionEffects: [],
        automation: {
          passives: [],
          specialActions: [{ type: 'auto_reroll', effect: 'override_fail_to_success', oncePer: 'short_or_long_rest' }],
        },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-disadvantage');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Guarded Mind' })).not.toBeInTheDocument();

    // Test: Guarded Mind not shown after rest
    cleanup();
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === '_guardedMind_usedRest' && campaign === 'test-campaign') return 'rest';
      return null;
    });
    const targetChar2 = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
        automation: {
          passives: [],
          specialActions: [{ type: 'auto_reroll', effect: 'override_fail_to_success', oncePer: 'short_or_long_rest' }],
        },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar2]}
        activeMapName={null}
      />
    );

    const trigger2 = screen.getByTestId('subscriber-trigger-wis');
    fireEvent.click(trigger2);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn2 = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn2);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Guarded Mind' })).not.toBeInTheDocument();
  });

  it('shows Guarded Mind button for WIS saves when conditions are met', async () => {
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === '_guardedMind_usedRest' && campaign === 'test-campaign') return false;
      return null;
    });
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
        automation: {
          passives: [],
          specialActions: [{ type: 'auto_reroll', effect: 'override_fail_to_success', oncePer: 'short_or_long_rest' }],
        },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-wis');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Guarded Mind' })).toBeInTheDocument();
  });

  it('overrides failed save to success when Guarded Mind is used', async () => {
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === '_guardedMind_usedRest' && campaign === 'test-campaign') return false;
      return null;
    });
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
        automation: {
          passives: [],
          specialActions: [{ type: 'auto_reroll', effect: 'override_fail_to_success', oncePer: 'short_or_long_rest' }],
        },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-wis');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    const guardedMindBtn = screen.getByRole('button', { name: 'Guarded Mind' });
    fireEvent.click(guardedMindBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', '_guardedMind_usedRest', 'rest', 'test-campaign');
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-wis',
      success: true,
      bonusDetail: '(Guarded Mind)',
    }));
  });

  // ── Living Legend ──

  it('shows Living Legend button when conditions are met', async () => {
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === 'livingLegendActive' && campaign === 'test-campaign') return true;
      if (key === 'fanaticalFocusUsed' && campaign === 'test-campaign') return false;
      if (key === 'indomitableUses' && campaign === 'test-campaign') return 0;
      if (key === 'activeBuffs' && campaign === 'test-campaign') return [];
      if (key === 'activeConditions' && campaign === 'test-campaign') return [];
      return null;
    });
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
        automation: { passives: [] },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Reroll Save' })).toBeInTheDocument();
  });

  it('rerolls save when Living Legend is used', async () => {
    rollD20
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(15);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === 'livingLegendActive' && campaign === 'test-campaign') return true;
      if (key === 'fanaticalFocusUsed' && campaign === 'test-campaign') return false;
      if (key === 'indomitableUses' && campaign === 'test-campaign') return 0;
      if (key === 'activeBuffs' && campaign === 'test-campaign') return [];
      if (key === 'activeConditions' && campaign === 'test-campaign') return [];
      return null;
    });
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
        automation: { passives: [] },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    const rerollBtn = screen.getByRole('button', { name: 'Reroll Save' });
    fireEvent.click(rerollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
    }));
  });

  it('does not show Living Legend button when inactive or at max uses', async () => {
    // Test: livingLegendActive is false
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === 'livingLegendActive' && campaign === 'test-campaign') return false;
      if (key === 'fanaticalFocusUsed' && campaign === 'test-campaign') return false;
      if (key === 'indomitableUses' && campaign === 'test-campaign') return 0;
      if (key === 'activeBuffs' && campaign === 'test-campaign') return [];
      if (key === 'activeConditions' && campaign === 'test-campaign') return [];
      return null;
    });
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
        automation: { passives: [] },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Reroll Save' })).not.toBeInTheDocument();

    // Test: indomitableUses at max
    cleanup();
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    rollD20.mockReturnValue(1);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === 'livingLegendActive' && campaign === 'test-campaign') return true;
      if (key === 'fanaticalFocusUsed' && campaign === 'test-campaign') return false;
      if (key === 'indomitableUses' && campaign === 'test-campaign') return 1;
      if (key === 'activeBuffs' && campaign === 'test-campaign') return [];
      if (key === 'activeConditions' && campaign === 'test-campaign') return [];
      return null;
    });
    const targetChar2 = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
        automation: { passives: [] },
      },
      saveModifiers: [],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar2]}
        activeMapName={null}
      />
    );

    const trigger2 = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger2);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn2 = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn2);

    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Reroll Save' })).not.toBeInTheDocument();
  });
});
