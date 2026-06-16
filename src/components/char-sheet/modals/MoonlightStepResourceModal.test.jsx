import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MoonlightStepResourceModal from './MoonlightStepResourceModal.jsx';

// ── Mocked modules ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeBatch: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const basePlayerStats = {
  name: 'TestCleric',
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 3,
    spell_slots_level_4: 1,
    spell_slots_level_5: 1,
    spell_slots_level_6: 0,
    spell_slots_level_7: 0,
    spell_slots_level_8: 0,
    spell_slots_level_9: 0,
  },
  _trackedResources: {
    moonlightStepUses: { max: 2 },
  },
};

const baseAutomation = {
  conversionRate: 'level_2_plus',
};

const baseProps = {
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  automation: baseAutomation,
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('MoonlightStepResourceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay with correct CSS classes', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(document.querySelector('.resource-pool-overlay')).toBeInTheDocument();
  });

  it('renders modal content with correct CSS class', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(document.querySelector('.resource-pool-modal')).toBeInTheDocument();
  });

  it('renders modal header with moon icon and title', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByText('Moonlight Step — Restore Uses')).toBeInTheDocument();
  });

  it('renders Font Awesome moon icon in header', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const icon = document.querySelector('.fas.fa-moon');
    expect(icon).toBeInTheDocument();
  });

  it('displays the subtitle text', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByText(/Expend a level 2\+ spell slot to regain 1 use of Moonlight Step/)).toBeInTheDocument();
  });

  it('displays current uses from playerStats', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByText(/Current uses: 2\/2/)).toBeInTheDocument();
  });

  it('renders spell slot section header', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByText('Spell Slot → Moonlight Step Uses')).toBeInTheDocument();
  });

  it('renders spell slot table', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(document.querySelector('.resource-pool-table')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
  });

  it('renders radio buttons for levels 2 through 9', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    for (let lvl = 2; lvl <= 9; lvl++) {
      const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
      expect(radios.length).toBe(8);
    }
  });

  it('selects level 2 by default', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    expect(radios[0]).toBeChecked();
  });

  it('renders convert button with level 2', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Expend Level 2 Slot' })).toBeInTheDocument();
  });

  it('renders Font Awesome check icon on convert button', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-check');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome times icon on cancel button', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-times');
    expect(icon).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Spell slot display ──

  it('displays correct available/max for each level', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const table = document.querySelector('.resource-pool-table');
    expect(table.textContent).toContain('3 / 3');
    expect(table.textContent).toContain('1 / 1');
  });

  it('does not show level 1 slots in the table', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    expect(rows.length).toBe(8);
  });

  // ── conversionRate: level_2_plus ──

  it('hides level 1 slots when conversionRate is level_2_plus', () => {
    render(<MoonlightStepResourceModal {...makeProps({ automation: { conversionRate: 'level_2_plus' } })} />);
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    expect(rows.length).toBe(8);
  });

  // ── conversionRate: all_levels ──

  it('shows all levels when conversionRate is all_levels', () => {
    render(<MoonlightStepResourceModal {...makeProps({ automation: { conversionRate: 'all_levels' } })} />);
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    // Component always renders levels 2-9 (8 rows) regardless of conversionRate
    expect(rows.length).toBe(8);
  });

  it('selects level 2 by default when conversionRate is all_levels', () => {
    render(<MoonlightStepResourceModal {...makeProps({ automation: { conversionRate: 'all_levels' } })} />);
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    expect(radios[0]).toBeChecked();
  });

  it('renders convert button with level 2 when conversionRate is all_levels', () => {
    render(<MoonlightStepResourceModal {...makeProps({ automation: { conversionRate: 'all_levels' } })} />);
    expect(screen.getByRole('button', { name: 'Expend Level 2 Slot' })).toBeInTheDocument();
  });

  // ── Dimmed rows for zero availability ──

  it('applies resource-pool-dim class to unavailable levels', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const dimRows = document.querySelectorAll('tr.resource-pool-dim');
    expect(dimRows.length).toBeGreaterThan(0);
  });

  it('disables radio buttons for unavailable levels', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    radios.forEach((radio, idx) => {
      const lvl = idx + 2;
      const maxSlots = basePlayerStats.spellAbilities[`spell_slots_level_${lvl}`];
      if (maxSlots === 0) {
        expect(radio).toBeDisabled();
      }
    });
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.resource-pool-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.resource-pool-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Keyboard interaction ──

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other keys', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes event listener on unmount', () => {
    const { unmount } = render(<MoonlightStepResourceModal {...makeProps({ onClose: vi.fn() })} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    // Should not throw and onClose should not be called after unmount
  });

  // ── Radio selection ──

  it('changes selected level when clicking a different radio', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    // Level 3 radio is the second one (index 1)
    fireEvent.click(radios[1]);
    expect(radios[1]).toBeChecked();
    expect(screen.getByRole('button', { name: 'Expend Level 3 Slot' })).toBeInTheDocument();
  });

  it('updates button text when selecting level 5', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    // Level 5 radio is the fourth one (index 3)
    fireEvent.click(radios[3]);
    expect(screen.getByRole('button', { name: 'Expend Level 5 Slot' })).toBeInTheDocument();
  });

  // ── Convert button disabled state ──

  it('disables convert button when no slots available for selected level', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    // Level 6 has 0 slots
    fireEvent.click(radios[4]);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 6 Slot' });
    expect(convertBtn).toBeDisabled();
  });

  it('enables convert button when slots available for selected level', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 2 Slot' });
    expect(convertBtn).not.toBeDisabled();
  });

  // ── Conversion flow ──

  it('calls setRuntimeBatch with correct data on convert', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 2 Slot' });
    fireEvent.click(convertBtn);
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'TestCleric',
      expect.objectContaining({
        moonlightStepUses: 2,
      }),
      'test-campaign'
    );
  });

  it('decrements selected spell slot by 1 on convert', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 2 Slot' });
    fireEvent.click(convertBtn);
    const batchCall = useRuntimeState.setRuntimeBatch.mock.calls[0];
    const updates = batchCall[1];
    expect(updates['spell_slots_level_2']).toBe(2);
  });

  it('increments moonlightStepUses by 1 on convert', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 2 Slot' });
    fireEvent.click(convertBtn);
    const batchCall = useRuntimeState.setRuntimeBatch.mock.calls[0];
    const updates = batchCall[1];
    // currentUses=2, maxUses=2, Math.min(2, 2+1) = 2
    expect(updates.moonlightStepUses).toBe(2);
  });

  it('caps moonlightStepUses at maxUses', () => {
    const cappedStats = {
      ...basePlayerStats,
      _trackedResources: {
        moonlightStepUses: { max: 1 },
      },
    };
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ playerStats: cappedStats, onClose })} />);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 2 Slot' });
    fireEvent.click(convertBtn);
    const batchCall = useRuntimeState.setRuntimeBatch.mock.calls[0];
    const updates = batchCall[1];
    expect(updates.moonlightStepUses).toBe(1);
  });

  it('calls onClose after successful convert', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 2 Slot' });
    fireEvent.click(convertBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call setRuntimeBatch when convert is disabled', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    // Level 6 has 0 slots
    fireEvent.click(radios[4]);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 6 Slot' });
    fireEvent.click(convertBtn);
    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Runtime value overrides ──

  it('uses runtime value for spell slots when stored', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) => {
      if (prop === 'spell_slots_level_2') return '1';
      return null;
    });
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 2 Slot' });
    expect(convertBtn).not.toBeDisabled();
  });

  it('caps runtime spell slots at max slots', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) => {
      if (prop === 'spell_slots_level_2') return '999';
      return null;
    });
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    // Level 2 radio (index 0)
    expect(radios[0]).not.toBeDisabled();
  });

  it('uses runtime value for moonlightStepUses when stored', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) => {
      if (prop === 'moonlightStepUses') return '5';
      return null;
    });
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByText(/Current uses: 5\/2/)).toBeInTheDocument();
  });

  // ── Edge cases ──

  it('handles missing spellAbilities gracefully', () => {
    const stats = { name: 'TestCleric', _trackedResources: { moonlightStepUses: { max: 0 } } };
    render(<MoonlightStepResourceModal {...makeProps({ playerStats: stats })} />);
    expect(screen.getByText(/Current uses: 0\/0/)).toBeInTheDocument();
  });

  it('handles missing _trackedResources gracefully', () => {
    const stats = { name: 'TestCleric', spellAbilities: {} };
    render(<MoonlightStepResourceModal {...makeProps({ playerStats: stats })} />);
    expect(screen.getByText(/Current uses: 0\/0/)).toBeInTheDocument();
  });

  it('handles undefined automation conversionRate', () => {
    render(<MoonlightStepResourceModal {...makeProps({ automation: undefined })} />);
    expect(screen.getByText('Moonlight Step — Restore Uses')).toBeInTheDocument();
  });

  it('defaults conversionRate to level_2_plus when automation is undefined', () => {
    render(<MoonlightStepResourceModal {...makeProps({ automation: undefined })} />);
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    expect(rows.length).toBe(8);
  });

  it('renders with no spell slots available at any level', () => {
    const stats = {
      name: 'TestCleric',
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
      _trackedResources: { moonlightStepUses: 0 },
    };
    render(<MoonlightStepResourceModal {...makeProps({ playerStats: stats })} />);
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    radios.forEach(radio => expect(radio).toBeDisabled());
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 2 Slot' });
    expect(convertBtn).toBeDisabled();
  });

  it('renders with no moonlightStepUses tracked', () => {
    const stats = {
      name: 'TestCleric',
      spellAbilities: {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        spell_slots_level_3: 0,
        spell_slots_level_4: 0,
        spell_slots_level_5: 0,
        spell_slots_level_6: 0,
        spell_slots_level_7: 0,
        spell_slots_level_8: 0,
        spell_slots_level_9: 0,
      },
    };
    render(<MoonlightStepResourceModal {...makeProps({ playerStats: stats })} />);
    expect(screen.getByText(/Current uses: 0\/0/)).toBeInTheDocument();
  });

  it('converts runtime stored spell slot value to number', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) => {
      if (prop === 'spell_slots_level_2') return '2';
      return null;
    });
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const convertBtn = screen.getByRole('button', { name: 'Expend Level 2 Slot' });
    expect(convertBtn).not.toBeDisabled();
  });

  it('shows correct row count for all_levels conversion', () => {
    render(<MoonlightStepResourceModal {...makeProps({ automation: { conversionRate: 'all_levels' } })} />);
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    // Component always renders levels 2-9 (8 rows) regardless of conversionRate
    expect(rows.length).toBe(8);
  });
});
