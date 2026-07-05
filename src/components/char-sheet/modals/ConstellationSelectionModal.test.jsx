// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConstellationSelectionModal from './ConstellationSelectionModal.jsx';

vi.mock('../../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
  applyConstellationOption: vi.fn(),
}));

import * as starryFormHandler from '../../../services/automation/handlers/class-sorcerer/starryFormHandler.js';

const baseProps = {
  action: { name: 'Starry Form', automation: { type: 'constellation_selection' } },
  playerStats: { name: 'Sorcerer1', level: 5 },
  campaignName: 'test-campaign',
  isTwinkled: false,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

const defaultResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Starry Form',
    automationType: 'constellation_selection',
    description: 'Archer constellation chosen. Ranged Spell Attack: 1d8 + Wisdom Modifier Radiant damage.',
    automation: { type: 'constellation_selection' },
  },
};

describe('ConstellationSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    starryFormHandler.applyConstellationOption.mockResolvedValue(defaultResult);
  });

  describe('initial render', () => {
    it('renders the overlay, modal structure, and all UI elements', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByText('Starry Form')).toBeInTheDocument();
      expect(screen.getByText('Choose a constellation:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Archer/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Chalice/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dragon/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      const chooseBtn = screen.getByRole('button', { name: 'Choose' });
      expect(chooseBtn).toBeDisabled();
    });

    it('does not show result-specific elements on initial render', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  describe('constellation option descriptions', () => {
    it('shows correct descriptions for all constellation options', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
      expect(screen.getByRole('button', { name: /Archer/ }).textContent).toContain('Ranged Spell Attack: 1d8 + Wisdom Modifier Radiant damage');
      expect(screen.getByRole('button', { name: /Chalice/ }).textContent).toContain('Healing Spell: 1d8 + Wisdom Modifier HP to ally within 30 feet');
      expect(screen.getByRole('button', { name: /Dragon/ }).textContent).toContain('Treat d20 rolls of 9 or lower as 10');
    });

    it('shows enhanced descriptions when twinkled', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
      expect(screen.getByRole('button', { name: /Archer/ }).textContent).toContain('2d8');
      expect(screen.getByRole('button', { name: /Chalice/ }).textContent).toContain('2d8');
      expect(screen.getByRole('button', { name: /Dragon/ }).textContent).toContain('Fly Speed 20 feet (hover)');
    });
  });

  describe('selection behavior', () => {
    it('enables Choose button after selecting a constellation', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      expect(screen.getByRole('button', { name: 'Choose' })).toBeEnabled();
    });

    it('allows switching selection between options', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      fireEvent.click(screen.getByRole('button', { name: /Dragon/ }));
      expect(screen.getByRole('button', { name: 'Choose' })).toBeEnabled();
    });
  });

  describe('choosing a constellation', () => {
    it.each(['Archer', 'Chalice', 'Dragon'])('calls applyConstellationOption and onConfirm with %s', async (constellation) => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(constellation) }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        constellation
      );
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledTimes(1);
      expect(baseProps.onConfirm).toHaveBeenCalledWith(constellation);
    });

    it('does not call applyConstellationOption when no constellation is selected', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      expect(starryFormHandler.applyConstellationOption).not.toHaveBeenCalled();
      expect(baseProps.onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('result state', () => {
    it('replaces constellation options with result description and Done button', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        expect(screen.queryByText('Choose a constellation:')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText('Starry Form')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(document.querySelector('.sp-body').textContent).toContain('Archer constellation chosen');
      });
    });

    it('hides Cancel and Choose buttons in the result state', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
      });
    });

    it('calls onClose when Done button is clicked', async () => {
      const onClose = vi.fn();
      render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking overlay in result state', async () => {
      const onClose = vi.fn();
      render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displays custom action name in result header', async () => {
      render(<ConstellationSelectionModal {...makeProps({ action: { name: 'My Custom Starry Form', automation: { type: 'constellation_selection' } } })} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        expect(screen.getByText('My Custom Starry Form')).toBeInTheDocument();
      });
    });
  });
});
