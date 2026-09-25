// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendConcentrationResult, clearConcentrationPrompt } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { hasSaveModifier } from '../../services/combat/conditions/conditionEffects.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import ConcentrationPromptModal from './ConcentrationPromptModal.jsx';

// ── Mock dependencies ──

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendConcentrationResult: vi.fn(),
  clearConcentrationPrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveModifier: vi.fn(() => false),
}));

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const triggerProps1 = {
      'data-testid': 'subscriber-trigger',
      onClick: () =>
        handleEvent({
          key: `change-${campaignName}-concentrationPrompt-testTarget`,
          data: {
            promptId: 'test-prompt-1',
            targetName: 'testTarget',
            spellName: 'Bless',
            dc: 10,
            attackerName: 'Elarielle',
          },
        }),
    };
    const triggerProps2 = {
      'data-testid': 'subscriber-trigger-second',
      onClick: () =>
        handleEvent({
          key: `change-${campaignName}-concentrationPrompt-testTarget2`,
          data: {
            promptId: 'test-prompt-2',
            targetName: 'testTarget2',
            spellName: 'Haste',
            dc: 13,
          },
        }),
    };
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement('button', triggerProps1),
      React.createElement('button', triggerProps2),
    );
  }
  return { default: MockSubscriber };
});

// ── EventSource mock ──

const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

function setupGlobalEventSource() {
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
}

// ── Helpers ──

function createCharacter(name, saveModifiers) {
  return {
    name,
    computedStats: {
      abilities: [{ name: 'Constitution', bonus: 3 }],
    },
    saveModifiers: saveModifiers || [],
  };
}

// ── Tests ──

describe('ConcentrationPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGlobalEventSource();
    vi.mocked(rollD20).mockReturnValue(10);
    vi.mocked(hasSaveModifier).mockReturnValue(false);
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 0, sourceName: null });
    vi.mocked(getAbilitySaveBonus).mockReturnValue(3);
  });

  afterEach(() => {
    delete globalThis.EventSource;
  });

  // ── Rendering ──

  it('renders nothing when there are no prompts', () => {
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    expect(screen.queryByText(/must make a/)).not.toBeInTheDocument();
  });

  it('does not render Subscriber when EventSource is undefined', () => {
    delete globalThis.EventSource;
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    expect(screen.queryByText(/must make a/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('subscriber')).not.toBeInTheDocument();
  });

  // ── Prompt queuing ──

  it('renders the modal with prompt details when a prompt is queued via Subscriber', async () => {
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    expect(screen.getByText('testTarget')).toBeInTheDocument();
    expect(screen.getByText(/CONSTITUTION/i)).toBeInTheDocument();
    expect(screen.getByText('Bless')).toBeInTheDocument();
    expect(screen.getByText('DC 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /roll con save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('deduplicates prompts with the same promptId', async () => {
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    expect(screen.queryByText(/\(1 of 2\)/)).not.toBeInTheDocument();
  });

  it('skips duplicate prompts in queue when resolving', async () => {
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument() });
  });

  // ── Dismiss / overlay behavior ──

  it('dismisses the modal when the Dismiss button is clicked', async () => {
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => { expect(screen.queryByText(/must make a/)).not.toBeInTheDocument() });
    expect(screen.queryByText('testTarget')).not.toBeInTheDocument();
  });

  // ── Queue advancement ──

  it('advances to the next prompt when "Next Check" is clicked', async () => {
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Next Check' })).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: 'Next Check' }));
    await waitFor(() => { expect(screen.getByText(/testTarget2/)).toBeInTheDocument(); expect(screen.getByText('Haste')).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument() });
  });

  // ── Roll results ──

  it.each([
    { roll: 10, expectedMessage: /CONCENTRATION MAINTAINED/i, label: 'success when roll meets DC' },
    { roll: 1, expectedMessage: /CONCENTRATION BROKEN/i, label: 'failure when roll below DC' },
  ])('shows correct result message when $label (roll=$roll)', async ({ roll, expectedMessage }) => {
    vi.mocked(rollD20).mockReturnValue(roll);
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(screen.getByText(expectedMessage)).toBeInTheDocument() });
  });

  // ── Event dispatch ──

  it('dispatches concentration-result custom event after rolling', async () => {
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 3, sourceName: 'Paladin' });
    const eventHandler = vi.fn();
    window.addEventListener('concentration-result', eventHandler);
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[createCharacter('testTarget')]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(eventHandler).toHaveBeenCalled() });
    const eventDetail = eventHandler.mock.calls[0][0].detail;
    expect(eventDetail.promptId).toBe('test-prompt-1');
    expect(eventDetail.targetName).toBe('testTarget');
    expect(eventDetail.spellName).toBe('Bless');
    expect(eventDetail.dc).toBe(10);
    expect(eventDetail.saveBonus).toBe(6);
    expect(eventDetail.bonusDetail).toBe('(+3 aura from Paladin)');
    window.removeEventListener('concentration-result', eventHandler);
  });

  // ── API calls ──

  it('sends correct payload to sendConcentrationResult', async () => {
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(sendConcentrationResult).toHaveBeenCalled() });
    const [calledCampaignName, calledTargetName, calledData] = sendConcentrationResult.mock.calls[0];
    expect(calledCampaignName).toBe('test-campaign');
    expect(calledTargetName).toBe('testTarget');
    expect(calledData.promptId).toBe('test-prompt-1');
    expect(calledData.spellName).toBe('Bless');
    expect(calledData.dc).toBe(10);
    expect(calledData.success).toBe(true);
    expect(calledData.roll).toBe(10);
    expect(calledData.mode).toBe('normal');
    expect(calledData.rawRolls).toEqual([10]);
    expect(calledData.advantageSources).toEqual([]);
  });

  it('clears concentration prompt after rolling', async () => {
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[createCharacter('testTarget')]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(clearConcentrationPrompt).toHaveBeenCalled() });
    expect(clearConcentrationPrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
  });

  // ── Advantage / disadvantage ──

  it.each([
    {
      label: 'disadvantage from attacker',
      hasAdvantage: false,
      attackerModifiers: [{ source: 'Mage Slayer', target: 'saving_throw', condition: 'concentration_breaker', effect: 'disadvantage', abilities: ['CON'] }],
      expectedMode: 'disadvantage',
    },
    {
      label: 'advantage from save modifier',
      hasAdvantage: true,
      attackerModifiers: null,
      expectedMode: 'advantage',
    },
    {
      label: 'normal when both advantage and disadvantage apply',
      hasAdvantage: true,
      attackerModifiers: [{ source: 'Mage Slayer', target: 'saving_throw', condition: 'concentration_breaker', effect: 'disadvantage', abilities: ['CON'] }],
      expectedMode: 'normal',
    },
  ])('rolls $expectedMode when $label', async ({ hasAdvantage, attackerModifiers, expectedMode }) => {
    vi.mocked(hasSaveModifier).mockReturnValue(hasAdvantage);
    if (attackerModifiers) {
      const target = createCharacter('testTarget', []);
      const attacker = createCharacter('Elarielle', attackerModifiers);
      render(<ConcentrationPromptModal campaignName="test-campaign" characters={[target, attacker]} activeMapName={null} />);
    } else {
      render(<ConcentrationPromptModal campaignName="test-campaign" characters={[createCharacter('testTarget')]} activeMapName={null} />);
    }
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(screen.getByText(/total:/i)).toBeInTheDocument() });
    if (expectedMode !== 'normal') {
      expect(screen.getByText(new RegExp(expectedMode.toUpperCase(), 'i'))).toBeInTheDocument();
    }
  });

  // ── Starry Form buff ──

  it.each([
    { roll: 5, expectedRoll: 10, label: 'applies Starry Form buff to raise roll <= 9 to 10', expected: 10 },
    { roll: 15, expectedRoll: 15, label: 'does not modify roll > 9', expected: 15 },
  ])('Starry Form: $label', async ({ roll, expectedRoll }) => {
    vi.mocked(rollD20).mockReturnValue(roll);
    const character = { name: 'testTarget', computedStats: { abilities: [{ name: 'Constitution', bonus: 3 }], saveModifiers: [{ target: 'saving_throw', effect: 'advantage' }] }, activeBuffs: [{ name: 'Starry Form', constellation: 'Dragon' }] };
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[character]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(screen.getByText(/total:/i)).toBeInTheDocument() });
    expect(sendConcentrationResult.mock.calls[0][2].roll).toBe(expectedRoll);
  });

  // ── Result breakdown ──

  it('shows result breakdown with dice, mode badge, and breakdown text', async () => {
    vi.mocked(hasSaveModifier).mockReturnValue(true);
    vi.mocked(rollD20).mockReturnValue(7);
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[createCharacter('testTarget')]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(screen.getByText(/total:/i)).toBeInTheDocument() });
    expect(screen.getAllByText(/d20: 7/)).toHaveLength(2);
    expect(screen.getByText(/ADVANTAGE/i)).toBeInTheDocument();
    expect(screen.getByText(/d20 \(7\) \+ 3/)).toBeInTheDocument();
  });

  it('shows result breakdown with aura bonus detail', async () => {
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 2, sourceName: 'Paladin' });
    render(<ConcentrationPromptModal campaignName="test-campaign" characters={[createCharacter('testTarget')]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => { expect(screen.getByText(/must make a/)).toBeInTheDocument() });
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(screen.getByText(/total:/i)).toBeInTheDocument() });
    expect(screen.getByText(/\+ 5 \(\+2 aura from Paladin\)/)).toBeInTheDocument();
  });
});
