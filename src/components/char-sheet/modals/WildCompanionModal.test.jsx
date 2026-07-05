// @cleaned-by-ai
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

  // ── Spell slot display ──

  it('displays current / max for each spell slot level', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const rows = getSpellSlotRows();
    expect(rows[0].textContent).toContain('4 / 4');
    expect(rows[2].textContent).toContain('2 / 2');
    expect(rows[5].textContent).toContain('0 / 0');
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

  it('updates selection and button text when a different level radio is clicked', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const radios = getSpellSlotRadios();
    fireEvent.click(radios[2]);
    expect(radios[2]).toBeChecked();
    expect(screen.getByRole('button', { name: /Expend Level 3 Slot/i })).toBeInTheDocument();
  });

  it('disables expend button when a zero-slot level is selected', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const radios = getSpellSlotRadios();
    fireEvent.click(radios[5]);
    expect(radios[5]).toBeChecked();
    const button = screen.getByRole('button', { name: /Expend Level 6 Slot/i });
    expect(button).toBeDisabled();
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
  });

  it('calls onClose after expending wild shape', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Expend 1 Wild Shape/i }));
    });
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
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

  // ── Keyboard handling ──

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Null safety ──

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
      spellAbilities: baseSpellAbilities,
      _trackedResources: { wildShapeUses: { max: 2 } },
    });
    render(<WildCompanionModal {...props} />);
    expect(screen.getByText('Wild Companion')).toBeInTheDocument();
  });
});
