// @improved-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WildCompanionModal from './WildCompanionModal.jsx';

// ── Mocked modules ──

const mockSetRuntimeBatch = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeBatch: (...args) => mockSetRuntimeBatch(...args),
}));

// ── Re-import mocked modules ──

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

function getSpellSlotRows() {
  const table = document.querySelector('.resource-pool-table');
  return table.querySelectorAll('tbody tr');
}

function getSpellSlotRadios() {
  const table = document.querySelector('.resource-pool-table');
  return table.querySelectorAll('input[type="radio"]');
}

// ── Tests ──

describe('WildCompanionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(null);
  });

  // ── Structure & initial render ──

  it('renders modal overlay and modal container', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(document.querySelector('.resource-pool-overlay')).toBeInTheDocument();
    expect(document.querySelector('.resource-pool-modal')).toBeInTheDocument();
  });

  it('renders the title and description', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Wild Companion')).toBeInTheDocument();
    expect(
      screen.getByText('Cast Find Familiar without Material components')
    ).toBeInTheDocument();
  });

  it('renders the spell slot section heading and hint', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Expend a Spell Slot')).toBeInTheDocument();
    expect(
      screen.getByText('Choose a spell slot level to expend for Find Familiar.')
    ).toBeInTheDocument();
  });

  it('renders the Wild Shape section heading and hint', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Expend Wild Shape')).toBeInTheDocument();
    expect(
      screen.getByText('Use one Wild Shape use instead of a spell slot.')
    ).toBeInTheDocument();
  });

  it('renders a cancel button', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('renders 9 spell slot rows with correct level headers', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    expect(table).toBeInTheDocument();
    const rows = getSpellSlotRows();
    expect(rows).toHaveLength(9);
    const headers = table.querySelectorAll('th');
    expect(headers[0]).toHaveTextContent('Level');
    expect(headers[1]).toHaveTextContent('Available');
    expect(headers[2]).toHaveTextContent('Select');
  });

  it('defaults to level 1 selection', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const radios = getSpellSlotRadios();
    expect(radios[0]).toBeChecked();
    expect(screen.getByRole('button', { name: /Expend Level 1 Slot/i })).toBeInTheDocument();
  });

  // ── Spell slot display ──

  it('displays current / max for each spell slot level', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const rows = getSpellSlotRows();
    expect(rows[0].textContent).toContain('1');
    expect(rows[0].textContent).toContain('4 / 4');
    expect(rows[2].textContent).toContain('3');
    expect(rows[2].textContent).toContain('2 / 2');
    expect(rows[5].textContent).toContain('6');
    expect(rows[5].textContent).toContain('0 / 0');
  });

  it('shows all rows dimmed when spell slots are at max but no runtime override', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const rows = getSpellSlotRows();
    // Row at index 5 (level 6) has 0 max slots, so it should be dimmed
    expect(rows[5]).toHaveClass('resource-pool-dim');
  });

  // ── Spell slot row dimming and radio disabled ──

  it('dims rows and disables radios for levels with zero available slots', () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        spellAbilities: {
          ...baseSpellAbilities,
          spell_slots_level_2: 0,
        },
      },
    });
    render(<WildCompanionModal {...props} />);
    const rows = getSpellSlotRows();
    const radios = getSpellSlotRadios();
    expect(rows[1]).toHaveClass('resource-pool-dim');
    expect(radios[1]).toBeDisabled();
  });

  it('dims all rows and disables expend button when all slots are zero', () => {
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
    const rows = getSpellSlotRows();
    rows.forEach(row => expect(row).toHaveClass('resource-pool-dim'));
    expect(screen.getByRole('button', { name: /Expend Level 1 Slot/i })).toBeDisabled();
  });

  it('keeps all rows enabled when all slots have available uses', () => {
    const props = makeProps({
      playerStats: {
        name: 'Druid1',
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 2,
          spell_slots_level_4: 1,
          spell_slots_level_5: 1,
          spell_slots_level_6: 1,
          spell_slots_level_7: 1,
          spell_slots_level_8: 1,
          spell_slots_level_9: 1,
        },
        _trackedResources: { wildShapeUses: { max: 2 } },
      },
    });
    render(<WildCompanionModal {...props} />);
    const rows = getSpellSlotRows();
    rows.forEach(row => expect(row).not.toHaveClass('resource-pool-dim'));
  });

  // ── Radio selection ──

  it('switches selection when a different level radio is clicked', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const radios = getSpellSlotRadios();
    fireEvent.click(radios[2]);
    expect(radios[2]).toBeChecked();
    expect(screen.getByRole('button', { name: /Expend Level 3 Slot/i })).toBeInTheDocument();
  });

  it('allows selecting level 9', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const radios = getSpellSlotRadios();
    fireEvent.click(radios[8]);
    expect(radios[8]).toBeChecked();
    expect(screen.getByRole('button', { name: /Expend Level 9 Slot/i })).toBeInTheDocument();
  });

  // ── Expend spell slot ──

  it('does not expend when the selected level has no available slots', async () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        spellAbilities: {
          ...baseSpellAbilities,
          spell_slots_level_1: 0,
        },
      },
    });
    render(<WildCompanionModal {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    });
    expect(mockSetRuntimeBatch).not.toHaveBeenCalled();
  });

  it('decrements the selected spell slot and sets freeCast when expended', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { spell_slots_level_1: 3 },
      'test-campaign'
    );
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { _Wild_Companion_freeCast: ['Find Familiar'] },
      'test-campaign'
    );
    expect(mockSetRuntimeBatch).toHaveBeenCalledTimes(2);
  });

  it('decrements the correct level slot when a different level is selected', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    const radios = getSpellSlotRadios();
    await act(async () => {
      fireEvent.click(radios[2]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Expend Level 3 Slot/i }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { spell_slots_level_3: 1 },
      'test-campaign'
    );
  });

  it('calls onClose after expending a spell slot', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    });
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the provided campaignName in setRuntimeBatch calls', async () => {
    const props = makeProps({ campaignName: 'my-campaign' });
    render(<WildCompanionModal {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.any(Object),
      'my-campaign'
    );
  });

  // ── Wild Shape section ──

  it('renders Wild Shape expend button when uses are available', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Expend 1 Wild Shape/i })).toBeInTheDocument();
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

  it('applies blocked class to the Wild Shape blocked message', () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        _trackedResources: { wildShapeUses: { max: 0 } },
      },
    });
    render(<WildCompanionModal {...props} />);
    const msg = screen.getByText('You have no Wild Shape uses remaining.');
    expect(msg).toHaveClass('resource-pool-blocked');
  });

  it('expend wild shape decrements uses and sets freeCast', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Expend 1 Wild Shape/i }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { wildShapeUses: 1 },
      'test-campaign'
    );
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { _Wild_Companion_freeCast: ['Find Familiar'] },
      'test-campaign'
    );
    expect(mockSetRuntimeBatch).toHaveBeenCalledTimes(2);
  });

  it('calls onClose after expending wild shape', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Expend 1 Wild Shape/i }));
    });
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not expend when wild shape uses are zero', async () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        _trackedResources: { wildShapeUses: { max: 0 } },
      },
    });
    render(<WildCompanionModal {...props} />);
    // The button is not rendered at all when blocked
    expect(
      screen.queryByRole('button', { name: /Expend 1 Wild Shape/i })
    ).not.toBeInTheDocument();
    expect(mockSetRuntimeBatch).not.toHaveBeenCalled();
  });

  // ── Runtime value overrides ──

  it('uses runtime value for spell slots when below max', () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((key, prop) => {
      if (prop === 'spell_slots_level_1') return '2';
      return null;
    });
    render(<WildCompanionModal {...makeProps()} />);
    const rows = getSpellSlotRows();
    expect(rows[0].textContent).toContain('2 / 4');
    vi.restoreAllMocks();
  });

  it('caps runtime spell slot value at max when runtime exceeds max', () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((key, prop) => {
      if (prop === 'spell_slots_level_1') return '10';
      return null;
    });
    render(<WildCompanionModal {...makeProps()} />);
    const rows = getSpellSlotRows();
    expect(rows[0].textContent).toContain('4 / 4');
    vi.restoreAllMocks();
  });

  it('uses runtime value for wild shape and decrements from it', () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((key, prop) => {
      if (prop === 'wildShapeUses') return '1';
      return null;
    });
    render(<WildCompanionModal {...makeProps()} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Expend 1 Wild Shape/i }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { wildShapeUses: 0 },
      'test-campaign'
    );
    vi.restoreAllMocks();
  });

  // ── Close behaviors ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.resource-pool-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.resource-pool-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Keyboard handling ──

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close for non-Escape key presses', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes the keydown listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<WildCompanionModal {...makeProps({ onClose })} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('handles playerStats with no spellAbilities property', () => {
    const props = makeProps({
      playerStats: { name: 'Druid1', _trackedResources: { wildShapeUses: { max: 2 } } },
    });
    render(<WildCompanionModal {...props} />);
    const rows = getSpellSlotRows();
    expect(rows[0].textContent).toContain('0 / 0');
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

  it('handles playerStats with no name', () => {
    const props = makeProps({
      playerStats: {
        spellAbilities: baseSpellAbilities,
        _trackedResources: { wildShapeUses: { max: 2 } },
      },
    });
    render(<WildCompanionModal {...props} />);
    expect(screen.getByText('Wild Companion')).toBeInTheDocument();
  });
});
