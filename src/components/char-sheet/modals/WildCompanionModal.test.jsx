// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WildCompanionModal from './WildCompanionModal.jsx';

// ── Mocked modules ──

const mockSetRuntimeBatch = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeBatch: (...args) => mockSetRuntimeBatch(...args),
}));

const mockAddEntry = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: (...args) => mockAddEntry(...args),
}));

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const baseSpellAbilities = {
  spell_slots_level_1: 4,
  spell_slots_level_2: 3,
  spell_slots_level_3: 2,
  spell_slots_level_4: 1,
  spell_slots_level_5: 1,
  spell_slots_level_6: 0,
  spell_slots_level_7: 0,
  spell_slots_level_8: 0,
  spell_slots_level_9: 0,
};

const basePlayerStats = {
  name: 'Druid1',
  spellAbilities: baseSpellAbilities,
  _trackedResources: {
    wildShapeUses: { max: 2 },
  },
};

const baseProps = {
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('WildCompanionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(null);
  });

  // ── Spell slot display ──

  it('displays the Wild Companion title and subtitle', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Wild Companion')).toBeInTheDocument();
    expect(
      screen.getByText('Cast Find Familiar without Material components')
    ).toBeInTheDocument();
  });

  it('displays all 9 spell slot levels with current / max values', () => {
    render(<WildCompanionModal {...makeProps()} />);
    // Check unique values across the range
    expect(screen.getByText('4 / 4')).toBeInTheDocument(); // level 1
    expect(screen.getByText('3 / 3')).toBeInTheDocument(); // level 2
    expect(screen.getByText('2 / 2')).toBeInTheDocument(); // level 3
  });

  // ── Spell slot row dimming and button state ──

  it('disables the expend button when all slot levels are zero', () => {
    const props = makeProps({
      playerStats: {
        name: 'Druid1',
        spellAbilities: {
          spell_slots_level_1: 0,
          spell_slots_level_2: 0,
          spell_slots_level_3: 0,
          spell_slots_level_4: 0,
          spell_slots_level_5: 0,
          spell_slots_level_6: 0,
          spell_slots_level_7: 0,
          spell_slots_level_8: 0,
          spell_slots_level_9: 0,
        },
        _trackedResources: { wildShapeUses: { max: 2 } },
      },
    });
    render(<WildCompanionModal {...props} />);
    expect(
      screen.getByRole('button', { name: /Expend Level 1 Slot/i })
    ).toBeDisabled();
  });

  // ── Radio selection ──

  it('updates selected level and button text when a different level radio is selected', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="wildCompanionSlotLevel"]');
    // Level 3 radio is at index 2
    fireEvent.click(radios[2]);
    expect(radios[2]).toBeChecked();
    expect(
      screen.getByRole('button', { name: /Expend Level 3 Slot/i })
    ).toBeInTheDocument();
    // Level 6 radio is at index 5 (zero slots)
    fireEvent.click(radios[5]);
    expect(radios[5]).toBeChecked();
    expect(
      screen.getByRole('button', { name: /Expend Level 6 Slot/i })
    ).toBeDisabled();
  });

  // ── Expend spell slot ──

  // CLA-388: payment + grant stamp in ONE atomic setRuntimeBatch (two sequential
  // full-store POSTs race per §6-#18) + ability_use log at confirm (CLA-359).

  it('expends the selected spell slot AND stamps the grant in one atomic batch', () => {
    render(<WildCompanionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    expect(mockSetRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { spell_slots_level_1: 3, _Wild_Companion_freeCast: ['Find Familiar'] },
      'test-campaign'
    );
  });

  it('decrements the correct level slot when a different level is selected', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="wildCompanionSlotLevel"]');
    fireEvent.click(radios[2]); // level 3
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 3 Slot/i }));
    expect(mockSetRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { spell_slots_level_3: 1, _Wild_Companion_freeCast: ['Find Familiar'] },
      'test-campaign'
    );
  });

  it('logs ability_use when expending a spell slot', () => {
    render(<WildCompanionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Druid1',
        abilityName: 'Wild Companion',
        spellName: 'Find Familiar',
        description: expect.stringContaining('expended a level 1 spell slot'),
      }));
  });

  it('calls onClose after expending a spell slot', () => {
    render(<WildCompanionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  // ── Wild Shape section ──

  it('displays the Wild Shape section heading', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Expend Wild Shape')).toBeInTheDocument();
  });

  it('shows blocked message when Wild Shape uses are exhausted', () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        _trackedResources: { wildShapeUses: { max: 0 } },
      },
    });
    render(<WildCompanionModal {...props} />);
    expect(
      screen.getByText('You have no Wild Shape uses remaining.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Expend 1 Wild Shape/i })
    ).not.toBeInTheDocument();
  });

  it('expend wild shape decrements uses AND stamps the grant in one atomic batch, logging ability_use', () => {
    render(<WildCompanionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend 1 Wild Shape/i }));
    expect(mockSetRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { wildShapeUses: 1, _Wild_Companion_freeCast: ['Find Familiar'] },
      'test-campaign'
    );
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Druid1',
        abilityName: 'Wild Companion',
        spellName: 'Find Familiar',
        description: expect.stringContaining('expended 1 Wild Shape use'),
      }));
  });

  it('calls onClose after expending wild shape', () => {
    render(<WildCompanionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend 1 Wild Shape/i }));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  // ── Runtime value overrides ──

  it('uses runtime value for spell slots when below max', () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((key, prop) => {
      if (prop === 'spell_slots_level_1') return '2';
      return null;
    });
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
  });

  it('uses runtime value for wild shape and decrements from it', () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((key, prop) => {
      if (prop === 'wildShapeUses') return '1';
      return null;
    });
    render(<WildCompanionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend 1 Wild Shape/i }));
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { wildShapeUses: 0, _Wild_Companion_freeCast: ['Find Familiar'] },
      'test-campaign'
    );
  });

  // ── Keyboard and click handling ──

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the overlay background is clicked', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.resource-pool-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Null safety ──

  it('handles playerStats with no spellAbilities property', () => {
    const props = makeProps({
      playerStats: { name: 'Druid1', _trackedResources: { wildShapeUses: { max: 2 } } },
    });
    render(<WildCompanionModal {...props} />);
    // All radios should be disabled when there are no spellAbilities
    const radios = document.querySelectorAll('input[name="wildCompanionSlotLevel"]');
    radios.forEach(radio => expect(radio).toBeDisabled());
  });

  it('handles playerStats with no _trackedResources property', () => {
    const props = makeProps({
      playerStats: { name: 'Druid1', spellAbilities: baseSpellAbilities },
    });
    render(<WildCompanionModal {...props} />);
    expect(
      screen.getByText('You have no Wild Shape uses remaining.')
    ).toBeInTheDocument();
  });
});
