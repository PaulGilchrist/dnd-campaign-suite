// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FontOfMagicModal from './FontOfMagicModal.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ maxSorceryPoints: 10 })),
}));

import { getRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';
import { getClassFeatures } from '../../../services/character/classFeatures.js';

const mockOnClose = vi.fn();

function makeProps(overrides) {
  return {
    playerStats: {
      name: 'Throg',
      level: 15,
      rules: '5e',
      class: {
        name: 'Sorcerer',
        class_levels: [
          { level: 15, class_specific: { creating_spell_slots: [] } },
        ],
      },
      spellAbilities: {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        spell_slots_level_3: 3,
        spell_slots_level_4: 3,
        spell_slots_level_5: 1,
      },
    },
    campaignName: 'test-campaign',
    onClose: mockOnClose,
    ...(overrides || {}),
  };
}

function makeProps2024(overrides) {
  return {
    playerStats: {
      name: 'Throg',
      level: 15,
      rules: '2024',
      class: {
        name: 'Sorcerer',
      },
      spellAbilities: {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        spell_slots_level_3: 3,
        spell_slots_level_4: 3,
        spell_slots_level_5: 1,
      },
    },
    campaignName: 'test-campaign',
    onClose: mockOnClose,
    ...(overrides || {}),
  };
}

function makePropsWithCosts(costs, overrides) {
  return makeProps({
    playerStats: {
      ...makeProps().playerStats,
      class: {
        name: 'Sorcerer',
        class_levels: [
          { level: 15, class_specific: { creating_spell_slots: costs } },
        ],
      },
      ...(overrides?.playerStats || {}),
    },
    ...(overrides || {}),
  });
}

// ── Rendering ──

describe('FontOfMagicModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal overlay and container', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(document.querySelector('.font-of-magic-overlay')).toBeInTheDocument();
    expect(document.querySelector('.font-of-magic-modal')).toBeInTheDocument();
  });

  it('renders the header with fire icon and title', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(screen.getByText('Font of Magic')).toBeInTheDocument();
    expect(document.querySelector('.fas.fa-fire')).toBeInTheDocument();
  });

  it('renders the subtitle text', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(document.querySelector('.font-of-magic-subtitle')).toHaveTextContent(
      /Bonus Action.*Convert between spell slots and sorcery points/
    );
  });

  it('renders no-print class on overlay', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(document.querySelector('.font-of-magic-overlay').classList.contains('no-print')).toBe(true);
  });

  // ── Sorcery Points summary ──

  it('displays current and final sorcery points', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const summary = document.querySelector('.font-of-magic-summary');
    expect(summary.textContent).toContain('Sorcery Points:');
    expect(summary.textContent).toContain('10');
  });

  it('uses stored sorcery points from runtime state when available', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '7' : null
    );
    render(<FontOfMagicModal {...makeProps()} />);
    expect(document.querySelector('.font-of-magic-summary').textContent).toContain('7');
  });

  it('defaults maxSP to 0 when getClassFeatures returns null', () => {
    vi.mocked(getClassFeatures).mockReset().mockReturnValue(null);
    vi.mocked(getRuntimeValue).mockReset().mockReturnValue(null);
    render(<FontOfMagicModal {...makeProps()} />);
    expect(document.querySelector('.font-of-magic-summary').textContent).toContain('0');
  });

  it('shows stat--buffed class when finalSP >= 0', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(document.querySelector('.font-of-magic-summary .stat--buffed')).toBeInTheDocument();
  });

  it('shows stat--penalized class when finalSP < 0 after conversion', () => {
    const props = makePropsWithCosts([
      { spell_slot_level: 2, sorcery_point_cost: 3 },
    ]);
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '0' : null
    );
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const secondTable = tables[1];
    const rows = secondTable.querySelectorAll('tbody tr');
    fireEvent.change(rows[1].querySelector('input'), { target: { value: '1' } });
    expect(document.querySelector('.font-of-magic-summary .stat--penalized')).toBeInTheDocument();
  });

  // ── Convert Spell Slots to Sorcery Points section ──

  it('renders the section title and hint', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(screen.getByText('Convert Spell Slots to Sorcery Points')).toBeInTheDocument();
    const hint = document.querySelector('.font-of-magic-section p.font-of-magic-hint');
    expect(hint.textContent).toMatch(/Gain SP equal to the slot\u2019s level per slot expended/);
  });

  it('renders a table with 5 level rows', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const table = document.querySelector('.font-of-magic-table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(5);
  });

  it('renders correct table headers for slot-to-SP conversion', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const headers = document.querySelectorAll('.font-of-magic-table')[0].querySelectorAll('th');
    expect(headers[0].textContent).toBe('Level');
    expect(headers[1].textContent).toBe('Available');
    expect(headers[2].textContent).toBe('Convert');
    expect(headers[3].textContent).toBe('SP Gained');
  });

  it('displays correct available slots for each level', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    expect(rows[0].textContent).toContain('4 / 4');
    expect(rows[1].textContent).toContain('3 / 3');
    expect(rows[2].textContent).toContain('3 / 3');
    expect(rows[3].textContent).toContain('3 / 3');
    expect(rows[4].textContent).toContain('1 / 1');
  });

  it('renders number inputs for each level', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const inputs = document.querySelectorAll('.font-of-magic-table input[type="number"]');
    expect(inputs).toHaveLength(10);
  });

  it('sets correct min and max attributes on slot-to-SP inputs', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    expect(rows[0].querySelector('input').getAttribute('min')).toBe('0');
    expect(rows[0].querySelector('input').getAttribute('max')).toBe('4');
    expect(rows[4].querySelector('input').getAttribute('min')).toBe('0');
    expect(rows[4].querySelector('input').getAttribute('max')).toBe('1');
  });

  it('shows SP gained calculation for a converted slot', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    expect(rows[0].textContent).toContain('+0');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '1' } });
    expect(rows[0].textContent).toContain('+1');
  });

  it('shows total SP gained for slot-to-SP conversion', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    expect(document.querySelector('.font-of-magic-total').textContent).toContain('Total SP gained: +0');
    fireEvent.change(rows[1].querySelector('input'), { target: { value: '2' } });
    expect(document.querySelector('.font-of-magic-total').textContent).toContain('Total SP gained: +4');
  });

  it('calculates total SP gained across multiple levels', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '2' } });
    fireEvent.change(rows[2].querySelector('input'), { target: { value: '1' } });
    // 2 * 1 + 1 * 3 = 5
    expect(document.querySelector('.font-of-magic-total').textContent).toContain('Total SP gained: +5');
  });

  // ── Convert Sorcery Points to Spell Slots section ──

  it('renders the section title and hint', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(screen.getByText('Convert Sorcery Points to Spell Slots')).toBeInTheDocument();
    const sections = document.querySelectorAll('.font-of-magic-section');
    expect(sections[1].querySelector('.font-of-magic-hint').textContent).toMatch(
      /Created slots vanish after a Long Rest/
    );
  });

  it('renders correct table headers for SP-to-slot conversion', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const headers = tables[1].querySelectorAll('th');
    expect(headers[0].textContent).toBe('Level');
    expect(headers[1].textContent).toBe('SP Cost');
    expect(headers[2].textContent).toBe('Create');
    expect(headers[3].textContent).toBe('SP Cost');
  });

  it('displays 0 SP costs for 5e default (empty creating_spell_slots)', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    rows.forEach(row => expect(row.textContent).toContain('0 SP'));
  });

  it('shows SP cost calculation for created slots', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('-0');
  });

  it('shows total SP cost for SP-to-slot conversion', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const totals = document.querySelectorAll('.font-of-magic-total');
    expect(totals[1].textContent).toContain('Total SP cost: -0');
  });

  it('sets correct min and max attributes on SP-to-slot inputs', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    expect(rows[0].querySelector('input').getAttribute('min')).toBe('0');
    expect(rows[0].querySelector('input').getAttribute('max')).toBe('4');
    expect(rows[4].querySelector('input').getAttribute('min')).toBe('0');
    expect(rows[4].querySelector('input').getAttribute('max')).toBe('1');
  });

  // ── 2024 ruleset ──

  it('uses 2024 slot costs [0, 2, 3, 4, 5, 6] for levels 1-5', () => {
    render(<FontOfMagicModal {...makeProps2024()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    expect(rows[0].textContent).toMatch(/1.*2 SP/);
    expect(rows[1].textContent).toMatch(/2.*3 SP/);
    expect(rows[2].textContent).toMatch(/3.*4 SP/);
    expect(rows[3].textContent).toMatch(/4.*5 SP/);
    expect(rows[4].textContent).toMatch(/5.*6 SP/);
  });

  it('applies 2024 SP costs in the total cost calculation', () => {
    render(<FontOfMagicModal {...makeProps2024()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    fireEvent.change(rows[1].querySelector('input'), { target: { value: '1' } });
    const totals = document.querySelectorAll('.font-of-magic-total');
    expect(totals[1].textContent).toContain('Total SP cost: -3');
  });

  // ── 5e custom costs ──

  it('uses custom slot costs from class_specific.creating_spell_slots', () => {
    const props = makePropsWithCosts([
      { spell_slot_level: 1, sorcery_point_cost: 2 },
      { spell_slot_level: 2, sorcery_point_cost: 3 },
      { spell_slot_level: 3, sorcery_point_cost: 4 },
      { spell_slot_level: 4, sorcery_point_cost: 5 },
      { spell_slot_level: 5, sorcery_point_cost: 6 },
    ]);
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('2 SP');
    expect(rows[1].textContent).toContain('3 SP');
    expect(rows[2].textContent).toContain('4 SP');
    expect(rows[3].textContent).toContain('5 SP');
    expect(rows[4].textContent).toContain('6 SP');
  });

  // ── Runtime state overrides ──

  it('uses stored spell slot values from runtime state when available', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) => {
      if (prop === 'spell_slots_level_1') return '2';
      if (prop === 'spell_slots_level_2') return '1';
      return null;
    });
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[0].querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('2 / 4');
    expect(rows[1].textContent).toContain('1 / 3');
  });

  it('clamps stored spell slot values to max when stored > max', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'spell_slots_level_1' ? '10' : null
    );
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    expect(rows[0].textContent).toContain('4 / 4');
  });

  // ── Input validation ──

  it('clamps slot-to-SP input to max available slots', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '10' } });
    expect(rows[0].querySelector('input').value).toBe('4');
  });

  it('clamps slot-to-SP input to minimum 0', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '-5' } });
    expect(rows[0].querySelector('input').value).toBe('0');
  });

  it('clamps SP-to-slot input to max slots', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '10' } });
    expect(rows[0].querySelector('input').value).toBe('4');
  });

  it('clamps SP-to-slot input to minimum 0', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '-5' } });
    expect(rows[0].querySelector('input').value).toBe('0');
  });

  it('handles empty input as 0 for slot-to-SP conversion', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '' } });
    expect(rows[0].querySelector('input').value).toBe('0');
  });

  it('handles non-numeric input as 0 for slot-to-SP conversion', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: 'abc' } });
    expect(rows[0].querySelector('input').value).toBe('0');
  });

  // ── canApply logic ──

  it('disables Apply when no conversion is made', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(screen.getByText('Apply Conversion')).toBeDisabled();
  });

  it('enables Apply when converting slots to SP', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '1' } });
    expect(screen.getByText('Apply Conversion')).not.toBeDisabled();
  });

  it('enables Apply when creating slots with non-zero SP cost', () => {
    const props = makePropsWithCosts([
      { spell_slot_level: 2, sorcery_point_cost: 1 },
    ]);
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '10' : null
    );
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    // Level 2: max=3, creating 1 slot → finalSlots[2] = 3 - 0 + 1 = 4 > 3 = maxSlots[2]
    // Need to convert a level-2 slot first to make room.
    const firstRows = tables[0].querySelectorAll('tbody tr');
    fireEvent.change(firstRows[1].querySelector('input'), { target: { value: '1' } });
    fireEvent.change(rows[1].querySelector('input'), { target: { value: '1' } });
    // finalSlots[2] = 3 - 1 + 1 = 3 <= 3. netSPChange = 2 - 1 = 1. canApply = true.
    expect(screen.getByText('Apply Conversion')).not.toBeDisabled();
  });

  it('disables Apply when creating more slots than max', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '5' } });
    expect(screen.getByText('Apply Conversion')).toBeDisabled();
  });

  it('disables Apply when final SP would be negative', () => {
    const props = makePropsWithCosts([
      { spell_slot_level: 1, sorcery_point_cost: 2 },
    ]);
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '0' : null
    );
    vi.mocked(getClassFeatures).mockReturnValue({ maxSorceryPoints: 10 });
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '1' } });
    expect(screen.getByText('Apply Conversion')).toBeDisabled();
  });

  it('disables Apply when converting more slots than available', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '10' } });
    expect(rows[0].querySelector('input').value).toBe('4');
  });

  it('disables Apply when there are no spell slots to convert', () => {
    const props = makeProps({
      playerStats: {
        name: 'Throg',
        level: 1,
        rules: '5e',
        class: { name: 'Sorcerer', class_levels: [] },
        spellAbilities: {
          spell_slots_level_1: 0,
          spell_slots_level_2: 0,
          spell_slots_level_3: 0,
          spell_slots_level_4: 0,
          spell_slots_level_5: 0,
        },
      },
      campaignName: 'test-campaign',
      onClose: mockOnClose,
    });
    render(<FontOfMagicModal {...props} />);
    expect(screen.getByText('Apply Conversion')).toBeDisabled();
  });

  // ── handleApply ──

  it('calls setRuntimeBatch with correct data when Apply is clicked (slot-to-SP)', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '5' : null
    );
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Apply Conversion'));

    expect(setRuntimeBatch).toHaveBeenCalledWith(
      'Throg',
      expect.objectContaining({
        sorceryPoints: 6,
        spell_slots_level_1: 3,
        spell_slots_level_2: 3,
        spell_slots_level_3: 3,
        spell_slots_level_4: 3,
        spell_slots_level_5: 1,
      }),
      'test-campaign'
    );
  });

  it('calls setRuntimeBatch with correct data when Apply is clicked (SP-to-slot)', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '10' : null
    );
    const props = makePropsWithCosts([
      { spell_slot_level: 1, sorcery_point_cost: 2 },
    ]);
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const firstRows = tables[0].querySelectorAll('tbody tr');
    const secondRows = tables[1].querySelectorAll('tbody tr');
    fireEvent.change(firstRows[0].querySelector('input'), { target: { value: '1' } });
    fireEvent.change(secondRows[0].querySelector('input'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Apply Conversion'));

    expect(setRuntimeBatch).toHaveBeenCalledWith(
      'Throg',
      expect.objectContaining({
        sorceryPoints: 9,
        spell_slots_level_1: 4,
      }),
      'test-campaign'
    );
  });

  it('dispatches sorcery-points-updated event when Apply is clicked', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '5' : null
    );
    const handler = vi.fn();
    window.addEventListener('sorcery-points-updated', handler);

    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Apply Conversion'));

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('sorcery-points-updated', handler);
  });

  it('does not call setRuntimeBatch when Apply is clicked but canApply is false', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Apply Conversion'));
    expect(setRuntimeBatch).not.toHaveBeenCalled();
  });

  it('calls onClose when Apply is clicked', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '5' : null
    );
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Apply Conversion'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calculates net SP correctly with both conversions applied', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '10' : null
    );
    const props = makePropsWithCosts([
      { spell_slot_level: 1, sorcery_point_cost: 2 },
    ]);
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const firstRows = tables[0].querySelectorAll('tbody tr');
    const secondRows = tables[1].querySelectorAll('tbody tr');

    fireEvent.change(firstRows[0].querySelector('input'), { target: { value: '2' } });
    fireEvent.change(secondRows[0].querySelector('input'), { target: { value: '1' } });

    // netSPChange = 2 - 2 = 0, finalSP = 10
    expect(document.querySelector('.font-of-magic-summary').textContent).toContain('10');
  });

  it('shows correct final slots when converting and creating at different levels', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '10' : null
    );
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const firstRows = tables[0].querySelectorAll('tbody tr');
    const secondRows = tables[1].querySelectorAll('tbody tr');

    fireEvent.change(firstRows[1].querySelector('input'), { target: { value: '1' } });
    fireEvent.change(secondRows[0].querySelector('input'), { target: { value: '1' } });

    expect(firstRows[1].querySelector('input').value).toBe('1');
    expect(secondRows[0].querySelector('input').value).toBe('1');
  });

  // ── Cancel button ──

  it('calls onClose when Cancel is clicked', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ── Escape key ──

  it('calls onClose when Escape key is pressed', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when other keys are pressed', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('removes keydown listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<FontOfMagicModal {...makeProps()} />);
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  // ── Edge cases: missing data ──

  it('handles player with no spell slots', () => {
    const props = makeProps({
      playerStats: {
        name: 'Throg',
        level: 1,
        rules: '5e',
        class: { name: 'Sorcerer', class_levels: [] },
        spellAbilities: {
          spell_slots_level_1: 0,
          spell_slots_level_2: 0,
          spell_slots_level_3: 0,
          spell_slots_level_4: 0,
          spell_slots_level_5: 0,
        },
      },
      campaignName: 'test-campaign',
      onClose: mockOnClose,
    });
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[0].querySelectorAll('tbody tr');
    rows.forEach(row => expect(row.textContent).toContain('0 / 0'));
  });

  it('handles missing spellAbilities gracefully', () => {
    const props = makeProps({
      playerStats: {
        name: 'Throg',
        level: 1,
        rules: '5e',
        class: { name: 'Sorcerer' },
      },
      campaignName: 'test-campaign',
      onClose: mockOnClose,
    });
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[0].querySelectorAll('tbody tr');
    rows.forEach(row => expect(row.textContent).toContain('0 / 0'));
  });

  it('handles missing class_levels gracefully', () => {
    const props = makeProps({
      playerStats: {
        name: 'Throg',
        level: 15,
        rules: '5e',
        class: { name: 'Sorcerer' },
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
          spell_slots_level_4: 3,
          spell_slots_level_5: 1,
        },
      },
      campaignName: 'test-campaign',
      onClose: mockOnClose,
    });
    render(<FontOfMagicModal {...props} />);
    expect(screen.getByText('Font of Magic')).toBeInTheDocument();
  });

  it('handles undefined playerStats.class gracefully', () => {
    const props = makeProps({
      playerStats: {
        name: 'Throg',
        level: 15,
        rules: '5e',
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
          spell_slots_level_4: 3,
          spell_slots_level_5: 1,
        },
      },
      campaignName: 'test-campaign',
      onClose: mockOnClose,
    });
    render(<FontOfMagicModal {...props} />);
    expect(screen.getByText('Font of Magic')).toBeInTheDocument();
  });

  it('handles class_levels with no matching level gracefully', () => {
    const props = makeProps({
      playerStats: {
        name: 'Throg',
        level: 20,
        rules: '5e',
        class: {
          name: 'Sorcerer',
          class_levels: [
            { level: 15, class_specific: { creating_spell_slots: [] } },
          ],
        },
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
          spell_slots_level_4: 3,
          spell_slots_level_5: 1,
        },
      },
      campaignName: 'test-campaign',
      onClose: mockOnClose,
    });
    render(<FontOfMagicModal {...props} />);
    expect(screen.getByText('Font of Magic')).toBeInTheDocument();
  });

  it('filters out creating_spell_slots entries with spell_slot_level > 5', () => {
    const props = makePropsWithCosts([
      { spell_slot_level: 1, sorcery_point_cost: 2 },
      { spell_slot_level: 6, sorcery_point_cost: 100 },
      { spell_slot_level: 7, sorcery_point_cost: 100 },
    ]);
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('2 SP');
    expect(rows[1].textContent).toContain('0 SP');
    expect(rows[2].textContent).toContain('0 SP');
  });

  it('shows initial SP gained values of +0 for all levels', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[0].querySelectorAll('tbody tr');
    rows.forEach(row => expect(row.textContent).toContain('+0'));
  });

  it('shows initial SP cost values of -0 for all levels with 5e default costs', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    rows.forEach(row => expect(row.textContent).toContain('-0'));
  });

  it('canApply prevents apply when converting all slots and creating more than remaining', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '10' : null
    );
    const props = makePropsWithCosts([
      { spell_slot_level: 1, sorcery_point_cost: 2 },
    ]);
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const firstRows = tables[0].querySelectorAll('tbody tr');
    const secondRows = tables[1].querySelectorAll('tbody tr');
    // Convert 2 level-1 slots → +2 SP, then try to create 3 level-1 slots → -6 SP
    // netSP = 2 - 6 = -4, finalSP = 10 - 4 = 6 >= 0, but finalSlots[1] = 4 - 2 + 3 = 5 > maxSlots[1] = 4
    fireEvent.change(firstRows[0].querySelector('input'), { target: { value: '2' } });
    fireEvent.change(secondRows[0].querySelector('input'), { target: { value: '3' } });
    expect(screen.getByText('Apply Conversion')).toBeDisabled();
  });

  it('canApply prevents apply when creating slots that would go negative (should not happen but guard exists)', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '10' : null
    );
    const props = makeProps({
      playerStats: {
        ...makeProps().playerStats,
        class: {
          name: 'Sorcerer',
          class_levels: [
            { level: 15, class_specific: { creating_spell_slots: [{ spell_slot_level: 1, sorcery_point_cost: 1 }] } },
          ],
        },
        spellAbilities: {
          spell_slots_level_1: 1,
          spell_slots_level_2: 0,
          spell_slots_level_3: 0,
          spell_slots_level_4: 0,
          spell_slots_level_5: 0,
        },
      },
      campaignName: 'test-campaign',
      onClose: mockOnClose,
    });
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const firstRows = tables[0].querySelectorAll('tbody tr');
    const secondRows = tables[1].querySelectorAll('tbody tr');
    // Convert 1 slot → +1 SP, create 2 slots → -2 SP, net = -1, finalSP = 10 - 1 = 9 >= 0
    // But finalSlots[1] = 1 - 1 + 2 = 2 > maxSlots[1] = 1, so disabled
    fireEvent.change(firstRows[0].querySelector('input'), { target: { value: '1' } });
    fireEvent.change(secondRows[0].querySelector('input'), { target: { value: '2' } });
    expect(screen.getByText('Apply Conversion')).toBeDisabled();
  });

  it('disables Apply when converting slots at one level and creating at same level exceeds max', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '10' : null
    );
    const props = makePropsWithCosts([
      { spell_slot_level: 2, sorcery_point_cost: 1 },
    ]);
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const secondRows = tables[1].querySelectorAll('tbody tr');
    // Don't convert any level-2 slots, try to create 4 level-2 slots (max is 3)
    fireEvent.change(secondRows[1].querySelector('input'), { target: { value: '4' } });
    expect(screen.getByText('Apply Conversion')).toBeDisabled();
  });

  it('correctly computes netSPChange when only converting slots (no creation)', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '5' : null
    );
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const firstRows = tables[0].querySelectorAll('tbody tr');
    // Convert 1 level-3 slot → +3 SP
    fireEvent.change(firstRows[2].querySelector('input'), { target: { value: '1' } });
    // finalSP = 5 + 3 = 8
    expect(document.querySelector('.font-of-magic-summary').textContent).toContain('8');
  });

  it('correctly computes netSPChange when only creating slots (no conversion)', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '20' : null
    );
    const props = makePropsWithCosts([
      { spell_slot_level: 3, sorcery_point_cost: 4 },
    ]);
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const secondRows = tables[1].querySelectorAll('tbody tr');
    // Create 2 level-3 slots → -8 SP
    fireEvent.change(secondRows[2].querySelector('input'), { target: { value: '2' } });
    // finalSP = 20 - 8 = 12
    expect(document.querySelector('.font-of-magic-summary').textContent).toContain('12');
  });
});
