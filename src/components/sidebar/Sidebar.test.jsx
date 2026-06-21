// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';

const defaultProps = {
  campaignName: 'Test Campaign',
  characters: [],
  activeCharacter: null,
  onBackToCampaigns: vi.fn(),
  onAddCharacter: vi.fn(),
  onCharacterClick: vi.fn(),
  onInitiativeClick: vi.fn(),
  onEncounterClick: vi.fn(),
  onFactionsClick: vi.fn(),
  onMapsClick: vi.fn(),
  onNotesClick: vi.fn(),
  onQuestsClick: vi.fn(),
  onNPCsClick: vi.fn(),
  onRenameCampaign: vi.fn(),
  onDeleteCampaign: vi.fn(),
  theme: 'dark',
  toggleTheme: vi.fn(),
  isLocalhost: true,
};

describe('Sidebar', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('rendering', () => {
    it('should display campaign name', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    it('should render Campaigns back button', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText(/Campaigns/)).toBeInTheDocument();
    });

    it('should render Add Character button', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText(/Add Character/)).toBeInTheDocument();
    });

    it('should render character names when characters exist', () => {
      const props = { ...defaultProps, characters: [{ name: 'Aragorn' }, { name: 'Legolas' }] };
      render(<Sidebar {...props} />);
      expect(screen.getByText('Aragorn')).toBeInTheDocument();
      expect(screen.getByText('Legolas')).toBeInTheDocument();
    });

    it('should render Initiative button', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText(/Initiative/)).toBeInTheDocument();
    });

    it('should render Notes button', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText(/Notes/)).toBeInTheDocument();
    });

    it('should render Maps button with Maps label on localhost', () => {
      render(<Sidebar {...defaultProps} isLocalhost={true} />);
      expect(screen.getByText('Maps')).toBeInTheDocument();
    });

    it('should render Map button with Map label on non-localhost', () => {
      render(<Sidebar {...defaultProps} isLocalhost={false} />);
      expect(screen.getByText('Map')).toBeInTheDocument();
    });

    it('should render Rules button', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText(/Rules/)).toBeInTheDocument();
    });
  });

  describe('localhost-conditional buttons', () => {
    it.each([
      { label: /Encounters/, activeView: undefined },
      { label: /Factions/, activeView: undefined },
      { label: /NPCs/, activeView: undefined },
      { label: /Quests/, activeView: undefined },
    ])('should render %s button on localhost', ({ label }) => {
      render(<Sidebar {...defaultProps} isLocalhost={true} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it.each([
      { label: /Encounters/ },
      { label: /Factions/ },
      { label: /NPCs/ },
      { label: /Quests/ },
    ])('should not render %s button on non-localhost', ({ label }) => {
      render(<Sidebar {...defaultProps} isLocalhost={false} />);
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });
  });

  describe('event handlers', () => {
    it('should call onBackToCampaigns when Campaigns clicked', () => {
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByText(/Campaigns/));
      expect(defaultProps.onBackToCampaigns).toHaveBeenCalledTimes(1);
    });

    it('should call onAddCharacter when Add Character clicked', () => {
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByText(/Add Character/));
      expect(defaultProps.onAddCharacter).toHaveBeenCalledTimes(1);
    });

    it('should call onCharacterClick when character clicked', () => {
      const props = { ...defaultProps, characters: [{ name: 'Aragorn' }] };
      render(<Sidebar {...props} />);
      fireEvent.click(screen.getByText('Aragorn'));
      expect(defaultProps.onCharacterClick).toHaveBeenCalledWith({ name: 'Aragorn' });
    });

    it('should call onInitiativeClick when Initiative clicked', () => {
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByText(/Initiative/));
      expect(defaultProps.onInitiativeClick).toHaveBeenCalledTimes(1);
    });

    it('should call onNotesClick when Notes clicked', () => {
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByText(/Notes/));
      expect(defaultProps.onNotesClick).toHaveBeenCalledTimes(1);
    });

    it('should call onMapsClick when Maps clicked', () => {
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByText(/Map/));
      expect(defaultProps.onMapsClick).toHaveBeenCalledTimes(1);
    });

    it('should call onEncounterClick when Encounters clicked', () => {
      render(<Sidebar {...defaultProps} isLocalhost={true} />);
      fireEvent.click(screen.getByText(/Encounters/));
      expect(defaultProps.onEncounterClick).toHaveBeenCalledTimes(1);
    });

    it('should call onFactionsClick when Factions clicked', () => {
      render(<Sidebar {...defaultProps} isLocalhost={true} />);
      fireEvent.click(screen.getByText(/Factions/));
      expect(defaultProps.onFactionsClick).toHaveBeenCalledTimes(1);
    });

    it('should call onNPCsClick when NPCs clicked', () => {
      render(<Sidebar {...defaultProps} isLocalhost={true} />);
      fireEvent.click(screen.getByText(/NPCs/));
      expect(defaultProps.onNPCsClick).toHaveBeenCalledTimes(1);
    });

    it('should call onQuestsClick when Quests clicked', () => {
      render(<Sidebar {...defaultProps} isLocalhost={true} />);
      fireEvent.click(screen.getByText(/Quests/));
      expect(defaultProps.onQuestsClick).toHaveBeenCalledTimes(1);
    });

    it('should call toggleTheme when theme toggle clicked', () => {
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByTitle(/Switch to/));
      expect(defaultProps.toggleTheme).toHaveBeenCalledTimes(1);
    });

    it('should call onRenameCampaign when rename clicked', () => {
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Rename Campaign'));
      expect(defaultProps.onRenameCampaign).toHaveBeenCalledTimes(1);
    });

    it('should call onDeleteCampaign when delete clicked', () => {
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Delete Campaign'));
      expect(defaultProps.onDeleteCampaign).toHaveBeenCalledTimes(1);
    });

    it('should open rules URL in new tab when Rules clicked', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByText(/Rules/));
      expect(openSpy).toHaveBeenCalledWith('https://paulgilchrist.github.io/dnd-tools/rules/general', '_blank');
      openSpy.mockRestore();
    });
  });

  describe('button disabled states', () => {
    it('should disable rename button on non-localhost', () => {
      render(<Sidebar {...defaultProps} isLocalhost={false} />);
      expect(screen.getByTitle('Rename Campaign')).toHaveAttribute('disabled');
    });

    it('should enable rename button on localhost', () => {
      render(<Sidebar {...defaultProps} isLocalhost={true} />);
      expect(screen.getByTitle('Rename Campaign')).not.toHaveAttribute('disabled');
    });

    it('should disable delete campaign button when characters exist', () => {
      render(<Sidebar {...defaultProps} characters={[{ name: 'Aragorn' }]} />);
      expect(screen.getByTitle('Delete Campaign')).toHaveAttribute('disabled');
    });

    it('should enable delete campaign button when no characters', () => {
      render(<Sidebar {...defaultProps} characters={[]} />);
      expect(screen.getByTitle('Delete Campaign')).not.toHaveAttribute('disabled');
    });
  });

  describe('active character highlighting', () => {
    it('should highlight active character', () => {
      const props = {
        ...defaultProps,
        characters: [{ name: 'Aragorn' }, { name: 'Legolas' }],
        activeCharacter: { name: 'Legolas' },
      };
      render(<Sidebar {...props} />);
      const legolasBtn = screen.getByText('Legolas').closest('button');
      expect(legolasBtn).toHaveClass('active');
    });
  });

  describe('activeView highlighting', () => {
    it('should show active class on Factions when activeView is factions', () => {
      render(<Sidebar {...defaultProps} activeView={{ type: 'factions' }} />);
      expect(screen.getByText(/Factions/).closest('button')).toHaveClass('active');
    });

    it('should show active class on NPCs when activeView is npcs', () => {
      render(<Sidebar {...defaultProps} activeView={{ type: 'npcs' }} />);
      expect(screen.getByText(/NPCs/).closest('button')).toHaveClass('active');
    });

    it('should show active class on Quests when activeView is quests', () => {
      render(<Sidebar {...defaultProps} activeView="quests" />);
      expect(screen.getByText(/Quests/).closest('button')).toHaveClass('active');
    });
  });

  describe('characters section toggle', () => {
    it('should toggle characters section when header clicked', () => {
      const props = { ...defaultProps, characters: [{ name: 'Aragorn' }] };
      render(<Sidebar {...props} />);
      expect(screen.getByText('Aragorn')).toBeInTheDocument();

      const charactersHeader = screen.getByText('Characters').closest('button');
      fireEvent.click(charactersHeader);

      expect(screen.queryByText('Aragorn')).not.toBeInTheDocument();
    });

    it('should persist expanded state to localStorage', () => {
      const props = { ...defaultProps, characters: [{ name: 'Aragorn' }] };
      render(<Sidebar {...props} />);

      const charactersHeader = screen.getByText('Characters').closest('button');
      fireEvent.click(charactersHeader);

      expect(window.localStorage.getItem('sidebar-characters-expanded')).toBe('false');
    });

    it('should restore expanded state from localStorage', () => {
      window.localStorage.setItem('sidebar-characters-expanded', 'false');
      const props = { ...defaultProps, characters: [{ name: 'Aragorn' }] };
      render(<Sidebar {...props} />);

      expect(screen.queryByText('Aragorn')).not.toBeInTheDocument();
    });
  });
});
