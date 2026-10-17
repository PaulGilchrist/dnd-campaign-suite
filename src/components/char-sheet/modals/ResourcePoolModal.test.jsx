// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import ResourcePoolModal from './ResourcePoolModal.jsx';

// ── Mocked modules ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Fixtures & helpers ──

// Druid template: 4/3/2 slots at levels 1-3, none higher; 2 max Wild Shape uses.
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

const FWD = { conversion: 'spell_slot_to_wild_shape' };
const REV = { reverseConversion: 'wild_shape_to_spell_slot' };
const ARCH = { conversion: 'wild_shape_to_spell_slot', conversionRate: '2_levels_per_use' };

function renderModal(playerStats, automation, onClose) {
  const handleClose = onClose ?? vi.fn();
  return {
    ...render(
      <ResourcePoolModal
        playerStats={playerStats ?? makePlayerStats()}
        campaignName="test-campaign"
        automation={automation ?? {}}
        onClose={handleClose}
      />
    ),
    handleClose,
  };
}

function setupRuntimeMock(returnValues) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => returnValues[key] ?? null);
}

function getSlotRows() {
  return [...document.querySelectorAll('.resource-pool-table tbody tr')];
}

function findRowByCell(cell, text) {
  return getSlotRows().find((row) => row.children[cell]?.textContent === String(text));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Pin deterministic defaults (clearAllMocks alone would leak per-test impls).
  useRuntimeState.getRuntimeValue.mockImplementation(() => null);
  combatData.getCurrentCombatRound.mockReturnValue(1);
  logService.addEntry.mockImplementation(() => Promise.resolve());
});

// ── Dismissal ──

describe('ResourcePoolModal dismissal', () => {
  it('renders header and closes via Cancel or Escape, but ignores overlay and modal clicks', () => {
    const { handleClose } = renderModal();
    expect(screen.getByText('Wild Resurgence')).toBeInTheDocument();
    expect(screen.getByText(/Convert between Wild Shape uses and spell slots/i)).toBeInTheDocument();

    fireEvent.click(document.querySelector('.resource-pool-overlay'));
    fireEvent.click(document.querySelector('.resource-pool-modal'));
    expect(handleClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});

// ── Section visibility (automation mode wiring) ──

describe('ResourcePoolModal section visibility', () => {
  it('shows each conversion section only for its configured automation mode', () => {
    // Forward + reverse without archdruid rate: both plain sections, no Nature Magician.
    const fwdRev = renderModal(
      makePlayerStats(),
      { conversion: FWD.conversion, reverseConversion: REV.reverseConversion }
    );
    expect(screen.getByRole('heading', { name: /Spell Slot.*Wild Shape/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Wild Shape.*Spell Slot/i })).toBeInTheDocument();
    expect(screen.queryByText('Nature Magician')).not.toBeInTheDocument();
    fwdRev.unmount();

    // Archdruid rate replaces the plain reverse section with Nature Magician.
    const arch = renderModal(makePlayerStats(), { ...ARCH, reverseConversion: REV.reverseConversion });
    expect(screen.getByText('Nature Magician')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Wild Shape.*Spell Slot/i })).not.toBeInTheDocument();
    arch.unmount();

    // Unconfigured automation shows no conversion sections at all.
    const empty = renderModal();
    expect(screen.queryByRole('heading', { name: /Spell Slot.*Wild Shape/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Wild Shape.*Spell Slot/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Nature Magician')).not.toBeInTheDocument();
    empty.unmount();
  });
});

// ── Forward conversion: Wild Resurgence (spell slot -> Wild Shape) ──

describe('ResourcePoolModal forward conversion', () => {
  it('blocks conversion until every Wild Shape use is spent, with correct singular/plural count', () => {
    setupRuntimeMock({ wildShapeUses: 3 });
    const first = renderModal(makePlayerStats(), FWD);
    expect(screen.getByText(/You have 3 Wild Shape uses remaining\. Use must be 0 to convert/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    first.unmount();

    setupRuntimeMock({ wildShapeUses: 1 });
    renderModal(makePlayerStats(), FWD);
    expect(screen.getByText(/You have 1 Wild Shape use remaining\. Use must be 0 to convert/i)).toBeInTheDocument();
  });

  it('renders the level table with available-from-runtime counts, disables empty levels, and tracks radio selection on the button', () => {
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 2, spell_slots_level_4: 0 });
    renderModal(makePlayerStats(), FWD);

    const rows = getSlotRows();
    expect(rows.length).toBe(9);
    expect(findRowByCell(0, 1).children[1].textContent).toBe('2 / 4');

    const checked = document.querySelector('input[name="slotLevel"]:checked');
    expect(findRowByCell(0, 1).contains(checked)).toBe(true);

    const button = screen.getByRole('button', { name: /Expend Level 1 Slot/i });
    expect(button.disabled).toBe(false);

    fireEvent.click(findRowByCell(0, 3).querySelector('input[type="radio"]'));
    expect(screen.getByRole('button', { name: /Expend Level 3 Slot/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Expend Level 1 Slot/i })).not.toBeInTheDocument();
  });

  it('spends the runtime slot value, gains a use, stamps the live round, logs ability_use, and closes', () => {
    combatData.getCurrentCombatRound.mockReturnValue(2);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 1 });
    const { handleClose } = renderModal(makePlayerStats(), FWD);

    // Runtime (1) shown, not max (4) — spending must come from the live value.
    expect(findRowByCell(0, 1).children[1].textContent).toBe('1 / 4');
    fireEvent.click(findRowByCell(0, 1).querySelector('input[type="radio"]'));
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        spell_slots_level_1: 0,
        wildShapeUses: 1,
        wildResurgenceFwdUsedRound: 2,
      }),
      'test-campaign'
    );
    expect(logService.addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'ability_use', characterName: 'Druid1', abilityName: 'Wild Resurgence' })
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('refuses a second forward conversion in the same round it was used, then re-arms the next round', () => {
    combatData.getCurrentCombatRound.mockReturnValue(2);
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_2: 3, wildResurgenceFwdUsedRound: 2 });
    const blocked = renderModal(makePlayerStats(), FWD);
    expect(screen.getByText(/Already used this conversion this round/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    blocked.unmount();

    combatData.getCurrentCombatRound.mockReturnValue(3);
    renderModal(makePlayerStats(), FWD);
    expect(screen.queryByText(/Already used this conversion this round/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expend Level 1 Slot/i }).disabled).toBe(false);
  });

  it('does not fire the conversion when the selected level has no slots left', () => {
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 0 });
    const { handleClose } = renderModal(makePlayerStats(), FWD);

    const button = screen.getByRole('button', { name: /Expend Level 1 Slot/i });
    expect(findRowByCell(0, 1).querySelector('input[type="radio"]').disabled).toBe(true);
    expect(button.disabled).toBe(true);
    fireEvent.click(button);

    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });
});

// ── Archdruid: Nature Magician (Wild Shape -> spell slot, 2 levels per use) ──

describe('ResourcePoolModal archdruid conversion', () => {
  it('maps one use to two spell levels and caps the table at four rows', () => {
    setupRuntimeMock({ wildShapeUses: 3 });
    const three = renderModal(makePlayerStats(), ARCH);
    expect(getSlotRows().map((row) => row.children[1].textContent)).toEqual(['2', '4', '6']);
    three.unmount();

    setupRuntimeMock({ wildShapeUses: 6 });
    renderModal(makePlayerStats(), ARCH);
    expect(getSlotRows().length).toBe(4);
  });

  it('converts one use into a level 2 slot (from the runtime value), spends the use, and closes', () => {
    setupRuntimeMock({ wildShapeUses: 2, spell_slots_level_2: 1 });
    const { handleClose } = renderModal(makePlayerStats(), ARCH);

    fireEvent.click(screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 2 Slot/i }));

    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        wildShapeUses: 1,
        spell_slots_level_2: 2, // runtime 1 + 1, capped at max 3
      }),
      'test-campaign'
    );
    // Honest pin: unlike Wild Resurgence fwd/rev, Nature Magician currently logs nothing.
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('does not convert into a level with no available slots', () => {
    setupRuntimeMock({ wildShapeUses: 2 });
    const { handleClose } = renderModal(makePlayerStats(), ARCH);

    const row2 = getSlotRows()[1]; // 2 uses -> level 4, which this druid cannot cast
    const radio = row2.querySelector('input[type="radio"]');
    expect(radio.disabled).toBe(true);
    fireEvent.click(radio);

    const button = screen.getByRole('button', { name: /Convert 2 Wild Shape.*Level 4 Slot/i });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);

    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });
});

// ── Reverse conversion (Wild Shape -> level 1 slot, once per Long Rest) ──

describe('ResourcePoolModal reverse conversion', () => {
  it('spends one use, refills the level 1 slot without exceeding its maximum, logs, and closes', () => {
    setupRuntimeMock({ wildShapeUses: 1, spell_slots_level_1: 2 });
    const normal = renderModal(makePlayerStats(), REV);
    fireEvent.click(screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 1 Slot/i }));
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        wildShapeUses: 0,
        spell_slots_level_1: 3,
        wildResurgenceReversedThisRest: true,
      }),
      'test-campaign'
    );
    expect(logService.addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'ability_use', characterName: 'Druid1', abilityName: 'Wild Resurgence' })
    );
    expect(normal.handleClose).toHaveBeenCalled();
    normal.unmount();

    // At max slots the refill stays capped at the maximum.
    setupRuntimeMock({ wildShapeUses: 1, spell_slots_level_1: 4 });
    const capped = renderModal(makePlayerStats(), REV);
    fireEvent.click(screen.getByRole('button', { name: /Convert 1 Wild Shape.*Level 1 Slot/i }));
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      expect.objectContaining({
        wildShapeUses: 0,
        spell_slots_level_1: 4,
        wildResurgenceReversedThisRest: true,
      }),
      'test-campaign'
    );
    expect(capped.handleClose).toHaveBeenCalled();
  });

  it('blocks the reverse conversion when there are no uses or it was already used this Long Rest, writing nothing', () => {
    setupRuntimeMock({ wildShapeUses: 0 });
    const noUses = renderModal(makePlayerStats(), REV);
    expect(screen.getByText(/you have no Wild Shape uses remaining/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Convert .*Slot/i })).not.toBeInTheDocument();
    noUses.unmount();

    setupRuntimeMock({ wildShapeUses: 1, wildResurgenceReversedThisRest: true });
    renderModal(makePlayerStats(), REV);
    expect(screen.getByText(/Already used this conversion this Long Rest/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Convert .*Slot/i })).not.toBeInTheDocument();
    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});

// ── Data integrity ──

describe('ResourcePoolModal data integrity', () => {
  it('clamps runtime slot values to the maximum slots', () => {
    setupRuntimeMock({ wildShapeUses: 0, spell_slots_level_1: 100 });
    renderModal(makePlayerStats(), FWD);
    expect(findRowByCell(0, 1).children[1].textContent).toBe('4 / 4');
  });

  it('renders safely with missing spellAbilities and tracked resources — zeroed, fully disabled', () => {
    const stats = makePlayerStats({ spellAbilities: undefined, _trackedResources: undefined });
    const { handleClose } = renderModal(stats, FWD);

    expect(screen.getByText('Wild Resurgence')).toBeInTheDocument();
    const rows = getSlotRows();
    expect(rows.length).toBe(9);
    for (const row of rows) {
      expect(row.children[1].textContent).toBe('0 / 0');
      expect(row.querySelector('input[type="radio"]').disabled).toBe(true);
    }
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('threads campaignName into the combat round lookup', () => {
    renderModal(makePlayerStats(), FWD);
    expect(combatData.getCurrentCombatRound).toHaveBeenCalledWith('test-campaign');
  });
});
