// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getAllyList } from '../../hooks/useAllySelection.js';
import * as circleOfPowerHandler from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

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
      React.createElement('button', { 'data-testid': 'subscriber-trigger', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false, isSpellDamage: true } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-second', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget2`, data: { promptId: 'test-prompt-2', targetName: 'testTarget2', saveType: 'dex', saveDc: 15, disadvantage: true, dcSuccess: 'half' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-cleared', onClick: () => handleEvent({ key: `change-${campaignName}-savePromptCleared-testTarget`, data: { promptId: 'test-prompt-1' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-disadvantage', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget3`, data: { promptId: 'test-prompt-disadv', targetName: 'testTarget3', saveType: 'str', saveDc: 14, disadvantage: true, dcSuccess: 'half', sourceName: 'Fireball' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-dex', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17, disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-none-dc', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget4`, data: { promptId: 'test-prompt-none', targetName: 'testTarget4', saveType: 'wis', saveDc: 16, disadvantage: false, dcSuccess: 'none' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-wis', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-attacker', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-attacker', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false, attackerName: 'Fiend' } }) }),
    );
  }
  return { default: MockSubscriber };
});

describe('SavePromptModal — save bonus sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(false);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
    vi.mocked(getAllyList).mockReturnValue([]);
  });
  afterEach(cleanupDefaults);

  // ── saveModifiers advantage ──

  it('grants advantage when saveModifiers has advantage against_spell condition', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(18);
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
      },
      saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
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
      expect(screen.getByText(/Advantage/)).toBeInTheDocument();
    });

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
  });

  it('does NOT grant against_spell advantage when the save is not spell-origin (CLA-324)', async () => {
    rollD20.mockReturnValueOnce(15);
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
      },
      saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    fireEvent.click(screen.getByTestId('subscriber-trigger-attacker'));

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));

    await waitFor(() => {
      expect(rollD20).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/Advantage/)).not.toBeInTheDocument();
  });

  // ── Dodge buff ──

  it.each`
    saveType                   | triggerTestId                        | expectAdvantage | expectDisadvantage | expectedRolls
    ${'DEX'}                   | ${'subscriber-trigger-dex'}          | ${true}         | ${false}           | ${2}
    ${'CON'}                   | ${'subscriber-trigger'}              | ${false}        | ${false}           | ${1}
  `('grants advantage on $saveType saves when Dodge buff is active', async ({ saveType: _, triggerTestId, expectAdvantage, expectedRolls }) => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(18);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (name === 'testTarget' && key === 'activeBuffs' && campaign === 'test-campaign') return [{ effect: 'dodge' }];
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId(triggerTestId);
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      if (expectAdvantage) {
        expect(screen.getByText(/Advantage/)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Advantage/)).not.toBeInTheDocument();
      }
    });

    expect(rollD20).toHaveBeenCalledTimes(expectedRolls);
  });

  // ── Circle of Power ──

  it.each`
    triggerTestId                        | expectAdvantage | expectDisadvantage | expectedRolls
    ${'subscriber-trigger'}              | ${true}         | ${false}           | ${2}
    ${'subscriber-trigger-disadvantage'} | ${false}        | ${true}            | ${2}
  `('grants advantage on all saves when Circle of Power is active (trigger: $triggerTestId)', async ({ triggerTestId, expectAdvantage, expectDisadvantage, expectedRolls }) => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(18);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(true);

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId(triggerTestId);
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      if (expectAdvantage) {
        expect(screen.getByText(/Advantage/)).toBeInTheDocument();
      }
      if (expectDisadvantage) {
        expect(screen.getByText(/Disadvantage/)).toBeInTheDocument();
      }
    });

    expect(rollD20).toHaveBeenCalledTimes(expectedRolls);
  });

  // ── Holy Nimbus ──

  it.each`
    attackerName | attackerType   | expectAdvantage
    ${'Fiend'}   | ${'Fiend'}     | ${true}
    ${'Goblin'}  | ${'Humanoid'}  | ${false}
  `('grants advantage when Holy Nimbus is active against $attackerType attacker', async ({ attackerName, expectAdvantage }) => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(18);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (key === 'holyNimbusActive' && campaign === 'test-campaign') return true;
      return null;
    });
    vi.mocked(getCombatSummary).mockReturnValue({
      creatures: [{ name: attackerName, type: 'npc', monsterType: attackerName === 'Fiend' ? 'Fiend' : 'Humanoid' }, { name: 'testTarget', type: 'player' }],
    });
    vi.mocked(getAllyList).mockReturnValue(['testTarget']);

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={['testAlly']}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-attacker');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      if (expectAdvantage) {
        expect(screen.getByText(/Advantage/)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Advantage/)).not.toBeInTheDocument();
      }
    });
  });

  // ── Bane ──

  it.each`
    hasBane | expectBaneLabel | expectedTotal
    ${true} | ${true}         | ${13}
    ${false}| ${false}        | ${15}
  `('applies bane penalty to save total when target has bane_penalty: $hasBane', async ({ hasBane, expectBaneLabel, expectedTotal }) => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return hasBane ? [{ target: 'testTarget', effect: 'bane_penalty' }] : [];
      return null;
    });
    vi.mocked(rollExpression).mockReturnValue({ total: 2 });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      if (expectBaneLabel) {
        expect(screen.getByText(/Bane/i)).toBeInTheDocument();
        expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Bane/i)).not.toBeInTheDocument();
      }
    });

    const resultTotal = document.querySelector('.sp-result-total strong');
    expect(resultTotal.textContent).toBe(String(expectedTotal));
  });

  // ── Bless ──

  it.each`
    hasBless | expectBlessLabel | expectedTotal
    ${true}  | ${true}          | ${19}
    ${false} | ${false}         | ${15}
  `('applies bless bonus to save total when target has bless_bonus: $hasBless', async ({ hasBless, expectBlessLabel, expectedTotal }) => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return hasBless ? [{ target: 'testTarget', effect: 'bless_bonus' }] : [];
      return null;
    });
    vi.mocked(rollExpression).mockReturnValue({ total: 4 });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      if (expectBlessLabel) {
        expect(screen.getByText(/Bless/i)).toBeInTheDocument();
        expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Bless/i)).not.toBeInTheDocument();
      }
    });

    const resultTotal = document.querySelector('.sp-result-total strong');
    expect(resultTotal.textContent).toBe(String(expectedTotal));
  });

  // ── Warding Bond ──

  it.each`
    hasSaveBonus | expectWardingBond | expectedTotal
    ${true}      | ${true}           | ${16}
    ${false}     | ${false}          | ${15}
  `('applies warding bond bonus when buff has saveBonus: $hasSaveBonus', async ({ hasSaveBonus, expectWardingBond, expectedTotal }) => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (name === 'testTarget' && key === 'activeBuffs' && campaign === 'test-campaign') return hasSaveBonus ? [{ effect: 'warding_bond', saveBonus: 1 }] : [{ effect: 'warding_bond' }];
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      if (expectWardingBond) {
        expect(screen.getByText(/Warding Bond/i)).toBeInTheDocument();
        expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Warding Bond/i)).not.toBeInTheDocument();
      }
    });

    const resultTotal = document.querySelector('.sp-result-total strong');
    expect(resultTotal.textContent).toBe(String(expectedTotal));
  });

  // ── Aura bonus with source name ──

  it('displays aura source name when computeAuraBonus returns a sourceName', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [{ target: 'testTarget', effect: 'bane_penalty' }];
      return null;
    });
    vi.mocked(rollExpression).mockReturnValue({ total: 2 });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      expect(screen.getByText(/Bane/i)).toBeInTheDocument();
    });

    // Verify the penalty is reflected in the total (15 - 2 = 13 >= 12 DC = success)
    expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
  });

  it('does not apply bane penalty when target has no bane_effect', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [];
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Bane/i)).not.toBeInTheDocument();
  });

  // ── Bless ──

  it('applies bless bonus when target has bless_bonus targetEffect', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [{ target: 'testTarget', effect: 'bless_bonus' }];
      return null;
    });
    vi.mocked(rollExpression).mockReturnValue({ total: 4 });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      expect(screen.getByText(/Bless/i)).toBeInTheDocument();
    });

    // Verify the bonus is reflected in the total (15 + 4 = 19 >= 12 DC = success)
    expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
  });

  it('does not apply bless bonus when target has no bless_effect', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [];
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Bless/i)).not.toBeInTheDocument();
  });

  // ── Warding Bond ──

  it('applies warding bond bonus when target has warding_bond buff', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (name === 'testTarget' && key === 'activeBuffs' && campaign === 'test-campaign') return [{ effect: 'warding_bond', saveBonus: 1 }];
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      expect(screen.getByText(/Warding Bond/i)).toBeInTheDocument();
    });

    // Verify the bonus is reflected in the total (15 + 1 = 16 >= 12 DC = success)
    expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
  });

  it('does not apply warding bond when buff is missing saveBonus', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (name === 'testTarget' && key === 'activeBuffs' && campaign === 'test-campaign') return [{ effect: 'warding_bond' }];
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Warding Bond/i)).not.toBeInTheDocument();
  });

  // ── Aura bonus with source name ──

  it('displays aura source name when computeAuraBonus returns a sourceName', async () => {
    rollD20.mockReturnValue(15);
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 2, sourceName: 'Aura of Protection' });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/from Aura of Protection/i)).toBeInTheDocument();
  });

  // ── Multiple bonus sources stacking ──

  it('stacks bane penalty and bless bonus in the same save', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { target: 'testTarget', effect: 'bane_penalty' },
        { target: 'testTarget', effect: 'bless_bonus' },
      ];
      return null;
    });
    vi.mocked(rollExpression).mockReturnValueOnce({ total: 2 }).mockReturnValueOnce({ total: 4 });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
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
      expect(screen.getByText(/Bane/i)).toBeInTheDocument();
      expect(screen.getByText(/Bless/i)).toBeInTheDocument();
    });

    // 15 + 0 (ability) - 2 (bane) + 4 (bless) = 17
    const resultTotal = document.querySelector('.sp-result-total strong');
    expect(resultTotal.textContent).toBe('17');
  });
});
