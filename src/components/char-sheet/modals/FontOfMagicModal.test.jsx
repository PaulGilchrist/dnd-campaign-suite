// @cleaned-by-ai
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

  it('renders the modal overlay, header, and subtitle', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(document.querySelector('.font-of-magic-overlay')).toBeInTheDocument();
    expect(document.querySelector('.font-of-magic-overlay').classList.contains('no-print')).toBe(true);
    expect(document.querySelector('.font-of-magic-modal')).toBeInTheDocument();
    expect(screen.getByText('Font of Magic')).toBeInTheDocument();
    expect(document.querySelector('.fas.fa-fire')).toBeInTheDocument();
    expect(document.querySelector('.font-of-magic-subtitle')).toHaveTextContent(
      /Bonus Action.*Convert between spell slots and sorcery points/
    );
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

  it('renders the section title, hint, and table headers', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(screen.getByText('Convert Spell Slots to Sorcery Points')).toBeInTheDocument();
    const hint = document.querySelector('.font-of-magic-section p.font-of-magic-hint');
    expect(hint.textContent).toMatch(/Gain SP equal to the slot\u2019s level per slot expended/);
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

  it('calculates SP gained per level and total across levels', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    expect(rows[0].textContent).toContain('+0');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '1' } });
    expect(rows[0].textContent).toContain('+1');
    expect(document.querySelector('.font-of-magic-total').textContent).toContain('Total SP gained: +1');
    fireEvent.change(rows[2].querySelector('input'), { target: { value: '1' } });
    expect(document.querySelector('.font-of-magic-total').textContent).toContain('Total SP gained: +4');
  });

  // ── Convert Sorcery Points to Spell Slots section ──

  it('renders the section title, hint, and table headers', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(screen.getByText('Convert Sorcery Points to Spell Slots')).toBeInTheDocument();
    const sections = document.querySelectorAll('.font-of-magic-section');
    expect(sections[1].querySelector('.font-of-magic-hint').textContent).toMatch(
      /Created slots vanish after a Long Rest/
    );
    const tables = document.querySelectorAll('.font-of-magic-table');
    const headers = tables[1].querySelectorAll('th');
    expect(headers[0].textContent).toBe('Level');
    expect(headers[1].textContent).toBe('SP Cost');
    expect(headers[2].textContent).toBe('Create');
    expect(headers[3].textContent).toBe('SP Cost');
  });

  it('displays SP costs per level and total cost', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    rows.forEach(row => expect(row.textContent).toContain('0 SP'));
    expect(rows[0].textContent).toContain('-0');
    const totals = document.querySelectorAll('.font-of-magic-total');
    expect(totals[1].textContent).toContain('Total SP cost: -0');
  });

  // ── 2024 ruleset ──

  it('uses 2024 slot costs [0, 2, 3, 4, 5, 6] for levels 1-5 and applies them in totals', () => {
    render(<FontOfMagicModal {...makeProps2024()} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[1].querySelectorAll('tbody tr');
    expect(rows[0].textContent).toMatch(/1.*2 SP/);
    expect(rows[1].textContent).toMatch(/2.*3 SP/);
    expect(rows[2].textContent).toMatch(/3.*4 SP/);
    expect(rows[3].textContent).toMatch(/4.*5 SP/);
    expect(rows[4].textContent).toMatch(/5.*6 SP/);
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

  it('uses stored spell slot values from runtime state and clamps stored > max', () => {
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

  it('clamps inputs to [0, max] and handles empty/non-numeric input', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    const tables = document.querySelectorAll('.font-of-magic-table');
    const secondRows = tables[1].querySelectorAll('tbody tr');

    // slot-to-SP: clamp to max
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '10' } });
    expect(rows[0].querySelector('input').value).toBe('4');
    // slot-to-SP: clamp to min
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '-5' } });
    expect(rows[0].querySelector('input').value).toBe('0');
    // slot-to-SP: empty → 0
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '' } });
    expect(rows[0].querySelector('input').value).toBe('0');
    // slot-to-SP: non-numeric → 0
    fireEvent.change(rows[0].querySelector('input'), { target: { value: 'abc' } });
    expect(rows[0].querySelector('input').value).toBe('0');
    // SP-to-slot: clamp to max
    fireEvent.change(secondRows[0].querySelector('input'), { target: { value: '10' } });
    expect(secondRows[0].querySelector('input').value).toBe('4');
    // SP-to-slot: clamp to min
    fireEvent.change(secondRows[0].querySelector('input'), { target: { value: '-5' } });
    expect(secondRows[0].querySelector('input').value).toBe('0');
  });

  // ── canApply logic ──

  it('disables Apply initially and enables when converting slots to SP', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect(screen.getByText('Apply Conversion')).toBeDisabled();
    const rows = document.querySelectorAll('.font-of-magic-table tbody tr');
    fireEvent.change(rows[0].querySelector('input'), { target: { value: '1' } });
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

  it('disables Apply when converting at one level and creating at same level exceeds max', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '10' : null
    );
    const props = makePropsWithCosts([
      { spell_slot_level: 2, sorcery_point_cost: 1 },
    ]);
    render(<FontOfMagicModal {...props} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const secondRows = tables[1].querySelectorAll('tbody tr');
    fireEvent.change(secondRows[1].querySelector('input'), { target: { value: '4' } });
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

  it('does not call setRuntimeBatch or onClose when Apply is clicked but canApply is false', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Apply Conversion'));
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
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

  // ── Cancel / Escape ──

  it('calls onClose when Cancel is clicked', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ── Edge cases: missing data ──

  it('handles missing spellAbilities, class_levels, class, or no slots gracefully', () => {
    const scenarios = [
      {
        name: 'missing spellAbilities',
        playerStats: { name: 'Throg', level: 1, rules: '5e', class: { name: 'Sorcerer' } },
      },
      {
        name: 'missing class_levels',
        playerStats: { name: 'Throg', level: 15, rules: '5e', class: { name: 'Sorcerer' }, spellAbilities: { spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spell_slots_level_4: 3, spell_slots_level_5: 1 } },
      },
      {
        name: 'undefined class',
        playerStats: { name: 'Throg', level: 15, rules: '5e', spellAbilities: { spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spell_slots_level_4: 3, spell_slots_level_5: 1 } },
      },
    ];

    for (const scenario of scenarios) {
      const { container } = render(<FontOfMagicModal playerStats={scenario.playerStats} campaignName="test-campaign" onClose={mockOnClose} />);
      expect(screen.getByText('Font of Magic')).toBeInTheDocument();
      container.remove();
    }

    // no spell slots
    const { container } = render(<FontOfMagicModal playerStats={{ name: 'Throg', level: 1, rules: '5e', class: { name: 'Sorcerer', class_levels: [] }, spellAbilities: { spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_slots_level_5: 0 } }} campaignName="test-campaign" onClose={mockOnClose} />);
    const tables = document.querySelectorAll('.font-of-magic-table');
    const rows = tables[0].querySelectorAll('tbody tr');
    rows.forEach(row => expect(row.textContent).toContain('0 / 0'));
    container.remove();
  });

  // ── netSPChange computation ──

  it('correctly computes netSPChange for conversion-only, creation-only, and mixed scenarios', () => {
    // conversion only: convert 1 level-3 slot → +3 SP
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '5' : null
    );
    const { container: c1 } = render(<FontOfMagicModal {...makeProps()} />);
    let tables = document.querySelectorAll('.font-of-magic-table');
    let firstRows = tables[0].querySelectorAll('tbody tr');
    fireEvent.change(firstRows[2].querySelector('input'), { target: { value: '1' } });
    expect(document.querySelector('.font-of-magic-summary').textContent).toContain('8');
    c1.remove();

    // creation only: create 2 level-3 slots at cost 4 each → -8 SP
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '20' : null
    );
    const props = makePropsWithCosts([
      { spell_slot_level: 3, sorcery_point_cost: 4 },
    ]);
    const { container: c2 } = render(<FontOfMagicModal {...props} />);
    tables = document.querySelectorAll('.font-of-magic-table');
    let secondRows = tables[1].querySelectorAll('tbody tr');
    fireEvent.change(secondRows[2].querySelector('input'), { target: { value: '2' } });
    expect(document.querySelector('.font-of-magic-summary').textContent).toContain('12');
    c2.remove();

    // mixed: convert 2 level-1 slots (+2 SP), create 1 level-1 slot (-2 SP) → netSP = 0, finalSP = 10
    vi.mocked(getRuntimeValue).mockImplementation((name, prop) =>
      prop === 'sorceryPoints' ? '10' : null
    );
    const props2 = makePropsWithCosts([
      { spell_slot_level: 1, sorcery_point_cost: 2 },
    ]);
    render(<FontOfMagicModal {...props2} />);
    tables = document.querySelectorAll('.font-of-magic-table');
    firstRows = tables[0].querySelectorAll('tbody tr');
    secondRows = tables[1].querySelectorAll('tbody tr');
    fireEvent.change(firstRows[0].querySelector('input'), { target: { value: '2' } });
    fireEvent.change(secondRows[0].querySelector('input'), { target: { value: '1' } });
    expect(document.querySelector('.font-of-magic-summary').textContent).toContain('10');
  });

  // ── filters out creating_spell_slots entries with spell_slot_level > 5 ──

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
});
