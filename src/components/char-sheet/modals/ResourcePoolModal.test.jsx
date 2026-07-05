// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResourcePoolModal from './ResourcePoolModal.jsx';

// ── Mocked modules ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ── Re-import mocked modules ──
import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../services/encounters/combatData.js';

// ── Test fixtures ──

function makePlayerStats(overrides = {}) {
  return {
    name: 'Druid1',
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 2,
      spell_slots_level_4: 0,
      spell_slots_level_5: 0,
      spell_slots_level_6: 0,
      spell_slots_level_7: 0,
      spell_slots_level_8: 0,
      spell_slots_level_9: 0,
    },
    _trackedResources: {
      wildShapeUses: { max: 2 },
    },
    ...overrides,
  };
}

function makeAutomation(overrides = {}) {
  return {
    conversion: '',
    reverseConversion: '',
    conversionRate: '',
    ...overrides,
  };
}

// ── Test helpers ──

function setupRuntimeMock(returnValues) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) =>
    returnValues[key] ?? null
  );
}

function renderModal(playerStats, automation, campaignName, onClose) {
  const handleClose = onClose ?? vi.fn();
  return {
    ...render(
      <ResourcePoolModal
        playerStats={playerStats}
        campaignName={campaignName ?? 'test-campaign'}
        automation={automation}
        onClose={handleClose}
      />
    ),
    handleClose,
  };
}

// ── Tests ──

describe('ResourcePoolModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    combatData.getCurrentCombatRound.mockReturnValue(1);
  });

  // ── Rendering ──

  it('renders modal with title, subtitle, and cancel button', () => {
    renderModal(makePlayerStats(), makeAutomation());
    expect(screen.getByText('Wild Resurgence')).toBeInTheDocument();
    expect(screen.getByText(/Convert between Wild Shape uses and spell slots/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('applies no-print class to overlay', () => {
    renderModal(makePlayerStats(), makeAutomation());
    expect(document.querySelector('.resource-pool-overlay').classList.contains('no-print')).toBe(true);
  });

  it('has correct CSS class on modal content', () => {
    renderModal(makePlayerStats(), makeAutomation());
    expect(document.querySelector('.resource-pool-modal')).toBeInTheDocument();
  });

  // ── Modal close interactions ──

  it('calls onClose when cancel button clicked', () => {
    const handleClose = vi.fn();
    renderModal(makePlayerStats(), makeAutomation(), 'test-campaign', handleClose);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('pressing Escape key calls onClose', () => {
    const handleClose = vi.fn();
    renderModal(makePlayerStats(), makeAutomation(), 'test-campaign', handleClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('clicking overlay closes modal', () => {
    const handleClose = vi.fn();
    renderModal(makePlayerStats(), makeAutomation(), 'test-campaign', handleClose);
    const overlay = document.querySelector('.resource-pool-overlay');
    fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  // ── Forward conversion visibility ──

  it('shows forward conversion section when automation.conversion is spell_slot_to_wild_shape', () => {
    setupRuntimeMock({});
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(
      screen.getByRole('heading', { name: /Spell Slot.*Wild Shape/i })
    ).toBeInTheDocument();
  });

  it('does not show forward section when no conversion configured', () => {
    renderModal(makePlayerStats(), makeAutomation());
    expect(screen.queryByText(/Spell Slot.*Wild Shape/i)).not.toBeInTheDocument();
  });

  // ── Forward conversion prereqs ──

  it('shows blocked message when wild shape uses > 0 (prereq not met)', () => {
    setupRuntimeMock({ wildShapeUses: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(screen.getByText(/Use must be 0 to convert/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows blocked message with correct count of remaining wild shape uses', () => {
    setupRuntimeMock({ wildShapeUses: 3 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(screen.getByText(/You have 3 Wild Shape uses remaining/i)).toBeInTheDocument();
  });

  it('shows blocked message with singular "use" when wildShapeUses is 1', () => {
    setupRuntimeMock({ wildShapeUses: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(screen.getByText(/You have 1 Wild Shape use remaining/i)).toBeInTheDocument();
  });

  it('shows "already used this conversion this round" message when fwdUsedRound === currentRound', () => {
    combatData.getCurrentCombatRound.mockReturnValue(3);
    setupRuntimeMock({ wildShapeUses: 0, wildResurgenceFwdUsedRound: 3 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(screen.getByText(/Already used this conversion this round/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  // ── Forward conversion table ──

  it('shows level selection table when prereqs met for forward conversion', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 2 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    expect(radios.length).toBeGreaterThan(0);
  });

  it('disables radio buttons for levels with 0 available slots', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    const level4Row = [...document.querySelectorAll('.resource-pool-table tbody tr')].find(
      (row) => row.children[0]?.textContent === '4'
    );
    const radio = level4Row.querySelector('input[type="radio"]');
    expect(radio.disabled).toBe(true);
  });

  it('applies resource-pool-dim class to rows with 0 available slots in forward conversion', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    const level4Row = [...document.querySelectorAll('.resource-pool-table tbody tr')].find(
      (row) => row.children[0]?.textContent === '4'
    );
    expect(level4Row.classList.contains('resource-pool-dim')).toBe(true);
  });

  it('expend button is disabled when canForward is false', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 0 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    const button = screen.getByRole('button', { name: /Expend Level 1 Slot/i });
    expect(button.disabled).toBe(true);
  });

  // ── Forward conversion execution ──

  it('forwards conversion spends a spell slot and gains wild shape use', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_2: 3 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' }),
      'test-campaign',
      handleClose
    );

    const level2Row = [...document.querySelectorAll('.resource-pool-table tbody tr')].find(
      (row) => row.children[0]?.textContent === '2'
    );
    const radio = level2Row.querySelector('input[type="radio"]');
    fireEvent.click(radio);

    fireEvent.click(screen.getByRole('button', { name: /Expend Level 2 Slot/i }));

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        spell_slots_level_2: 2,
        wildShapeUses: 1,
        wildResurgenceFwdUsedRound: 1,
      }),
      'test-campaign'
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('does not fire forward conversion when selected level has 0 slots', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 0 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' }),
      'test-campaign',
      handleClose
    );

    fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));

    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('forward conversion uses runtime value for spell slots when available', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 1 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' }),
      'test-campaign',
      handleClose
    );

    const level1Row = [...document.querySelectorAll('.resource-pool-table tbody tr')].find(
      (row) => row.children[0]?.textContent === '1'
    );
    expect(level1Row.children[1].textContent).toBe('1 / 4');

    const radio = level1Row.querySelector('input[type="radio"]');
    fireEvent.click(radio);

    fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        spell_slots_level_1: 0,
        wildShapeUses: 1,
        wildResurgenceFwdUsedRound: 1,
      }),
      'test-campaign'
    );
    expect(handleClose).toHaveBeenCalled();
  });

  // ── selectedLevel state ──

  it('defaults selectedLevel to 1 and button text reflects level 1', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 2 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(
      screen.getByRole('button', { name: /Expend Level 1 Slot/i })
    ).toBeInTheDocument();
  });

  it('updates button text when a different level radio is selected', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_3: 2 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    const level3Row = [...document.querySelectorAll('.resource-pool-table tbody tr')].find(
      (row) => row.children[0]?.textContent === '3'
    );
    const radio = level3Row.querySelector('input[type="radio"]');
    fireEvent.click(radio);
    expect(
      screen.getByRole('button', { name: /Expend Level 3 Slot/i })
    ).toBeInTheDocument();
  });

  // ── Archdruid / Nature Magician visibility ──

  it('shows archdruid section when conversion is wild_shape_to_spell_slot and conversionRate is 2_levels_per_use', () => {
    setupRuntimeMock({ wildShapeUses: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    expect(screen.getByText('Nature Magician')).toBeInTheDocument();
  });

  it('does not show archdruid section when conversionRate is missing', () => {
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '',
      })
    );
    expect(screen.queryByText('Nature Magician')).not.toBeInTheDocument();
  });

  it('does not show reverse section when isArchdruid is true', () => {
    setupRuntimeMock({ wildShapeUses: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        reverseConversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    expect(screen.queryByRole('heading', { name: /Wild Shape.*Spell Slot/i })).not.toBeInTheDocument();
    expect(screen.getByText('Nature Magician')).toBeInTheDocument();
  });

  // ── Archdruid table ──

  it('shows archdruid uses table with correct number of rows', () => {
    setupRuntimeMock({ wildShapeUses: 3 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    expect(rows.length).toBe(3);
  });

  it('archdruid shows correct slot level mapping (uses * 2)', () => {
    setupRuntimeMock({ wildShapeUses: 3 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    expect(rows[0].children[1].textContent).toBe('2');
    expect(rows[1].children[1].textContent).toBe('4');
    expect(rows[2].children[1].textContent).toBe('6');
  });

  it('caps archdruid table rows at 4 even when currentWS exceeds 4', () => {
    setupRuntimeMock({ wildShapeUses: 6 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    expect(rows.length).toBe(4);
  });

  it('caps archdruid target level at 9 when uses * 2 exceeds 9', () => {
    setupRuntimeMock({ wildShapeUses: 5 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    expect(rows[3].children[1].textContent).toBe('8');
  });

  it('applies resource-pool-dim class to rows with 0 available slots in archdruid conversion', () => {
    setupRuntimeMock({ wildShapeUses: 2, spell_slots_level_4: 0 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    const row2 = [...document.querySelectorAll('.resource-pool-table tbody tr')][1];
    expect(row2.classList.contains('resource-pool-dim')).toBe(true);
  });

  // ── Archdruid prereqs ──

  it('archdruid section shows blocked message when no wild shape uses remaining', () => {
    setupRuntimeMock({ wildShapeUses: 0 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    expect(screen.getByText(/no Wild Shape uses remaining/i)).toBeInTheDocument();
  });

  // ── Archdruid conversion execution ──

  it('archdruid conversion calls setRuntimeBatch and onClose when convert button clicked', () => {
    setupRuntimeMock({ wildShapeUses: 2, spell_slots_level_2: 1 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      }),
      'test-campaign',
      handleClose
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 2 Slot/i })
    );

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        wildShapeUses: 1,
        spell_slots_level_2: 2,
      }),
      'test-campaign'
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('archdruid converts correct number of uses to target level', () => {
    setupRuntimeMock({ wildShapeUses: 3, spell_slots_level_2: 1 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      }),
      'test-campaign',
      handleClose
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 2 Slot/i })
    );

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        wildShapeUses: 2,
        spell_slots_level_2: 2,
      }),
      'test-campaign'
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('archdruid conversion does not fire when target level has 0 slots', () => {
    setupRuntimeMock({ wildShapeUses: 2, spell_slots_level_4: 0 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      }),
      'test-campaign',
      handleClose
    );

    const row2 = [...document.querySelectorAll('.resource-pool-table tbody tr')][1];
    const radio = row2.querySelector('input[type="radio"]');
    fireEvent.click(radio);

    fireEvent.click(
      screen.getByRole('button', { name: /Convert 2 Wild Shape.*Level 4 Slot/i })
    );

    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });

  // ── archdruidUses state ──

  it('defaults archdruidUses to 1 and button text reflects 1 use → level 2', () => {
    setupRuntimeMock({ wildShapeUses: 2, spell_slots_level_2: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    expect(
      screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 2 Slot/i })
    ).toBeInTheDocument();
  });

  it('updates button text when a different archdruid uses value is selected', () => {
    setupRuntimeMock({ wildShapeUses: 3, spell_slots_level_4: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '2_levels_per_use',
      })
    );
    const row2 = [...document.querySelectorAll('.resource-pool-table tbody tr')][1];
    const radio = row2.querySelector('input[type="radio"]');
    fireEvent.click(radio);
    expect(
      screen.getByRole('button', { name: /Convert 2 Wild Shape.*Level 4 Slot/i })
    ).toBeInTheDocument();
  });

  // ── Reverse conversion visibility ──

  it('shows reverse conversion section when automation.reverseConversion is wild_shape_to_spell_slot', () => {
    setupRuntimeMock({ wildShapeUses: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ reverseConversion: 'wild_shape_to_spell_slot' })
    );
    expect(
      screen.getByRole('heading', { name: /Wild Shape.*Spell Slot/i })
    ).toBeInTheDocument();
  });

  it('does not show reverse section when reverseConversion is not configured', () => {
    renderModal(makePlayerStats(), makeAutomation());
    expect(
      screen.queryByRole('heading', { name: /Wild Shape.*Spell Slot/i })
    ).not.toBeInTheDocument();
  });

  it('shows both forward and reverse sections when both conversions set without archdruid rate', () => {
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 2 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'spell_slot_to_wild_shape',
        reverseConversion: 'wild_shape_to_spell_slot',
      })
    );
    expect(
      screen.getByRole('heading', { name: /Spell Slot.*Wild Shape/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Wild Shape.*Spell Slot/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Nature Magician')).not.toBeInTheDocument();
  });

  // ── Reverse conversion execution ──

  it('reverse conversion calls setRuntimeBatch and onClose when convert button clicked', () => {
    setupRuntimeMock({ wildShapeUses: 1, spell_slots_level_1: 2 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({ reverseConversion: 'wild_shape_to_spell_slot' }),
      'test-campaign',
      handleClose
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 1 Slot/i })
    );

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        wildShapeUses: 0,
        spell_slots_level_1: 3,
        wildResurgenceReversedThisRest: true,
      }),
      'test-campaign'
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('reverse conversion caps spell slot at max slots', () => {
    setupRuntimeMock({ wildShapeUses: 1, spell_slots_level_1: 4 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({ reverseConversion: 'wild_shape_to_spell_slot' }),
      'test-campaign',
      handleClose
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 1 Slot/i })
    );

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        wildShapeUses: 0,
        spell_slots_level_1: 4,
        wildResurgenceReversedThisRest: true,
      }),
      'test-campaign'
    );
    expect(handleClose).toHaveBeenCalled();
  });

  // ── Reverse conversion prereqs ──

  it('reverse conversion does not fire when prereqs not met (already used this rest)', () => {
    setupRuntimeMock({});
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'wildShapeUses') return 1;
      if (key === 'wildResurgenceReversedThisRest') return true;
      return null;
    });

    renderModal(
      makePlayerStats(),
      makeAutomation({ reverseConversion: 'wild_shape_to_spell_slot' })
    );

    expect(screen.getByText(/Already used this conversion this Long Rest/i)).toBeInTheDocument();
  });

  it('reverse section shows blocked message when no wild shape uses remaining', () => {
    setupRuntimeMock({ wildShapeUses: 0 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ reverseConversion: 'wild_shape_to_spell_slot' })
    );
    expect(screen.getByText(/no Wild Shape uses remaining/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Convert 1 Wild Shape/i })).not.toBeInTheDocument();
  });

  // ── Edge cases ──

  it('handles missing playerStats.spellAbilities gracefully', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0 });
    renderModal(
      makePlayerStats({ spellAbilities: undefined }),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    const rows = document.querySelectorAll('.resource-pool-table tbody tr');
    expect(rows.length).toBe(9);
    for (const row of rows) {
      expect(row.children[1].textContent).toContain('0 / 0');
    }
  });

  it('handles missing _trackedResources gracefully', () => {
    renderModal(
      makePlayerStats({ _trackedResources: undefined }),
      makeAutomation()
    );
    expect(screen.getByText('Wild Resurgence')).toBeInTheDocument();
  });

  it('clamps currentSlots to maxSlots when runtime value exceeds max', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 100 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    const level1Row = [...document.querySelectorAll('.resource-pool-table tbody tr')].find(
      (row) => row.children[0]?.textContent === '1'
    );
    expect(level1Row.children[1].textContent).toBe('4 / 4');
  });

  it('shows all radios disabled when all spell slots are 0', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0 });
    renderModal(
      makePlayerStats({
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
      }),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    radios.forEach(radio => expect(radio.disabled).toBe(true));
  });
});
