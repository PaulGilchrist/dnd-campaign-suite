// @maintained-by-ai
// @improved-by-ai
// ConcentrationPromptModal — Holy Aura concentration advantage (SP-067)
// "Advantage on all saving throws" includes concentration checks for aura targets.
//
// Wiring test: the REAL getHolyAuraSaveAdvantage selector and the REAL
// concentration roll run here — only the runtime-store read (SSE-backed data),
// the dice, the network send, and the Aura of Protection / Subscriber seams are
// stubbed. The advantage must be driven by an actual `holy_aura` targetEffect
// in the campaign store, never derived from the prompt's spellName.
// Selector-level matching is unit-tested in savePromptUtils.test.js; queue,
// dismiss, and plain-roll payload behavior live in ConcentrationPromptModal.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConcentrationPromptModal from './ConcentrationPromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendConcentrationResult } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';

const CAMPAIGN = 'test-campaign';
const ROLLER = 'testTarget';

// Test-controlled campaign targetEffects (the source of truth the real
// savePromptUtils/targetEffectDefinitions selectors read through getRuntimeValue).
let targetEffects = [];

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_characterKey, propertyName) =>
    propertyName === 'targetEffects' ? targetEffects : null),
  setRuntimeValue: vi.fn(),
}));

// Dice stubbed for determinism; full roll semantics tested in the main suite.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

// Network boundary.
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendConcentrationResult: vi.fn(),
  clearConcentrationPrompt: vi.fn(),
}));

// Aura of Protection is orthogonal to SP-067 (covered in ConcentrationPromptModal.test.jsx);
// pinned neutral here so protection-aura stacking can't mask advantage behavior.
vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// SSE seam: injects concentration prompts, mirroring ConcentrationPromptModal.test.jsx.
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber' },
      React.createElement('button', {
        'data-testid': 'subscriber-trigger',
        onClick: () => handleEvent({
          key: `change-${campaignName}-concentrationPrompt-${ROLLER}`,
          data: { promptId: 'test-prompt-1', targetName: ROLLER, spellName: 'Holy Aura', dc: 10, attackerName: 'Goblin 1' },
        }),
      }),
    );
  }
  return { default: MockSubscriber };
});

const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

function makeRoller(conSaveBonus = 3) {
  return {
    name: ROLLER,
    computedStats: { abilities: [{ name: 'Constitution', save: conSaveBonus }] },
  };
}

function makeBreakerAttacker() {
  return {
    name: 'Goblin 1',
    saveModifiers: [{ source: 'Mage Slayer', target: 'saving_throw', condition: 'concentration_breaker', effect: 'disadvantage', abilities: ['CON'] }],
  };
}

async function openPrompt(characters = []) {
  render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={characters} activeMapName={null} />);
  fireEvent.click(screen.getByTestId('subscriber-trigger'));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

describe('ConcentrationPromptModal — Holy Aura concentration advantage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    targetEffects = [];
    Object.defineProperty(globalThis, 'EventSource', { value: MockEventSource, writable: true, configurable: true });
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 0, sourceName: null });
  });

  afterEach(() => {
    delete globalThis.EventSource;
  });

  it('rolls 2d20 keep-highest when the roller carries a holy_aura targetEffect', async () => {
    targetEffects = [{ target: ROLLER, effect: 'holy_aura', source: 'Cleric 1' }];
    rollD20.mockReturnValueOnce(4).mockReturnValueOnce(17);

    await openPrompt([makeRoller(3)]);

    fireEvent.click(screen.getByRole('button', { name: /Roll Con Save/i }));

    await waitFor(() => {
      expect(screen.getByText(/CONCENTRATION MAINTAINED/)).toBeInTheDocument();
    });

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(screen.getByText('ADVANTAGE')).toBeInTheDocument();
    expect(screen.getByText(/d20: 17 \(kept\)/)).toBeInTheDocument();
    expect(screen.getByText(/d20: 4 \(discarded\)/)).toBeInTheDocument();
    // roll 17 kept + CON save +3 vs DC 10 → maintained, attributed to Holy Aura.
    expect(sendConcentrationResult).toHaveBeenCalledWith(
      CAMPAIGN,
      ROLLER,
      expect.objectContaining({
        promptId: 'test-prompt-1',
        mode: 'advantage',
        rawRolls: [4, 17],
        roll: 17,
        total: 20,
        success: true,
        advantageSources: ['Holy Aura'],
      })
    );
  });

  it.each([
    {
      label: 'no targetEffects at all',
      effects: [],
    },
    {
      label: 'holy_aura targets a different creature',
      effects: [{ target: 'Ally 1', effect: 'holy_aura', source: 'Cleric 1' }],
    },
  ])('rolls a single plain d20 when $label — advantage is te-driven, never spellName-driven', async ({ effects }) => {
    targetEffects = effects;
    rollD20.mockReturnValue(13);

    await openPrompt([makeRoller(3)]);

    fireEvent.click(screen.getByRole('button', { name: /Roll Con Save/i }));

    await waitFor(() => {
      expect(screen.getByText(/CONCENTRATION MAINTAINED/)).toBeInTheDocument();
    });

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('ADVANTAGE')).not.toBeInTheDocument();
    expect(sendConcentrationResult).toHaveBeenCalledWith(
      CAMPAIGN,
      ROLLER,
      expect.objectContaining({
        mode: 'normal',
        rawRolls: [13],
        roll: 13,
        advantageSources: [],
      })
    );
  });

  it('cancels holy_aura advantage with concentration disadvantage into a single normal d20', async () => {
    targetEffects = [{ target: ROLLER, effect: 'holy_aura', source: 'Cleric 1' }];
    rollD20.mockReturnValue(13);

    await openPrompt([makeRoller(3), makeBreakerAttacker()]);

    fireEvent.click(screen.getByRole('button', { name: /Roll Con Save/i }));

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    // RAW: advantage and disadvantage offset — one die, no mode badge.
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('ADVANTAGE')).not.toBeInTheDocument();
    expect(screen.queryByText('DISADVANTAGE')).not.toBeInTheDocument();
    expect(sendConcentrationResult).toHaveBeenCalledWith(
      CAMPAIGN,
      ROLLER,
      expect.objectContaining({
        mode: 'normal',
        rawRolls: [13],
        roll: 13,
      })
    );
  });

  it('keeps the highest die but reports BROKEN when the advantage roll still misses the DC', async () => {
    targetEffects = [{ target: ROLLER, effect: 'holy_aura', source: 'Cleric 1' }];
    rollD20.mockReturnValueOnce(3).mockReturnValueOnce(8);

    await openPrompt();

    fireEvent.click(screen.getByRole('button', { name: /Roll Con Save/i }));

    await waitFor(() => {
      expect(screen.getByText(/CONCENTRATION BROKEN/)).toBeInTheDocument();
    });

    // keep-highest is still applied on failure (8 beats 3), and the loss is sent upstream.
    expect(screen.getByText(/d20: 8 \(kept\)/)).toBeInTheDocument();
    expect(screen.getByText(/d20: 3 \(discarded\)/)).toBeInTheDocument();
    expect(sendConcentrationResult).toHaveBeenCalledWith(
      CAMPAIGN,
      ROLLER,
      expect.objectContaining({
        mode: 'advantage',
        rawRolls: [3, 8],
        roll: 8,
        total: 8,
        success: false,
        advantageSources: ['Holy Aura'],
      })
    );
  });
});
