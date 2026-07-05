// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MoonlightStepResourceModal from './MoonlightStepResourceModal.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeBatch: vi.fn(),
}));

import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';

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

const makeAutomation = (conversionRate) => ({
  conversionRate: conversionRate || 'level_2_plus',
});

const makeProps = (overrides = {}) => ({
  playerStats: makePlayerStats(overrides.playerStatsOverrides),
  campaignName: 'test-campaign',
  automation: overrides.automation ?? makeAutomation(),
  onClose: overrides.onClose || vi.fn(),
});

function getRadios() {
  return document.querySelectorAll('input[type="radio"][name="slotLevel"]');
}

function getConvertBtn() {
  return screen.getByRole('button', { name: /Expend Level \d+ Slot/ });
}

describe('MoonlightStepResourceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('rendering', () => {
    it('displays the modal title and subtitle', () => {
      render(<MoonlightStepResourceModal {...makeProps()} />);
      expect(screen.getByText('Moonlight Step — Restore Uses')).toBeInTheDocument();
      expect(
        screen.getByText(/Expend a level 2\+ spell slot to regain 1 use of Moonlight Step/)
      ).toBeInTheDocument();
    });

    it('displays current uses from playerStats', () => {
      render(<MoonlightStepResourceModal {...makeProps()} />);
      expect(screen.getByText(/Current uses: 2\/2/)).toBeInTheDocument();
    });

    it('renders a Cancel button', () => {
      render(<MoonlightStepResourceModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders a convert button labeled with the selected level', () => {
      render(<MoonlightStepResourceModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Expend Level 2 Slot' })).toBeInTheDocument();
    });
  });

  describe('available slots display', () => {
    it('shows max slots for each level in the Available column', () => {
      render(<MoonlightStepResourceModal {...makeProps()} />);
      const table = document.querySelector('.resource-pool-table');
      expect(table.textContent).toContain('3 / 3');
      expect(table.textContent).toContain('1 / 1');
    });

    it('shows correct available/max when runtime value overrides a stored slot count', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) => {
        if (prop === 'spell_slots_level_2') return '1';
        return null;
      });
      render(<MoonlightStepResourceModal {...makeProps()} />);
      const table = document.querySelector('.resource-pool-table');
      expect(table.textContent).toContain('1 / 3');
    });

    it('caps runtime spell slot value at max slots', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) => {
        if (prop === 'spell_slots_level_2') return '999';
        return null;
      });
      render(<MoonlightStepResourceModal {...makeProps()} />);
      const table = document.querySelector('.resource-pool-table');
      expect(table.textContent).toContain('3 / 3');
    });

    it('uses runtime value for moonlightStepUses when stored', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((charKey, prop) => {
        if (prop === 'moonlightStepUses') return '5';
        return null;
      });
      render(<MoonlightStepResourceModal {...makeProps()} />);
      expect(screen.getByText(/Current uses: 5\/2/)).toBeInTheDocument();
    });
  });

  describe('conversionRate behavior', () => {
    it('selects level 2 by default regardless of conversionRate', () => {
      render(<MoonlightStepResourceModal {...makeProps({ automation: makeAutomation('all_levels') })} />);
      const radios = getRadios();
      expect(radios[0]).toBeChecked();
    });

    it('disables the convert button when the currently selected level has no slots', () => {
      render(<MoonlightStepResourceModal {...makeProps()} />);
      const radios = getRadios();
      fireEvent.click(radios[4]);
      expect(getConvertBtn()).toBeDisabled();
    });

    it('enables the convert button when the selected level has slots available', () => {
      render(<MoonlightStepResourceModal {...makeProps()} />);
      expect(getConvertBtn()).not.toBeDisabled();
    });
  });

  describe('user interaction', () => {
    it('updates the convert button label when a different level is selected', () => {
      render(<MoonlightStepResourceModal {...makeProps()} />);
      const radios = getRadios();
      fireEvent.click(radios[3]);
      expect(screen.getByRole('button', { name: 'Expend Level 5 Slot' })).toBeInTheDocument();
    });

    it('closes the modal when the Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('conversion flow', () => {
    it('expend the selected spell slot and restore one Moonlight Step use on convert', () => {
      const onClose = vi.fn();
      render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
      fireEvent.click(getConvertBtn());
      expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
        'TestCleric',
        expect.objectContaining({
          moonlightStepUses: 2,
          spell_slots_level_2: 2,
        }),
        'test-campaign'
      );
    });

    it('caps restored uses at maxUses', () => {
      const cappedStats = makePlayerStats({
        _trackedResources: { moonlightStepUses: { max: 1 } },
      });
      const onClose = vi.fn();
      render(
        <MoonlightStepResourceModal
          {...makeProps({ onClose, playerStatsOverrides: cappedStats })}
        />
      );
      fireEvent.click(getConvertBtn());
      const updates = useRuntimeState.setRuntimeBatch.mock.calls[0][1];
      expect(updates.moonlightStepUses).toBe(1);
    });

    it('closes the modal after a successful conversion', () => {
      const onClose = vi.fn();
      render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
      fireEvent.click(getConvertBtn());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('converts using a radio-selected level other than 2', () => {
      const onClose = vi.fn();
      render(<MoonlightStepResourceModal {...makeProps({ onClose })} />);
      const radios = getRadios();
      fireEvent.click(radios[2]);
      fireEvent.click(getConvertBtn());
      const updates = useRuntimeState.setRuntimeBatch.mock.calls[0][1];
      expect(updates.spell_slots_level_4).toBe(0);
      expect(updates.moonlightStepUses).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles missing spellAbilities, defaulting all slots to 0', () => {
      const stats = makePlayerStats({ spellAbilities: undefined });
      render(<MoonlightStepResourceModal {...makeProps({ playerStatsOverrides: stats })} />);
      const convertBtn = getConvertBtn();
      expect(convertBtn).toBeDisabled();
    });

    it('handles missing _trackedResources, defaulting maxUses to 0', () => {
      const stats = makePlayerStats({ _trackedResources: undefined });
      render(<MoonlightStepResourceModal {...makeProps({ playerStatsOverrides: stats })} />);
      expect(screen.getByText(/Current uses: 0\/0/)).toBeInTheDocument();
    });

    it('handles undefined or empty automation.conversionRate, defaulting to level_2_plus', () => {
      render(<MoonlightStepResourceModal {...makeProps({ automation: {} })} />);
      expect(screen.getByText('Moonlight Step — Restore Uses')).toBeInTheDocument();
    });

    it('disables all radios and the convert button when no slots exist at any level', () => {
      const stats = makePlayerStats({
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
      });
      render(<MoonlightStepResourceModal {...makeProps({ playerStatsOverrides: stats })} />);
      const radios = getRadios();
      radios.forEach((radio) => expect(radio).toBeDisabled());
      expect(getConvertBtn()).toBeDisabled();
    });

    it('defaults currentUses to maxUses when no runtime override exists', () => {
      const stats = makePlayerStats({ _trackedResources: { moonlightStepUses: { max: 4 } } });
      render(<MoonlightStepResourceModal {...makeProps({ playerStatsOverrides: stats })} />);
      expect(screen.getByText(/Current uses: 4\/4/)).toBeInTheDocument();
    });
  });
});
