// @maintained-by-ai
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

const makeProps = (overrides = {}) => ({
  playerStats: makePlayerStats(overrides.playerStatsOverrides),
  campaignName: 'test-campaign',
  // automation.conversionRate no longer read: disk authors only 'level_2_plus'
  // and the fantasy all-levels fallback was deleted (test-maintain 🗑 #145).
  onClose: overrides.onClose || vi.fn(),
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

  it('reads spell slots from runtime, overriding stored counts and clamping at max', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) => {
      if (prop === 'spell_slots_level_2') return '1';
      if (prop === 'spell_slots_level_3') return '999';
      return null;
    });
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const rows = getSlotRows();
    // Rows render levels 2-9 in order; available / max.
    expect(rows[0].textContent).toContain('1 / 3'); // runtime override
    expect(rows[1].textContent).toContain('3 / 3'); // clamped from 999
    expect(rows[4].textContent).toContain('0 / 0'); // untouched empty level
  });

  it('renders rows for exactly levels 2-9 driven by availableSlots — never level 1 (disk conversionRate level_2_plus)', () => {
    // Character holds 4 level-1 slots in makePlayerStats; a level-1 row would
    // mean the deleted all-levels fantasy path leaked back into the display.
    render(<MoonlightStepResourceModal {...makeProps()} />);
    const levels = getSlotRows().map(row => row.cells[0].textContent);
    expect(levels).toEqual(['2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('selecting a level updates the button label and expends that level on convert', () => {
    const onClose = vi.fn();
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    const radios = getRadios();
    expect(radios[0]).toBeChecked(); // level 2 default
    fireEvent.click(radios[2]); // level 4
    expect(getConvertBtn()).toHaveTextContent('Expend Level 4 Slot');
    fireEvent.click(getConvertBtn());
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'TestCleric',
      expect.objectContaining({ spell_slots_level_4: 0 }),
      'test-campaign'
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clamps a stale over-max runtime uses count at display (stored 5 > max 2 renders 2/2, never 5/2)', () => {
    // writers census: no writer exceeds max at write time, but max is dynamic
    // (wisGatedPool over WIS) — a WIS drop can leave stored > max transiently.
    // display must never render the nonsense uses>max shape (:28-31-era defect).
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) =>
      prop === 'moonlightStepUses' ? '5' : null
    );
    render(<MoonlightStepResourceModal {...makeProps()} />);
    expect(screen.getByText(/Current uses: 2\/2/)).toBeInTheDocument();
    expect(screen.queryByText(/Current uses: 5\/2/)).not.toBeInTheDocument();
  });

  it('converting spends the level 2 slot, restores one use from runtime state, logs, and closes', () => {
    const onClose = vi.fn();
    // Runtime shows 1/2 uses consumed; converting restores it to the max of 2.
    useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) =>
      prop === 'moonlightStepUses' ? '1' : null
    );
    render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    expect(screen.getByText(/Current uses: 1\/2/)).toBeInTheDocument();
    fireEvent.click(getConvertBtn());
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'TestCleric',
      expect.objectContaining({
        moonlightStepUses: 2,
        spell_slots_level_2: 2,
      }),
      'test-campaign'
    );
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCleric',
        abilityName: 'Moonlight Step',
        description: expect.stringContaining('expended a level 2 spell slot to restore 1 use of Moonlight Step (2/2)'),
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never restores uses above maxUses', () => {
    render(
      <MoonlightStepResourceModal
        {...makeProps({
          playerStatsOverrides: makePlayerStats({
            _trackedResources: { moonlightStepUses: { max: 1 } },
          }),
        })}
      />
    );
    fireEvent.click(getConvertBtn());
    const updates = useRuntimeState.setRuntimeBatch.mock.calls[0][1];
    expect(updates.moonlightStepUses).toBe(1); // 1 current + 1 restored, capped at max 1
    expect(updates.spell_slots_level_2).toBe(2); // slot still spent
  });

  it('closes on Escape and Cancel but not on overlay click', () => {
    const onClose = vi.fn();
    const { container } = render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
    fireEvent.click(container.querySelector('.resource-pool-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('.resource-pool-modal')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('disables every selection and stays inert when optional slot/resource data is missing', () => {
    const onClose = vi.fn();
    render(
      <MoonlightStepResourceModal
        {...makeProps({
          onClose,
          playerStatsOverrides: makePlayerStats({
            spellAbilities: undefined,
            _trackedResources: undefined,
          }),
        })}
      />
    );
    expect(screen.getByText(/Current uses: 0\/0/)).toBeInTheDocument();
    getRadios().forEach((radio) => expect(radio).toBeDisabled());
    const convertBtn = getConvertBtn();
    expect(convertBtn).toBeDisabled();
    fireEvent.click(convertBtn);
    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
