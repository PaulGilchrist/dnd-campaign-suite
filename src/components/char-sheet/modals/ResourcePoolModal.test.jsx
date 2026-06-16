import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResourcePoolModal from './ResourcePoolModal.jsx';

// ── Mocked modules (before the component import) ──

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ── Re-import mocked modules ──
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
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

function setupRuntimeMock(returnValues = {}) {
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
    localStorage.clear();
  });

  // ── Rendering ──

  it('renders title "Wild Resurgence"', () => {
    renderModal(makePlayerStats(), makeAutomation());
    expect(screen.getByText('Wild Resurgence')).toBeInTheDocument();
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

  it('does not close when clicking inside the modal content', () => {
    const handleClose = vi.fn();
    renderModal(makePlayerStats(), makeAutomation(), 'test-campaign', handleClose);
    const modalContent = document.querySelector('.resource-pool-modal');
    fireEvent.click(modalContent);
    expect(handleClose).not.toHaveBeenCalled();
  });

  // ── Forward conversion (spell slot -> wild shape) ──

  it('shows forward conversion section when automation.conversion is spell_slot_to_wild_shape', () => {
    setupRuntimeMock({});
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
     );
     // The h4 heading "Spell Slot → Wild Shape" uniquely identifies the section
    expect(screen.getByRole('heading', { name: /Spell Slot.*Wild Shape/i })).toBeInTheDocument();
   });

  it('does not show forward section when no conversion configured', () => {
    setupRuntimeMock({});
    renderModal(makePlayerStats(), makeAutomation());
    expect(screen.queryByText(/Spell Slot.*Wild Shape/i)).not.toBeInTheDocument();
  });

  it('shows blocked message when wild shape uses > 0 (prereq not met)', () => {
    setupRuntimeMock({ wildShapeUses: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(screen.getByText(/Use must be 0 to convert/i)).toBeInTheDocument();
  });

  it('shows "already used this round" message when fwdUsedRound === currentRound', () => {
    combatData.getCurrentCombatRound.mockReturnValue(3);
    setupRuntimeMock({ wildShapeUses: 0, wildResurgenceFwdUsedRound: 3 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(screen.getByText(/Already used this conversion this round/i)).toBeInTheDocument();
  });

  it('shows level selection table when prereqs met for forward conversion', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 2 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    // Verify radio buttons are present for level selection
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    expect(radios.length).toBeGreaterThan(0);
  });

  it('forward conversion spends a spell slot and gains wild shape use', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_2: 3 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' }),
      'test-campaign',
      handleClose
    );

    // Select level 2 radio button
    const radios = document.querySelectorAll('input[type="radio"][name="slotLevel"]');
    for (const r of radios) {
      if (!r.disabled && r.getAttribute('checked') === null) {
        // Check which level this is by context
        const row = r.closest('tr');
        const cells = row.children;
        if (cells[0].textContent === '2' && !r.disabled) {
          fireEvent.click(r);
          break;
        }
      }
    }

    // Click the convert button
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 2 Slot/i }));

    // Verify setRuntimeBatch was called with correct updates
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        spell_slots_level_2: 2, // 3 - 1 = 2
        wildShapeUses: 1, // 0 + 1 = 1
        wildResurgenceFwdUsedRound: 1,
      }),
      'test-campaign'
    );

    // Verify onClose was called
    expect(handleClose).toHaveBeenCalled();
  });

  // ── Archdruid / Nature Magician (wild shape -> spell slot at level = 2x uses) ──

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
    setupRuntimeMock({ wildShapeUses: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        conversion: 'wild_shape_to_spell_slot',
        conversionRate: '',
      })
    );
    expect(screen.queryByText('Nature Magician')).not.toBeInTheDocument();
  });

  // ── Reverse conversion (wild shape -> level 1 slot, once per long rest) ──

  it('shows reverse conversion section when automation.reverseConversion is wild_shape_to_spell_slot', () => {
    setupRuntimeMock({ wildShapeUses: 1 });
    renderModal(
      makePlayerStats(),
      makeAutomation({
        reverseConversion: 'wild_shape_to_spell_slot',
       })
     );
      // The h4 heading "Wild Shape → Spell Slot" uniquely identifies the section
      // (subtitle paragraph also contains both terms, so we query by role)
    expect(screen.getByRole('heading', { name: /Wild Shape.*Spell Slot/i })).toBeInTheDocument();
   });

  it('reverse conversion calls setRuntimeBatch and onClose when convert button clicked', () => {
    setupRuntimeMock({ wildShapeUses: 1, spell_slots_level_1: 2 });
    const handleClose = vi.fn();
    renderModal(
      makePlayerStats(),
      makeAutomation({ reverseConversion: 'wild_shape_to_spell_slot' }),
      'test-campaign',
      handleClose
    );

    fireEvent.click(screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 1 Slot/i }));

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        wildShapeUses: 0, // 1 - 1 = 0
        spell_slots_level_1: 3, // min(4, 2 + 1) = 3
        wildResurgenceReversedThisRest: true,
      }),
      'test-campaign'
    );

    expect(handleClose).toHaveBeenCalled();
  });

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

    // The default archdruidUses is 1, which maps to level 2 (1 * 2 = 2)
    fireEvent.click(
      screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 2 Slot/i })
    );

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        wildShapeUses: 1, // 2 - 1 = 1
        spell_slots_level_2: 2, // min(max, 1 + 1) = 2
      }),
      'test-campaign'
    );

    expect(handleClose).toHaveBeenCalled();
  });

  it('forward conversion does not fire button when canForward is false', () => {
    combatData.getCurrentCombatRound.mockReturnValue(1);
      // wildShapeUses defaults to maxWS=2 when not in mock, so currentWS !== 0
     // This means fwdPrereqsMet is false → no Expend button rendered (blocked message shown)
    setupRuntimeMock({});
    renderModal(
      makePlayerStats(),
      makeAutomation({ conversion: 'spell_slot_to_wild_shape' })
      );

     // Should see the blocked message instead of a radio table + button
    expect(screen.getByText(/Use must be 0 to convert/i)).toBeInTheDocument();
      // No expend-level button should exist at all
    expect(screen.queryByRole('button', { name: /Expend Level/i })).not.toBeInTheDocument();
    });

  it('reverse conversion does not fire when prereqs not met', () => {
    setupRuntimeMock({}); // wildShapeUses defaults to maxWS=2, but let's ensure revUsedThisRest is true
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'wildShapeUses') return 1;
      if (key === 'wildResurgenceReversedThisRest') return true; // already used this rest
      return null;
    });

    renderModal(
      makePlayerStats(),
      makeAutomation({ reverseConversion: 'wild_shape_to_spell_slot' })
    );

    expect(screen.getByText(/Already used this conversion this Long Rest/i)).toBeInTheDocument();
  });

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

  it('reverse section shows blocked message when no wild shape uses remaining', () => {
    setupRuntimeMock({ wildShapeUses: 0 });
    renderModal(
      makePlayerStats(),
      makeAutomation({ reverseConversion: 'wild_shape_to_spell_slot' })
    );
    expect(screen.getByText(/no Wild Shape uses remaining/i)).toBeInTheDocument();
  });
});
