// @maintained-by-ai
// Canonical lane for BonusActionChoiceModal UI: selection gating, handler seam args,
// applied-state swap, close paths (Cancel/Done only), the modal's own CLA-067
// per-option log suffixes, and its internal-skill-check dispatch for Sleight of
// Hand / Thieves' Tools. Handler-side logging, grants, and the Hide roll event are
// owned by bonusActionChoiceHandler.test.js; event CONSUMER routing is owned by
// CharAbilities.event-context.test.jsx — not duplicated here.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BonusActionChoiceModal from './BonusActionChoiceModal.jsx';

vi.mock('../../../../services/automation/handlers/combat/bonusActionChoiceHandler.js', () => ({
  applyBonusActionChoice: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import * as bonusActionHandler from '../../../../services/automation/handlers/combat/bonusActionChoiceHandler.js';
import * as logService from '../../../../services/ui/logService.js';

const baseAction = {
  name: 'Cunning Action',
  automation: {
    oncePerTurn: true,
    options: [
      { name: 'Dash', description: 'Double movement speed until end of turn.' },
      { name: 'Disengage', description: 'Movement doesn\'t provoke opportunity attacks.' },
      { name: 'Hide', description: 'Make a Dexterity (Stealth) check to hide.' },
    ],
  },
};

const fastHandsAction = {
  name: 'Fast Hands',
  automation: {
    oncePerTurn: true,
    options: [
      { name: 'Sleight of Hand', description: 'Make a Sleight of Hand check.' },
      { name: "Thieves' Tools", description: 'Use thieves\' tools.' },
    ],
  },
};

const baseProps = {
  action: baseAction,
  playerStats: { name: 'Rogue1', level: 3 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function popupResult(description, name = 'Cunning Action') {
  return {
    type: 'popup',
    payload: { type: 'automation_info', name, description, automation: baseAction.automation },
  };
}

function selectOption(index) {
  fireEvent.click(document.querySelectorAll('input[type="radio"]')[index]);
}

async function applyBonusAction(index) {
  selectOption(index);
  fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
}

describe('BonusActionChoiceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Explicit default every test: clearAllMocks clears calls but not
    // implementations, so per-test overrides must not leak sideways.
    bonusActionHandler.applyBonusActionChoice.mockResolvedValue(popupResult('Selected.'));
  });

  describe('selection and apply flow', () => {
    it('renders options and enables Apply only once a radio is selected', () => {
      render(<BonusActionChoiceModal {...makeProps()} />);
      expect(screen.getByText('Cunning Action')).toBeInTheDocument();
      expect(screen.getByText('Choose a Bonus Action:')).toBeInTheDocument();
      ['Dash', 'Disengage', 'Hide'].forEach((name) => {
        expect(screen.getByText(name)).toBeInTheDocument();
      });
      const apply = screen.getByRole('button', { name: /Use Bonus Action/ });
      expect(apply).toBeDisabled();

      selectOption(0);
      expect(document.querySelectorAll('input[type="radio"]')[0].checked).toBe(true);
      expect(apply).toBeEnabled();
    });

    it.each([
      { option: 'Dash', index: 0 },
      { option: 'Disengage', index: 1 },
    ])('sends selected option ($option) to the handler, swaps to result view, and Done closes', async ({ option, index }) => {
      const onClose = vi.fn();
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue(popupResult(`${option} selected.`));
      render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
      await applyBonusAction(index);

      expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalledWith(
        baseAction, baseProps.playerStats, 'test-campaign', option
      );
      expect(document.querySelector('.sp-body').textContent).toContain(`${option} selected`);
      expect(screen.queryByText('Choose a Bonus Action:')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Use Bonus Action/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stays on the selection view when the handler returns no result', async () => {
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue(null);
      render(<BonusActionChoiceModal {...makeProps()} />);
      selectOption(0);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      await waitFor(() => {
        expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalled();
      });
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeInTheDocument();
      expect(screen.getByText('Choose a Bonus Action:')).toBeInTheDocument();
    });

    it('renders an empty result body when the result has no payload', async () => {
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue({ type: 'popup' });
      render(<BonusActionChoiceModal {...makeProps()} />);
      await applyBonusAction(0);
      expect(document.querySelector('.sp-body').textContent).toBe('');
    });

    it('closes only via Cancel — overlay and inner-modal clicks never close', () => {
      const onClose = vi.fn();
      render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('option sources', () => {
    it.each([
      { label: 'no automation', action: { name: 'Empty Action' } },
      { label: 'null automation', action: { name: 'Null Automation', automation: null } },
      { label: 'empty options array', action: { name: 'Empty Options', automation: { options: [] } } },
    ])('renders disabled Apply with no radios when $label', ({ action }) => {
      render(<BonusActionChoiceModal {...makeProps({ action })} />);
      expect(screen.getByText(action.name)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeDisabled();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('uses options prop when provided, ignoring action.automation.options', () => {
      render(
        <BonusActionChoiceModal
          {...makeProps({ action: baseAction, options: [{ name: 'Hide', description: 'Hide desc' }] })}
        />
      );
      expect(screen.getByText('Hide')).toBeInTheDocument();
      expect(screen.queryByText('Dash')).not.toBeInTheDocument();
      expect(screen.queryByText('Disengage')).not.toBeInTheDocument();
    });
  });

  describe('campaign logging and skill-check events', () => {
    // CLA-067: the old fallback mislabeled every Cunning Action option as "Object use".
    it.each([
      { index: 0, option: 'Dash', suffix: 'Speed doubled until the end of the turn' },
      { index: 1, option: 'Disengage', suffix: 'No Opportunity Attacks until the end of the turn' },
      { index: 2, option: 'Hide', suffix: 'Dexterity (Stealth) check initiated' },
    ])('logs per-option suffix for $option', async ({ index, option, suffix }) => {
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue(popupResult(`${option} selected.`));
      render(<BonusActionChoiceModal {...makeProps()} />);
      await applyBonusAction(index);
      await waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
          type: 'ability_use',
          characterName: 'Rogue1',
          abilityName: 'Cunning Action',
          description: `${option} selected — ${suffix}`,
        });
      });
    });

    it.each([
      { index: 0, option: 'Sleight of Hand', suffix: 'Dexterity (Sleight of Hand) check initiated', detail: { skillName: 'Sleight of Hand', checkType: 'skill' } },
      { index: 1, option: "Thieves' Tools", suffix: "Thieves' Tools check initiated", detail: { skillName: "Thieves' Tools", checkType: 'check' } },
    ])('logs and dispatches internal-skill-check for $option', async ({ index, option, suffix, detail }) => {
      const events = [];
      const listener = (e) => events.push(e.detail);
      window.addEventListener('internal-skill-check', listener);
      try {
        bonusActionHandler.applyBonusActionChoice.mockResolvedValue(popupResult(`${option} selected.`, 'Fast Hands'));
        render(<BonusActionChoiceModal {...makeProps({ action: fastHandsAction })} />);
        await applyBonusAction(index);
        await waitFor(() => {
          expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: 'Rogue1',
            abilityName: 'Fast Hands',
            description: `${option} selected — ${suffix}`,
          });
        });
        expect(events).toEqual([detail]);
      } finally {
        window.removeEventListener('internal-skill-check', listener);
      }
    });

    it('falls back to a generic suffix for custom options and dispatches no skill-check event', async () => {
      const events = [];
      const listener = (e) => events.push(e.detail);
      window.addEventListener('internal-skill-check', listener);
      try {
        const action = {
          name: 'Misty Step',
          automation: { options: [{ name: 'Cast Misty Step', description: 'Teleport up to 30 feet.' }] },
        };
        bonusActionHandler.applyBonusActionChoice.mockResolvedValue(popupResult('Cast.', 'Misty Step'));
        render(<BonusActionChoiceModal {...makeProps({ action })} />);
        await applyBonusAction(0);
        await waitFor(() => {
          expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: 'Rogue1',
            abilityName: 'Misty Step',
            description: 'Cast Misty Step selected — Bonus action used',
          });
        });
        expect(events).toEqual([]);
      } finally {
        window.removeEventListener('internal-skill-check', listener);
      }
    });
  });
});
