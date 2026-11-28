// @maintained-by-ai 2026-11-27
// MoonlightStepResourceModal — the resource-POOL conversion modal mounted by
// CharActionModals.jsx:143 (spell slot → Moonlight Step uses). Distinct from the
// modalsInline/combatHandlers "Moonlight slot fallback" lane (run2#1966), which
// pins the HOST-side no-uses-remaining prompt that routes through
// confirmTeleport — that prompt never opens this component; no overlap here.
// Imports-first audit vs MoonlightStepResourceModal.jsx:1-4 — exactly
// getRuntimeValue, setRuntimeBatch (useRuntimeState.js:63/:296) and addEntry
// (logService.js:274, async → Promise.resolve stub so handleConvert's .catch
// at :73 stays honest). No applyDamage/combatData carriers. Family ledger note:
// this modal has NO allocation/footer-math — it converts one slot per confirm
// and closes, so the MassHeal selected-only display asymmetry does not apply.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MoonlightStepResourceModal from './MoonlightStepResourceModal.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const makePlayerStats = (overrides = {}) => ({
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
  ...overrides,
});

const makeProps = ({ stats = {}, onClose = vi.fn() } = {}) => ({
  playerStats: makePlayerStats(stats),
  campaignName: 'test-campaign',
  onClose,
});

function getRadios() {
  return document.querySelectorAll('input[type="radio"][name="slotLevel"]');
}

function getConvertBtn() {
  return screen.getByRole('button', { name: /Expend Level \d+ Slot/ });
}

function getSlotRows() {
  return Array.from(document.querySelectorAll('.resource-pool-table tbody tr'));
}

describe('MoonlightStepResourceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('renders title, subtitle, current uses, and action buttons', () => {
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByText('Moonlight Step — Restore Uses')).toBeInTheDocument();
    expect(
      screen.getByText(/Expend a level 2\+ spell slot to regain 1 use of Moonlight Step/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Current uses: 2\/2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expend Level 2 Slot' })).toBeInTheDocument();
  });

  it('renders an exact census of levels 2-9 with runtime overrides clamped to stored max — never level 1', () => {
    // Consolidated (was two tests): the level census and the override/clamp math
    // read the SAME rows and cannot diverge. Character holds 4 level-1 slots;
    // a level-1 row would mean the deleted all-levels fantasy path leaked back
    // (disk authors only 'level_2_plus' — test-maintain 🗑 #145).
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) => {
      if (prop === 'spell_slots_level_2') return '1';
      if (prop === 'spell_slots_level_3') return '999';
      return null;
    });
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('TestCleric', 'spell_slots_level_2');
    // Full-text row census: `${level}${available} / ${max}`. Level 2 is the
    // runtime override ('1'), level 3 the 999→max clamp, level 4/5 pass-through
    // stored, 6-9 untouched empties. Ordering + count pin the 2-9 range.
    expect(getSlotRows().map((row) => row.textContent)).toEqual([
      '21 / 3',
      '33 / 3',
      '41 / 1',
      '51 / 1',
      '60 / 0',
      '70 / 0',
      '80 / 0',
      '90 / 0',
    ]);
    // Availability truth: exactly the funded levels are selectable.
    const radios = getRadios();
    expect(Array.from(radios).map((r) => r.disabled)).toEqual([
      false, false, false, false, true, true, true, true,
    ]);
  });

  it('defaults to level 2, relabels the button on selection, and expends exactly the selected level', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    const radios = getRadios();
    expect(radios[0]).toBeChecked(); // level 2 default
    fireEvent.click(radios[2]); // level 4
    expect(getConvertBtn()).toHaveTextContent('Expend Level 4 Slot');
    fireEvent.click(getConvertBtn());
    // Full-shape payload: exactly two writes, nothing else.
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith('TestCleric', {
      spell_slots_level_4: 0,
      moonlightStepUses: 2, // already at max 2 — restore clamps, never overflows
    }, 'test-campaign');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clamps a stale over-max runtime uses count at display (stored 5 > max 2 renders 2/2, never 5/2)', () => {
    // Writers census: no writer exceeds max at write time, but max is dynamic
    // (wisGatedPool over WIS) — a WIS drop can leave stored > max transiently.
    // Display must never render the nonsense uses>max shape.
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) =>
      prop === 'moonlightStepUses' ? '5' : null
    );
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByText(/Current uses: 2\/2/)).toBeInTheDocument();
    expect(screen.queryByText(/Current uses: 5\/2/)).not.toBeInTheDocument();
  });

  it('converting spends the level 2 slot, restores one use, logs the exact sentence, and closes', () => {
    const onClose = vi.fn();
    // Runtime shows 1/2 uses consumed; converting restores it to the max of 2.
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) =>
      prop === 'moonlightStepUses' ? '1' : null
    );
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    expect(screen.getByText(/Current uses: 1\/2/)).toBeInTheDocument();
    fireEvent.click(getConvertBtn());
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledTimes(1); // double-spend detector
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith('TestCleric', {
      spell_slots_level_2: 2,
      moonlightStepUses: 2,
    }, 'test-campaign');
    // Full-shape log entry with exact interpolated sentence (#1966 idiom).
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'ability_use',
      characterName: 'TestCleric',
      abilityName: 'Moonlight Step',
      description:
        'TestCleric expended a level 2 spell slot to restore 1 use of Moonlight Step (2/2).',
      timestamp: expect.any(Number),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never restores uses above maxUses (max 1, already full: payload stays 1)', () => {
    render(<MoonlightStepResourceModal {...makeProps({
      stats: { _trackedResources: { moonlightStepUses: { max: 1 } } },
    })} />);
    fireEvent.click(getConvertBtn());
    // Full-shape payload: the cap is the only difference from a normal spend.
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith('TestCleric', {
      spell_slots_level_2: 2, // slot still spent even though uses cannot rise
      moonlightStepUses: 1, // 1 current + 1 restored, capped at max 1
    }, 'test-campaign');
  });

  it('opens inert on the checked-but-unfunded default when level 2 is exhausted, then converts from a funded level', () => {
    // selectedLevel is hardcoded 2 (:46) regardless of funding — the modal must
    // open disabled-and-selected on level 2 and only arm once a funded radio wins.
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({
      onClose,
      stats: { spellAbilities: {
        spell_slots_level_1: 4,
        spell_slots_level_2: 0, // exhausted — the hardcoded default selection
        spell_slots_level_3: 3,
        spell_slots_level_4: 1,
        spell_slots_level_5: 1,
        spell_slots_level_6: 0,
        spell_slots_level_7: 0,
        spell_slots_level_8: 0,
        spell_slots_level_9: 0,
      } },
    })} />);
    const radios = getRadios();
    expect(radios[0]).toBeDisabled();
    expect(radios[0]).toBeChecked();
    const convertBtn = getConvertBtn();
    expect(convertBtn).toHaveTextContent('Expend Level 2 Slot');
    expect(convertBtn).toBeDisabled();
    fireEvent.click(radios[1]); // level 3 is funded (3/3)
    expect(getConvertBtn()).toHaveTextContent('Expend Level 3 Slot');
    fireEvent.click(getConvertBtn());
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith('TestCleric', {
      spell_slots_level_3: 2,
      moonlightStepUses: 2,
    }, 'test-campaign');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and Cancel, not on overlay click, and detaches the key listener on unmount', () => {
    const onClose = vi.fn();
    const { container, unmount } = render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    fireEvent.click(container.querySelector('.resource-pool-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('.resource-pool-modal')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2); // cleanup at :80 removed the listener
  });

  it('renders a zeroed, fully disabled table when optional slot/resource data is missing', () => {
    // #1920: no forced click on disabled controls — the disabled/checked
    // attributes ARE the observable inertness; handleConvert's guard is
    // unreachable through the UI from here.
    render(<MoonlightStepResourceModal {...makeProps({
      stats: { spellAbilities: undefined, _trackedResources: undefined },
    })} />);
    expect(screen.getByText(/Current uses: 0\/0/)).toBeInTheDocument();
    getRadios().forEach((radio) => expect(radio).toBeDisabled());
    expect(getConvertBtn()).toBeDisabled();
  });
});
