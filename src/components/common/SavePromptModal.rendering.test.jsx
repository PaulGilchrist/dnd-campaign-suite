// @maintained-by-ai
// @improved-by-ai
// SavePromptModal — rendering
// Static prompt-copy contract: overlay visibility, the target/ability/DC line,
// advantage & disadvantage badges, damage-outcome notes (half / none / dual
// formulas), and source attribution — including negative paths (what must NOT
// render). Queue advancement and dismissal live in .actions/.coverage, roll
// math in .rolling/.bonuses/.rerolls, evasion chooser flows in
// .cla211-leading-evasion — not re-tested here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';

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

// Test-event feeder: each button dispatches one SSE-shaped event through the
// real handleEvent the modal passes down (campaign-scoped keys, as production
// Subscriber delivers them).
vi.mock('./Subscriber.jsx', () => {
  const promptEvent = (handleEvent, testId, campaign, data) =>
    React.createElement('button', {
      'data-testid': testId,
      onClick: () => handleEvent({ key: `change-${campaign}-savePrompt-${data.targetName}`, data }),
    });
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      promptEvent(handleEvent, 'subscriber-trigger', campaignName, {
        promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
      }),
      promptEvent(handleEvent, 'subscriber-trigger-disadvantage', campaignName, {
        promptId: 'test-prompt-disadv', targetName: 'testTarget3', saveType: 'str', saveDc: 14,
        disadvantage: true, dcSuccess: 'half', sourceName: 'Fireball',
      }),
      promptEvent(handleEvent, 'subscriber-trigger-advantage', campaignName, {
        promptId: 'test-prompt-adv', targetName: 'testTarget5', saveType: 'cha', saveDc: 13,
        advantage: true, dcSuccess: 'half',
      }),
      promptEvent(handleEvent, 'subscriber-trigger-dex', campaignName, {
        promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17,
        disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame',
      }),
      promptEvent(handleEvent, 'subscriber-trigger-none-dc', campaignName, {
        promptId: 'test-prompt-none', targetName: 'testTarget4', saveType: 'wis', saveDc: 16,
        disadvantage: false, dcSuccess: 'none',
      }),
      promptEvent(handleEvent, 'subscriber-trigger-dual-damage', campaignName, {
        promptId: 'test-prompt-dual', targetName: 'testTarget6', saveType: 'dex', saveDc: 18,
        disadvantage: false, dcSuccess: 'half', sourceName: 'Smelting Charge',
        damageFormula: '2d8', damageType: 'Piercing',
        secondaryFormula: '3d8', secondaryDamageType: 'Fire',
      }),
    );
  }
  return { default: MockSubscriber };
});

// ── Re-import mocked modules ──

import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';

// ── Helpers ──

function renderModal(props = {}) {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} {...props} />
  );
}

async function openPrompt(testId = 'subscriber-trigger') {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
  return within(document.querySelector('.sp-modal'));
}

describe('SavePromptModal — rendering', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Overlay visibility ──

  it('renders nothing but the event subscriber while no save prompt is queued', () => {
    renderModal();

    // Subscriber stays wired (so a queued prompt can appear), but the dialog
    // itself must be absent until an event opens it.
    expect(screen.getByTestId('subscriber')).toBeInTheDocument();
    expect(screen.queryByText(/Saving Throw Required/)).not.toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roll Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  // ── Prompt display content ──

  it('displays the modal with target name, ability, and DC when a prompt is queued', async () => {
    renderModal();
    const modal = await openPrompt();

    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(modal.getByText('testTarget')).toBeInTheDocument();
    expect(modal.getByText('CON')).toBeInTheDocument();
    expect(modal.getByText('DC 12')).toBeInTheDocument();
    expect(modal.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
    expect(modal.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();

    // Plain prompt (no flags, no dcSuccess): no badges, no queue counter,
    // no damage notes, no source line.
    expect(modal.queryByText('(Advantage)')).not.toBeInTheDocument();
    expect(modal.queryByText('(Disadvantage)')).not.toBeInTheDocument();
    expect(modal.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
    expect(modal.queryByText(/damage/i)).not.toBeInTheDocument();
    expect(modal.queryByText(/^Source:/)).not.toBeInTheDocument();
  });

  it('shows (Disadvantage) — never (Advantage) — when the prompt requests a disadvantaged save', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-disadvantage');

    expect(modal.getByText('(Disadvantage)')).toBeInTheDocument();
    expect(modal.queryByText('(Advantage)')).not.toBeInTheDocument();
    expect(modal.getByText('STR')).toBeInTheDocument();
    expect(modal.getByText('DC 14')).toBeInTheDocument();
  });

  it('shows (Advantage) — never (Disadvantage) — when the prompt carries the advantage flag', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-advantage');

    // The prompt's own advantage:true flag labels the header even with no
    // aura/dodge/buff sources in play.
    expect(modal.getByText('(Advantage)')).toBeInTheDocument();
    expect(modal.queryByText('(Disadvantage)')).not.toBeInTheDocument();
    expect(modal.getByText('CHA')).toBeInTheDocument();
    expect(modal.getByText('DC 13')).toBeInTheDocument();
  });

  it('shows source name when provided in prompt', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-disadvantage');

    expect(modal.getByText('Source: Fireball')).toBeInTheDocument();
  });

  // ── Damage-outcome notes ──

  it('shows half damage message when dcSuccess is "half" without evasion', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-dex');

    expect(modal.getByText(/Half damage on successful save/i)).toBeInTheDocument();
    // Without evasion the wording stays the plain half note — never the
    // evasion note, never the no-damage note.
    expect(modal.queryByText(/Evasion:/i)).not.toBeInTheDocument();
    expect(modal.queryByText(/No damage on successful save/i)).not.toBeInTheDocument();
  });

  it('shows "No damage on successful save" note when dcSuccess is "none"', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-none-dc');

    expect(modal.getByText(/No damage on successful save/i)).toBeInTheDocument();
    expect(modal.queryByText(/Half damage on successful save/i)).not.toBeInTheDocument();
  });

  it('names both damage formulas for a dual-damage prompt (MA-0427)', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-dual-damage');

    expect(modal.getByText('2d8 Piercing + 3d8 Fire damage, half on a successful save')).toBeInTheDocument();
  });

  // ── Character roster shapes ──

  it.each([
    ['string names', ['testTarget', 'otherChar']],
    ['object characters', [createCharacter('testTarget'), createCharacter('otherChar')]],
    ['mixed strings and objects', ['testTarget', createCharacter('otherChar')]],
  ])('renders the queued prompt for the target only when characters contains %s', async (_label, characters) => {
    renderModal({ characters });
    const modal = await openPrompt();

    // Whatever shape the roster entries take, the modal names only the
    // creature making the save.
    expect(modal.getByText('testTarget')).toBeInTheDocument();
    expect(modal.getByText('CON')).toBeInTheDocument();
    expect(modal.getByText('DC 12')).toBeInTheDocument();
    expect(screen.queryByText('otherChar')).not.toBeInTheDocument();
  });
});
