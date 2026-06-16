import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WildCompanionModal from './WildCompanionModal.jsx';

// ── Mocked modules ──

const mockSetRuntimeBatch = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_characterKey, _propertyName) => {
    return null;
  }),
  setRuntimeBatch: (...args) => mockSetRuntimeBatch(...args),
}));

// ── Re-import mocked modules ──

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const basePlayerStats = {
  name: 'Druid1',
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 2,
    spell_slots_level_4: 1,
    spell_slots_level_5: 1,
    spell_slots_level_6: 0,
    spell_slots_level_7: 0,
    spell_slots_level_8: 0,
    spell_slots_level_9: 0,
  },
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
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  // ── Initial render / display ──

  it('renders modal overlay with correct CSS classes', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(document.querySelector('.resource-pool-overlay')).toBeInTheDocument();
    expect(document.querySelector('.resource-pool-modal')).toBeInTheDocument();
  });

  it('renders modal header with leaf icon and title', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Wild Companion')).toBeInTheDocument();
    const icon = document.querySelector('i.fa-leaf');
    expect(icon).toBeInTheDocument();
  });

  it('renders subtitle about Find Familiar', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Cast Find Familiar without Material components')).toBeInTheDocument();
  });

  it('renders spell slot section with heading', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Expend a Spell Slot')).toBeInTheDocument();
  });

  it('renders spell slot hint text', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Choose a spell slot level to expend for Find Familiar.')).toBeInTheDocument();
  });

  it('renders Wild Shape section with heading', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Expend Wild Shape')).toBeInTheDocument();
  });

  it('renders Wild Shape hint text', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Use one Wild Shape use instead of a spell slot.')).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Font Awesome check icon on expend spell slot button', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-check');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome times icon on cancel button', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-times');
    expect(icon).toBeInTheDocument();
  });

  it('renders all 9 spell slot level rows', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    expect(table).toBeInTheDocument();
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(9);
  });

  it('renders spell slot level headers', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const headers = document.querySelectorAll('.resource-pool-table th');
    expect(headers[0]).toHaveTextContent('Level');
    expect(headers[1]).toHaveTextContent('Available');
    expect(headers[2]).toHaveTextContent('Select');
  });

  // ── Spell slot table content ──

  it('displays correct max slots for each level', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    const rows = table.querySelectorAll('tbody tr');
    // Row for level 1: "4 / 4"
    expect(rows[0].textContent).toContain('1');
    expect(rows[0].textContent).toContain('4 / 4');
    // Row for level 3: "2 / 2"
    expect(rows[2].textContent).toContain('3');
    expect(rows[2].textContent).toContain('2 / 2');
    // Row for level 6: "0 / 0"
    expect(rows[5].textContent).toContain('6');
    expect(rows[5].textContent).toContain('0 / 0');
  });

  it('selects level 1 by default', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    const radio = table.querySelectorAll('input[type="radio"]')[0];
    expect(radio).toBeChecked();
  });

  it('expend button shows selected level', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Expend Level 1 Slot' })).toBeInTheDocument();
  });

  // ── Wild Shape section ──

  it('renders Wild Shape expend button when uses available', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Expend 1 Wild Shape' })).toBeInTheDocument();
  });

  it('shows blocked message when no Wild Shape uses remaining', () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        _trackedResources: { wildShapeUses: { max: 0 } },
      },
    });
    render(<WildCompanionModal {...props} />);
    expect(screen.getByText('You have no Wild Shape uses remaining.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expend 1 Wild Shape' })).not.toBeInTheDocument();
  });

  it('displays correct current Wild Shape uses with max', () => {
    render(<WildCompanionModal {...makeProps()} />);
    // The current WS should show in the button text context or blocked message
    // With max 2 and no runtime override, current = 2
    expect(screen.getByRole('button', { name: 'Expend 1 Wild Shape' })).toBeInTheDocument();
  });

  // ── Radio button interactions ──

  it('allows selecting different spell slot levels', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    const radios = table.querySelectorAll('input[type="radio"]');
    // Click level 3 radio (index 2)
    fireEvent.click(radios[2]);
    expect(radios[2]).toBeChecked();
    expect(screen.getByRole('button', { name: 'Expend Level 3 Slot' })).toBeInTheDocument();
  });

  it('allows selecting level 9 spell slot', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    const radios = table.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[8]);
    expect(radios[8]).toBeChecked();
    expect(screen.getByRole('button', { name: 'Expend Level 9 Slot' })).toBeInTheDocument();
  });

  it('disables radio for level with no available slots', () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 0,
          spell_slots_level_3: 2,
          spell_slots_level_4: 1,
          spell_slots_level_5: 1,
          spell_slots_level_6: 0,
          spell_slots_level_7: 0,
          spell_slots_level_8: 0,
          spell_slots_level_9: 0,
        },
      },
    });
    render(<WildCompanionModal {...props} />);
    const table = document.querySelector('.resource-pool-table');
    const radios = table.querySelectorAll('input[type="radio"]');
    // Level 2 radio (index 1) should be disabled
    expect(radios[1]).toBeDisabled();
  });

  it('applies dim class to rows with no available slots', () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 0,
          spell_slots_level_3: 2,
          spell_slots_level_4: 1,
          spell_slots_level_5: 1,
          spell_slots_level_6: 0,
          spell_slots_level_7: 0,
          spell_slots_level_8: 0,
          spell_slots_level_9: 0,
        },
      },
    });
    render(<WildCompanionModal {...props} />);
    const table = document.querySelector('.resource-pool-table');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows[1]).toHaveClass('resource-pool-dim');
    expect(rows[5]).toHaveClass('resource-pool-dim');
  });

  // ── Expend spell slot button behavior ──

  it('disabled expend button when no slots available for selected level', () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        spellAbilities: {
          spell_slots_level_1: 0,
          spell_slots_level_2: 3,
          spell_slots_level_3: 2,
          spell_slots_level_4: 1,
          spell_slots_level_5: 1,
          spell_slots_level_6: 0,
          spell_slots_level_7: 0,
          spell_slots_level_8: 0,
          spell_slots_level_9: 0,
        },
      },
    });
    render(<WildCompanionModal {...props} />);
    expect(screen.getByRole('button', { name: 'Expend Level 1 Slot' })).toBeDisabled();
  });

  it('calls setRuntimeBatch with decremented spell slot on expend', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend Level 1 Slot' }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { spell_slots_level_1: 3 },
      'test-campaign'
    );
  });

  it('calls setRuntimeBatch with freeCast key on expend', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend Level 1 Slot' }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { _Wild_Companion_freeCast: ['Find Familiar'] },
      'test-campaign'
    );
  });

  it('calls onClose after expending spell slot', async () => {
    const props = makeProps({ onClose: vi.fn() });
    render(<WildCompanionModal {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend Level 1 Slot' }));
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call setRuntimeBatch when expend button is disabled', async () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        spellAbilities: {
          spell_slots_level_1: 0,
          spell_slots_level_2: 3,
          spell_slots_level_3: 2,
          spell_slots_level_4: 1,
          spell_slots_level_5: 1,
          spell_slots_level_6: 0,
          spell_slots_level_7: 0,
          spell_slots_level_8: 0,
          spell_slots_level_9: 0,
        },
      },
    });
    render(<WildCompanionModal {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend Level 1 Slot' }));
    });
    expect(mockSetRuntimeBatch).not.toHaveBeenCalled();
  });

  it('expend correct level slot when different level selected', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    const radios = table.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[2]); // level 3
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend Level 3 Slot' }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { spell_slots_level_3: 1 },
      'test-campaign'
    );
  });

  // ── Expend Wild Shape behavior ──

  it('calls setRuntimeBatch with decremented wildShapeUses on expend', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend 1 Wild Shape' }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { wildShapeUses: 1 },
      'test-campaign'
    );
  });

  it('calls setRuntimeBatch with freeCast key on wild shape expend', async () => {
    render(<WildCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend 1 Wild Shape' }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { _Wild_Companion_freeCast: ['Find Familiar'] },
      'test-campaign'
    );
  });

  it('calls onClose after expending wild shape', async () => {
    const props = makeProps({ onClose: vi.fn() });
    render(<WildCompanionModal {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend 1 Wild Shape' }));
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call setRuntimeBatch when wild shape uses are zero', async () => {
    const props = makeProps({
      playerStats: {
        ...basePlayerStats,
        _trackedResources: { wildShapeUses: { max: 0 } },
      },
    });
    render(<WildCompanionModal {...props} />);
    // Button should not be in the document at all
    expect(screen.queryByRole('button', { name: 'Expend 1 Wild Shape' })).not.toBeInTheDocument();
    expect(mockSetRuntimeBatch).not.toHaveBeenCalled();
  });

  it('respects runtime value for wild shape uses', () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((characterKey, propertyName) => {
      if (propertyName === 'wildShapeUses') return '1';
      return null;
    });
    render(<WildCompanionModal {...makeProps()} />);
    // Current should be 1 (min of stored 1 and max 2)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend 1 Wild Shape' }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { wildShapeUses: 0 },
      'test-campaign'
    );
    vi.restoreAllMocks();
  });

  // ── Runtime spell slot values ──

  it('respects runtime value for spell slots when below max', () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((characterKey, propertyName) => {
      if (propertyName === 'spell_slots_level_1') return '2';
      return null;
    });
    render(<WildCompanionModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    const rows = table.querySelectorAll('tbody tr');
    // Should show "2 / 4" (min of runtime 2 and max 4)
    expect(rows[0].textContent).toContain('2 / 4');
    vi.restoreAllMocks();
  });

  it('caps runtime value at max when runtime exceeds max', () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((characterKey, propertyName) => {
      if (propertyName === 'spell_slots_level_1') return '10';
      return null;
    });
    render(<WildCompanionModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    const rows = table.querySelectorAll('tbody tr');
    // Should show "4 / 4" (min of runtime 10 and max 4)
    expect(rows[0].textContent).toContain('4 / 4');
    vi.restoreAllMocks();
  });

  // ── Overlay click behavior ──

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

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Keyboard handling ──

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other keys', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes event listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<WildCompanionModal {...makeProps({ onClose })} />);
    unmount();
    // After unmount, pressing Escape should not call onClose
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('handles playerStats with no spellAbilities', () => {
    const props = makeProps({
      playerStats: { name: 'Druid1', _trackedResources: { wildShapeUses: { max: 2 } } },
    });
    render(<WildCompanionModal {...props} />);
    const table = document.querySelector('.resource-pool-table');
    const rows = table.querySelectorAll('tbody tr');
    // All rows should show "0 / 0"
    expect(rows[0].textContent).toContain('0 / 0');
  });

  it('handles playerStats with no _trackedResources', () => {
    const props = makeProps({
      playerStats: { name: 'Druid1', spellAbilities: basePlayerStats.spellAbilities },
    });
    render(<WildCompanionModal {...props} />);
    // Should not throw and should show blocked message for Wild Shape
    expect(screen.getByText('You have no Wild Shape uses remaining.')).toBeInTheDocument();
  });

  it('handles playerStats with no name', () => {
    const props = makeProps({
      playerStats: { spellAbilities: basePlayerStats.spellAbilities, _trackedResources: { wildShapeUses: { max: 2 } } },
    });
    render(<WildCompanionModal {...props} />);
    expect(screen.getByText('Wild Companion')).toBeInTheDocument();
  });

  it('handles all spell slots at zero', () => {
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
    const table = document.querySelector('.resource-pool-table');
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => expect(row).toHaveClass('resource-pool-dim'));
    expect(screen.getByRole('button', { name: 'Expend Level 1 Slot' })).toBeDisabled();
  });

  it('renders with all spell slots available', () => {
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
    const table = document.querySelector('.resource-pool-table');
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => expect(row).not.toHaveClass('resource-pool-dim'));
    expect(screen.getByRole('button', { name: 'Expend Level 1 Slot' })).not.toBeDisabled();
  });

  it('uses campaignName in setRuntimeBatch calls', async () => {
    const props = makeProps({ campaignName: 'my-campaign' });
    render(<WildCompanionModal {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expend Level 1 Slot' }));
    });
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith('Druid1', expect.any(Object), 'my-campaign');
  });

  it('displays "no Wild Shape uses remaining" message CSS class', () => {
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
});
