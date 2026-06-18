// @improved-by-ai
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
    it('renders the overlay and modal structure', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the action name in the header', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByText('Starry Form')).toBeInTheDocument();
    });

    it('displays the constellation selection prompt', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByText('Choose a constellation:')).toBeInTheDocument();
    });

    it('renders all three constellation option buttons', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Archer/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Chalice/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dragon/ })).toBeInTheDocument();
    });

    it('renders Cancel and disabled Choose buttons', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
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
    it('shows Archer ranged spell attack description with correct dice', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
      const archerBtn = screen.getByRole('button', { name: /Archer/ });
      expect(archerBtn.textContent).toContain('Ranged Spell Attack: 1d8 + Wisdom Modifier Radiant damage');
    });

    it('shows Archer 2d8 dice when twinkled', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
      const archerBtn = screen.getByRole('button', { name: /Archer/ });
      expect(archerBtn.textContent).toContain('2d8');
    });

    it('shows Chalice healing spell description with correct dice', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
      const chaliceBtn = screen.getByRole('button', { name: /Chalice/ });
      expect(chaliceBtn.textContent).toContain('Healing Spell: 1d8 + Wisdom Modifier HP to ally within 30 feet');
    });

    it('shows Chalice 2d8 dice when twinkled', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
      const chaliceBtn = screen.getByRole('button', { name: /Chalice/ });
      expect(chaliceBtn.textContent).toContain('2d8');
    });

    it('shows Dragon concentration benefit description', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
      const dragonBtn = screen.getByRole('button', { name: /Dragon/ });
      expect(dragonBtn.textContent).toContain('Treat d20 rolls of 9 or lower as 10');
    });

    it('does not show fly speed when not twinkled', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
      const dragonBtn = screen.getByRole('button', { name: /Dragon/ });
      expect(dragonBtn.textContent).not.toContain('Fly Speed');
    });

    it('shows Dragon fly speed when twinkled', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
      const dragonBtn = screen.getByRole('button', { name: /Dragon/ });
      expect(dragonBtn.textContent).toContain('Fly Speed 20 feet (hover)');
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

  describe('closing the modal', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('choosing a constellation', () => {
    it('calls applyConstellationOption and onConfirm with Archer', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        'Archer'
      );
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledTimes(1);
      expect(baseProps.onConfirm).toHaveBeenCalledWith('Archer');
    });

    it('calls applyConstellationOption and onConfirm with Chalice', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Chalice/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        'Chalice'
      );
      expect(baseProps.onConfirm).toHaveBeenCalledWith('Chalice');
    });

    it('calls applyConstellationOption and onConfirm with Dragon', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Dragon/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        'Dragon'
      );
      expect(baseProps.onConfirm).toHaveBeenCalledWith('Dragon');
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
    it('replaces constellation options with result description', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        expect(screen.queryByText('Choose a constellation:')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(document.querySelector('.sp-body').textContent).toContain('Archer constellation chosen');
      });
    });

    it('shows the action name in the result header', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        expect(screen.getByText('Starry Form')).toBeInTheDocument();
      });
    });

    it('renders a Done button in the result state', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
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

    it('renders result description via dangerouslySetInnerHTML', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.innerHTML).toContain('Archer constellation chosen');
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

    it('displays handler-provided description for Chalice', async () => {
      starryFormHandler.applyConstellationOption.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Starry Form',
          automationType: 'constellation_selection',
          description: 'Chalice constellation chosen. Healing Spell Ally Buff.',
          automation: { type: 'constellation_selection' },
        },
      });
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Chalice/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toContain('Chalice constellation chosen');
      });
    });

    it('displays handler-provided description for Dragon', async () => {
      starryFormHandler.applyConstellationOption.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Starry Form',
          automationType: 'constellation_selection',
          description: 'Dragon constellation chosen. Concentration Benefit.',
          automation: { type: 'constellation_selection' },
        },
      });
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Dragon/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toContain('Dragon constellation chosen');
      });
    });
  });
});
