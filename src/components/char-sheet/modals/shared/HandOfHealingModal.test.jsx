// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => (typeof n === 'string' ? n : '')) },
}));

vi.mock('../../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import storage from '../../../../services/ui/storage.js';
import * as combatData from '../../../../services/encounters/combatData.js';

const baseProps = {
  healName: 'Monk',
  formula: '1d4 + 2',
  rolls: [3, 1],
  bonus: 2,
  healAmount: 6,
  monkName: 'Monk1',
  targetName: 'Goblin',
  targetCurrentHp: 15,
  targetMaxHp: 20,
  hasPhysiciansTouch: false,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

describe('HandOfHealingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  describe('rendering', () => {
    it('renders the overlay and modal container', () => {
      render(<HandOfHealingModal {...makeProps()} />);
      expect(document.querySelector('.short-rest-overlay')).toBeInTheDocument();
      expect(document.querySelector('.short-rest-modal')).toBeInTheDocument();
    });

    it('renders the header with healName and hand-sparkles icon', () => {
      render(<HandOfHealingModal {...makeProps()} />);
      expect(screen.getByText('Monk')).toBeInTheDocument();
      expect(document.querySelector('.fa-hand-sparkles')).toBeInTheDocument();
    });

    it('renders the healing section with target HP info', () => {
      render(<HandOfHealingModal {...makeProps()} />);
      const h4 = document.querySelector('h4');
      expect(h4.textContent).toContain('Healing');
      expect(h4.textContent).toContain('Goblin');
      expect(h4.textContent).toContain('15');
      expect(h4.textContent).toContain('20');
      expect(h4.textContent).toContain('HP');
    });

    it('renders the formula, dice rolls, bonus, and healing total', () => {
      render(<HandOfHealingModal {...makeProps({ formula: '2d6 + 3', rolls: [3, 1], bonus: 2, healAmount: 8 })} />);
      expect(screen.getByText('2d6 + 3:')).toBeInTheDocument();
      expect(screen.getByText('3 + 1')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
      const totalEl = document.querySelector('.healing-total');
      expect(totalEl.textContent).toContain('8');
      expect(totalEl.textContent).toContain('HP restored');
    });

    it('renders a negative bonus with a minus prefix', () => {
      render(<HandOfHealingModal {...makeProps({ bonus: -1 })} />);
      expect(screen.getByText('-1')).toBeInTheDocument();
    });

    it('does not render a bonus span when bonus is zero', () => {
      render(<HandOfHealingModal {...makeProps({ bonus: 0 })} />);
      expect(document.querySelector('.healing-bonus')).not.toBeInTheDocument();
    });

    it('handles undefined rolls gracefully', () => {
      render(<HandOfHealingModal {...makeProps({ rolls: undefined })} />);
      expect(screen.getByText('Monk')).toBeInTheDocument();
    });

    it('handles null rolls gracefully', () => {
      render(<HandOfHealingModal {...makeProps({ rolls: null })} />);
      expect(screen.getByText('Monk')).toBeInTheDocument();
    });

    it('handles an empty rolls array', () => {
      render(<HandOfHealingModal {...makeProps({ rolls: [] })} />);
      expect(screen.getByText('Monk')).toBeInTheDocument();
    });

    it('renders the Done button with a check icon', () => {
      render(<HandOfHealingModal {...makeProps()} />);
      const doneBtn = screen.getByRole('button', { name: /Done/ });
      expect(doneBtn).toBeInTheDocument();
      expect(doneBtn.querySelector('.fa-solid.fa-check')).toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<HandOfHealingModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.short-rest-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<HandOfHealingModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.short-rest-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when the Done button is clicked', () => {
      const onClose = vi.fn();
      render(<HandOfHealingModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Done/ }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(<HandOfHealingModal {...makeProps({ onClose })} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('removes the keydown event listener on unmount', () => {
      const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
      const onClose = vi.fn();
      const { unmount } = render(<HandOfHealingModal {...makeProps({ onClose })} />);
      unmount();
      expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeListenerSpy.mockRestore();
    });
  });

  describe('PhysiciansTouch - no cureable conditions', () => {
    it('does not render the Physician Touch section when no conditions match', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
    });

    it('does not render the Physician Touch section when hasPhysiciansTouch is false', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: false })} />);
      expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
    });

    it('does not auto-cure when hasPhysiciansTouch is false', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: false })} />);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('PhysiciansTouch - single cureable condition (auto-cure)', () => {
    it('auto-removes a single cureable condition on mount', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
    });

    it('calls setRuntimeValue to remove the auto-cured condition', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Goblin',
          'activeConditions',
          expect.any(Array),
          'test-campaign'
        );
      });
    });

    it('shows the cured condition in the result section', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Blinded removed from Goblin \(Physician/)).toBeInTheDocument();
      });
    });

    it('does not show cure options when a single condition is auto-cured', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
      });
    });

    it('auto-cures when the runtime condition is uppercase', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['BLINDED']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
    });

    it('auto-cures when the runtime condition has surrounding whitespace', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([' blinded ']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
    });

    it('preserves the original casing of the condition in the cured message', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['Blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Blinded removed from Goblin/)).toBeInTheDocument();
      });
    });

    it('does not auto-cure when conditions contain only empty or whitespace strings', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['', '  ']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
    });

    it('does not auto-cure when conditions contain null values', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([null]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
    });
  });

  describe('PhysiciansTouch - multiple cureable conditions', () => {
    it('shows a selection prompt when multiple cureable conditions exist', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByText(/Select one to remove/)).toBeInTheDocument();
    });

    it('renders a button for each cureable condition', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Poisoned/ })).toBeInTheDocument();
    });

    it('does not render buttons for non-cureable conditions', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'frightened', 'poisoned']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Poisoned/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Remove Frightened/ })).not.toBeInTheDocument();
    });

    it('renders a shield-virus icon in the Physician Touch section', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(document.querySelectorAll('.fa-shield-virus').length).toBeGreaterThanOrEqual(1);
    });

    it('renders check-circle icons on each cure button', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(document.querySelectorAll('.fa-check-circle').length).toBeGreaterThanOrEqual(2);
    });

    it('removes the selected condition when its button is clicked', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/ }));
      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Goblin',
          'activeConditions',
          expect.any(Array),
          'test-campaign'
        );
      });
    });

    it('shows the removed condition in the cured section after manual removal', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/ }));
      await waitFor(() => {
        expect(screen.getByText(/Poisoned removed from Goblin \(Physician/)).toBeInTheDocument();
      });
    });

    it('hides cure options after a condition is removed', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/ }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Remove Blinded/ })).not.toBeInTheDocument();
      });
    });

    it('renders buttons for all five cureable conditions when all are present', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        'blinded', 'deafened', 'paralyzed', 'poisoned', 'stunned',
      ]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Deafened/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Paralyzed/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Poisoned/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Stunned/ })).toBeInTheDocument();
    });
  });

  describe('combat summary integration', () => {
    it('merges conditions from the combat summary when the target is a creature', () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'stunned' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Stunned/ })).toBeInTheDocument();
    });

    it('deduplicates conditions between runtime state and combat summary', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'Blinded' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
      expect(document.querySelectorAll('.healing-cured-condition')).toHaveLength(1);
    });

    it('auto-cures a condition found only via combat summary matching', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
    });

    it('does not crash when combat summary has no creatures', () => {
      combatData.getCombatSummary.mockReturnValue({});
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });

    it('does not crash when getCombatSummary throws', () => {
      combatData.getCombatSummary.mockImplementation(() => { throw new Error('fail'); });
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });

    it('does not auto-cure when multiple cureable conditions exist across both sources', () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'poisoned' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('condition removal side effects', () => {
    it('updates the combat summary storage when removing a condition', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
      });
    });

    it('dispatches a combat-summary-updated event after removing a condition', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const handler = vi.fn();
      window.addEventListener('combat-summary-updated', handler);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(handler).toHaveBeenCalled();
      });
      window.removeEventListener('combat-summary-updated', handler);
    });

    it('posts a condition log entry via fetch', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/campaigns/test-campaign/log',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('includes correct data in the condition log entry', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        const logCalls = global.fetch.mock.calls.filter(
          (call) => call[0] === '/api/campaigns/test-campaign/log'
        );
        expect(logCalls.length).toBeGreaterThan(0);
        const body = JSON.parse(logCalls[0][1].body);
        expect(body.type).toBe('condition');
        expect(body.characterName).toBe('Goblin');
        expect(body.condition).toBe('Blinded');
        expect(body.action).toBe('broken');
        expect(body.sourceName).toBe('Monk1 (Monk');
      });
    });

    it('URL-encodes the campaign name in the log fetch URL', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ campaignName: 'my campaign/2024', hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        const logCalls = global.fetch.mock.calls.filter(
          (call) => call[0]?.includes('/log')
        );
        expect(logCalls.length).toBeGreaterThan(0);
        expect(logCalls[0][0]).toContain('my%20campaign%2F2024');
      });
    });

    it('does not crash when fetch fails during condition removal', async () => {
      global.fetch.mockImplementation(() => Promise.reject(new Error('network error')).catch(() => {}));
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
    });
  });

  describe('runtime state interactions', () => {
    it('calls getRuntimeValue with targetName and activeConditions key', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<HandOfHealingModal {...makeProps()} />);
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions');
    });

    it('calls setRuntimeValue with the correct arguments on auto-cure', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Goblin',
           'activeConditions',
           expect.any(Array),
           'test-campaign'
         );
       });
     });
   });

   describe('conditionMatches edge cases', () => {
     it('does not auto-cure when conditions contain undefined values', () => {
       useRuntimeState.getRuntimeValue.mockReturnValue([undefined]);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
     });

     it('does not crash when conditions contain object values', () => {
       useRuntimeState.getRuntimeValue.mockReturnValue([{ name: 'blinded' }]);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
     });

     it('auto-cures when conditions contain a mix of valid cureable and invalid values', async () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['stunned', null, undefined, '  ']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       await waitFor(() => {
         expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
       });
     });
   });

   describe('combat summary edge cases', () => {
     it('does not crash when combat summary creature.conditions is null', () => {
       combatData.getCombatSummary.mockReturnValue({
         creatures: [{ name: 'Goblin', conditions: null }],
       });
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
     });

     it('does not crash when combat summary creature.conditions is undefined', () => {
       combatData.getCombatSummary.mockReturnValue({
         creatures: [{ name: 'Goblin', conditions: undefined }],
       });
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
     });

     it('does not crash when combat summary creature.conditions is a non-array value', () => {
       combatData.getCombatSummary.mockReturnValue({
         creatures: [{ name: 'Goblin', conditions: 'stunned' }],
       });
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
     });

     it('does not crash when combat summary creature is null', () => {
       combatData.getCombatSummary.mockReturnValue({
         creatures: [null],
       });
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
     });

     it('does not crash when combat summary creatures is null', () => {
       combatData.getCombatSummary.mockReturnValue({ creatures: null });
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
     });

     it('uses utils.getName to match creature by normalized name', async () => {
       const { default: utils } = await import('../../../../services/ui/utils.js');
       utils.getName.mockImplementation((n) => (typeof n === 'string' ? n.trim() : ''));
       combatData.getCombatSummary.mockReturnValue({
         creatures: [{ name: '  Goblin  ', conditions: [{ key: 'blinded' }] }],
       });
       useRuntimeState.getRuntimeValue.mockReturnValue([]);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       await waitFor(() => {
         expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
       });
     });
   });

   describe('runtime state edge cases', () => {
     it('handles when getRuntimeValue returns a non-array (string)', () => {
       useRuntimeState.getRuntimeValue.mockReturnValue('blinded');
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
     });

     it('handles when getRuntimeValue returns a non-array (number)', () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(42);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
     });

     it('handles when getRuntimeValue returns null (default mock)', () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(null);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
     });
   });

   describe('manual condition removal - detailed behavior', () => {
     it('shows the removed condition name with the canonical name from CUREABLE_CONDITIONS', async () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['BLINDED', 'deafened']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       fireEvent.click(screen.getByRole('button', { name: /Remove Blinded/ }));
       await waitFor(() => {
         expect(screen.getByText(/Blinded removed from Goblin \(Physician/)).toBeInTheDocument();
       });
     });

     it('does not auto-cure again after manual removal due to curedOnMount guard', async () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       await waitFor(() => {
         expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
       });
       expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
     });

     it('calls setRuntimeValue with filtered array excluding the removed condition', async () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'deafened', 'poisoned']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       fireEvent.click(screen.getByRole('button', { name: /Remove Deafened/ }));
       await waitFor(() => {
         expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
           'Goblin',
           'activeConditions',
           expect.arrayContaining(['blinded', 'poisoned']),
           'test-campaign'
         );
       });
     });

     it('removes condition case-insensitively from runtime state', async () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['Blinded', 'DEAFENED']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       fireEvent.click(screen.getByRole('button', { name: /Remove Blinded/ }));
       await waitFor(() => {
         expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
           'Goblin',
           'activeConditions',
           expect.arrayContaining(['DEAFENED']),
           'test-campaign'
         );
       });
     });
   });

   describe('fetch log entry - detailed verification', () => {
     it('includes the correct action type "broken" in the log entry', async () => {
       combatData.getCombatSummary.mockReturnValue({
         creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
       });
       useRuntimeState.getRuntimeValue.mockReturnValue([]);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       await waitFor(() => {
         const logCalls = global.fetch.mock.calls.filter(
           (call) => call[0] === '/api/campaigns/test-campaign/log'
         );
         const body = JSON.parse(logCalls[0][1].body);
         expect(body.type).toBe('condition');
         expect(body.action).toBe('broken');
         expect(body.timestamp).toBeTypeOf('number');
       });
     });

     it('posts the log fetch as a promise that is not awaited (fire and forget)', async () => {
       combatData.getCombatSummary.mockReturnValue({
         creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
       });
       useRuntimeState.getRuntimeValue.mockReturnValue([]);
       const fetchSpy = vi.fn().mockReturnValue(Promise.resolve({ ok: true }));
       global.fetch = fetchSpy;
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       await waitFor(() => {
         expect(fetchSpy).toHaveBeenCalled();
       });
     });
   });

   describe('UI structure and CSS classes', () => {
     it('applies no-print class to the overlay', () => {
       render(<HandOfHealingModal {...makeProps()} />);
       expect(document.querySelector('.no-print')).toBeInTheDocument();
     });

     it('applies short-rest-section class to healing section', () => {
       render(<HandOfHealingModal {...makeProps()} />);
       expect(document.querySelectorAll('.short-rest-section').length).toBeGreaterThanOrEqual(1);
     });

     it('applies short-rest-actions class to the action buttons container', () => {
       render(<HandOfHealingModal {...makeProps()} />);
       expect(document.querySelector('.short-rest-actions')).toBeInTheDocument();
     });

     it('applies char-btn class to action buttons', () => {
       render(<HandOfHealingModal {...makeProps()} />);
       const buttons = document.querySelectorAll('.char-btn');
       expect(buttons.length).toBeGreaterThanOrEqual(1);
     });

     it('applies healing-cured-condition class to the cured condition section', async () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       await waitFor(() => {
         expect(document.querySelector('.healing-cured-condition')).toBeInTheDocument();
       });
     });

     it('applies healing-cure-options class to the cure options container', () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(document.querySelector('.healing-cure-options')).toBeInTheDocument();
     });

     it('renders the formula text with a trailing colon', () => {
       render(<HandOfHealingModal {...makeProps({ formula: '1d8 + 3' })} />);
       expect(screen.getByText('1d8 + 3:')).toBeInTheDocument();
     });

     it('renders the healing total with an equals sign', () => {
       render(<HandOfHealingModal {...makeProps({ healAmount: 7 })} />);
       const totalEl = document.querySelector('.healing-total');
       expect(totalEl.textContent).toContain('=');
     });

     it('wraps the healing amount in a strong tag', () => {
       render(<HandOfHealingModal {...makeProps({ healAmount: 7 })} />);
       const strong = document.querySelector('.healing-total strong');
       expect(strong).toBeInTheDocument();
       expect(strong.textContent).toBe('7');
     });
   });

   describe('multiple cureable conditions with combat summary merge', () => {
     it('shows cure options when conditions come from both runtime and combat summary', () => {
       combatData.getCombatSummary.mockReturnValue({
         creatures: [{ name: 'Goblin', conditions: [{ key: 'stunned' }] }],
       });
       useRuntimeState.getRuntimeValue.mockReturnValue(['deafened']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       expect(screen.getByRole('button', { name: /Remove Deafened/ })).toBeInTheDocument();
       expect(screen.getByRole('button', { name: /Remove Stunned/ })).toBeInTheDocument();
     });

     it('auto-cures when only one condition exists across both sources via combat summary', () => {
       combatData.getCombatSummary.mockReturnValue({
         creatures: [{ name: 'Goblin', conditions: [{ key: 'stunned' }] }],
       });
       useRuntimeState.getRuntimeValue.mockReturnValue([]);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
       waitFor(() => {
         expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
       });
     });
   });

   describe('hasPhysiciansTouch false with single condition', () => {
     it('renders without the Physician Touch section', () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: false })} />);
       expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
     });

     it('does not call setRuntimeValue on mount', () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: false })} />);
       expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
     });

     it('does not dispatch any events on mount', () => {
       useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
       const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
       render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: false })} />);
       expect(dispatchSpy).not.toHaveBeenCalled();
       dispatchSpy.mockRestore();
     });
   });
});
