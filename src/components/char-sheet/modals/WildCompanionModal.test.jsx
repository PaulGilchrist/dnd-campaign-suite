// @maintained-by-ai
// WildCompanionModal — modal's own UI lane: chooser copy, spell-slot table
// render/dim/disable, radio selection, atomic pay+grant dispatch (CLA-388:
// spend + _Wild_Companion_freeCast stamp in ONE setRuntimeBatch — two
// sequential full-store POSTs race per §6-#18), ability_use log at confirm
// (CLA-359: modal legs bypass the generic logEntries flusher), runtime
// override threading, dismiss semantics. Handler routing/refusals are owned
// by spellCastHandler.wildCompanion.test.js; hosts stub-mock this modal for
// routing only. PolymorphSelectionModal is distinct code — not shared here.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WildCompanionModal from './WildCompanionModal.jsx';

// ── Mocked modules (only symbols the modal imports) ──

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

// ── Fixtures (spellAbilities shape mirrors PlayerStats; freeCast key
// matches spellPreparationService.consumeWildCompanionGrant) ──

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

const FREE_CAST = ['Find Familiar'];

const basePlayerStats = {
  name: 'Druid1',
  spellAbilities: baseSpellAbilities,
  _trackedResources: { wildShapeUses: { max: 2 } },
};

function makeProps(overrides) {
  return {
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

// Verbatim description copies from WildCompanionModal.jsx handleWildShape
const SLOT_LOG_DESC = 'Wild Companion: expended a level 1 spell slot to cast ' +
  'Find Familiar without Material components. The familiar is Fey and ' +
  'disappears when you finish a Long Rest.';
const WILDSHAPE_LOG_DESC = 'Wild Companion: expended 1 Wild Shape use to cast ' +
  'Find Familiar without Material components. The familiar is Fey and ' +
  'disappears when you finish a Long Rest.';

// Radios render in level order 1..9 (index = level - 1)
function slotRadios() {
  return screen.getAllByRole('radio');
}

// ── Tests ──

describe('WildCompanionModal', () => {
  beforeEach(() => {
    // config has no clearMocks — reset here to kill order-leaks
    vi.clearAllMocks();
    vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(null);
  });

  it('renders the Wild Companion chooser copy', () => {
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('Wild Companion')).toBeInTheDocument();
    expect(
      screen.getByText('Cast Find Familiar without Material components')
    ).toBeInTheDocument();
    expect(screen.getByText('Expend a Spell Slot')).toBeInTheDocument();
    expect(screen.getByText('Expend Wild Shape')).toBeInTheDocument();
  });

  it('lists all 9 slot levels current / max, defaulting to level 1 and disabling empty levels', () => {
    render(<WildCompanionModal {...makeProps()} />);
    const radios = slotRadios();
    expect(radios).toHaveLength(9);
    expect(screen.getByText('4 / 4')).toBeInTheDocument(); // lvl 1
    expect(screen.getByText('3 / 3')).toBeInTheDocument(); // lvl 2
    expect(screen.getByText('2 / 2')).toBeInTheDocument(); // lvl 3
    expect(screen.getAllByText('1 / 1')).toHaveLength(2); // lvls 4-5
    expect(screen.getAllByText('0 / 0')).toHaveLength(4); // lvls 6-9
    expect(radios[0]).toBeChecked(); // default selection
    [5, 6, 7, 8].forEach(i => expect(radios[i]).toBeDisabled()); // zero slots
    expect(
      screen.getByRole('button', { name: /Expend Level 1 Slot/i })
    ).toBeEnabled();
  });

  it('pays the default level 1 slot and the free-cast grant in ONE atomic batch, logs ability_use, and closes', () => {
    const props = makeProps();
    render(<WildCompanionModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    expect(mockSetRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { spell_slots_level_1: 3, _Wild_Companion_freeCast: FREE_CAST },
      'test-campaign'
    );
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Druid1',
        abilityName: 'Wild Companion',
        spellName: 'Find Familiar',
        description: SLOT_LOG_DESC,
      }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('retitles the expend button when level 3 is selected and pays level 3 from its own count', () => {
    const props = makeProps();
    render(<WildCompanionModal {...props} />);
    fireEvent.click(slotRadios()[2]); // level 3
    expect(slotRadios()[2]).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 3 Slot/i }));
    expect(mockSetRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { spell_slots_level_3: 1, _Wild_Companion_freeCast: FREE_CAST },
      'test-campaign'
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('disables every slot radio and the expend button when no spell slots exist', () => {
    const emptyStats = [
      { label: 'no spellAbilities', stats: { name: 'Druid1', _trackedResources: { wildShapeUses: { max: 2 } } } },
      { label: 'all-zero spellAbilities', stats: { ...basePlayerStats, spellAbilities: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`spell_slots_level_${i + 1}`, 0])) } },
    ];
    for (const { stats } of emptyStats) {
      const { unmount } = render(<WildCompanionModal {...makeProps({ playerStats: stats })} />);
      const radios = slotRadios();
      expect(radios).toHaveLength(9);
      radios.forEach(radio => expect(radio).toBeDisabled());
      expect(screen.getAllByText('0 / 0')).toHaveLength(9);
      expect(
        screen.getByRole('button', { name: /Expend Level 1 Slot/i })
      ).toBeDisabled();
      unmount();
    }
  });

  it('pays 1 Wild Shape use and the free-cast grant in ONE atomic batch, logs ability_use, and closes', () => {
    const props = makeProps();
    render(<WildCompanionModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend 1 Wild Shape/i }));
    expect(mockSetRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeBatch).toHaveBeenCalledWith(
      'Druid1',
      { wildShapeUses: 1, _Wild_Companion_freeCast: FREE_CAST },
      'test-campaign'
    );
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Druid1',
        abilityName: 'Wild Companion',
        spellName: 'Find Familiar',
        description: WILDSHAPE_LOG_DESC,
      }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the blocked message and no Wild Shape button when uses are unavailable', () => {
    const emptyUses = [
      { label: 'max 0', stats: { ...basePlayerStats, _trackedResources: { wildShapeUses: { max: 0 } } } },
      { label: 'no _trackedResources', stats: { name: 'Druid1', spellAbilities: baseSpellAbilities } },
    ];
    for (const { stats } of emptyUses) {
      const { unmount } = render(<WildCompanionModal {...makeProps({ playerStats: stats })} />);
      expect(
        screen.getByText('You have no Wild Shape uses remaining.')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Expend 1 Wild Shape/i })
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it('threads runtime overrides into the display and into both paid payloads', () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((key, prop) => {
      if (prop === 'spell_slots_level_1') return '2';
      if (prop === 'spell_slots_level_2') return '9'; // clamped to max 3
      if (prop === 'wildShapeUses') return '1';
      return null;
    });
    render(<WildCompanionModal {...makeProps()} />);
    expect(screen.getByText('2 / 4')).toBeInTheDocument(); // runtime current
    expect(screen.getByText('3 / 3')).toBeInTheDocument(); // stored 9 clamped to max 3
    expect(screen.queryByText(/9 \/ 3/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 1 Slot/i }));
    expect(mockSetRuntimeBatch).toHaveBeenNthCalledWith(
      1,
      'Druid1',
      { spell_slots_level_1: 1, _Wild_Companion_freeCast: FREE_CAST },
      'test-campaign'
    );
    fireEvent.click(screen.getByRole('button', { name: /Expend 1 Wild Shape/i }));
    expect(mockSetRuntimeBatch).toHaveBeenNthCalledWith(
      2,
      'Druid1',
      { wildShapeUses: 0, _Wild_Companion_freeCast: FREE_CAST },
      'test-campaign'
    );
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via the Cancel button but not via a backdrop click', () => {
    const onClose = vi.fn();
    render(<WildCompanionModal {...makeProps({ onClose })} />);
    // backdrop (plain overlay div, no role) must not dismiss
    fireEvent.click(document.querySelector('.resource-pool-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
