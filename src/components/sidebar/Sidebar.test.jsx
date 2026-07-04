// @improved-by-ai
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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

    it('should render Maps label on localhost, Map label on non-localhost', () => {
      render(<Sidebar {...defaultProps} isLocalhost={true} />);
      expect(screen.getByText('Maps')).toBeInTheDocument();

      render(<Sidebar {...defaultProps} isLocalhost={false} />);
      expect(screen.getByText('Map')).toBeInTheDocument();
    });

    it.each([
      { label: /Encounters/ },
      { label: /Factions/ },
      { label: /NPCs/ },
      { label: /Quests/ },
    ])('should render %s button on localhost', ({ label }) => {
      const localhostProps = { ...defaultProps, isLocalhost: true };
      render(<Sidebar {...localhostProps} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it.each([
      { label: /Encounters/ },
      { label: /Factions/ },
      { label: /NPCs/ },
      { label: /Quests/ },
    ])('should not render %s button on non-localhost', ({ label }) => {
      const nonLocalhostProps = { ...defaultProps, isLocalhost: false };
      render(<Sidebar {...nonLocalhostProps} />);
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });

    it('should render character names when characters exist', () => {
      const props = { ...defaultProps, characters: [{ name: 'Aragorn' }, { name: 'Legolas' }] };
      render(<Sidebar {...props} />);
      expect(screen.getByText('Aragorn')).toBeInTheDocument();
      expect(screen.getByText('Legolas')).toBeInTheDocument();
    });
  });

  describe('event handlers', () => {
    it('should call handlers when sidebar buttons are clicked', () => {
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByText(/Campaigns/));
      expect(defaultProps.onBackToCampaigns).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText(/Add Character/));
      expect(defaultProps.onAddCharacter).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText(/Initiative/));
      expect(defaultProps.onInitiativeClick).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText(/Notes/));
      expect(defaultProps.onNotesClick).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText(/Map/));
      expect(defaultProps.onMapsClick).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTitle(/Switch to/));
      expect(defaultProps.toggleTheme).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTitle('Rename Campaign'));
      expect(defaultProps.onRenameCampaign).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTitle('Delete Campaign'));
      expect(defaultProps.onDeleteCampaign).toHaveBeenCalledTimes(1);
    });

    it('should call localhost-only handlers when those buttons are clicked', () => {
      render(<Sidebar {...defaultProps} isLocalhost={true} />);
      fireEvent.click(screen.getByText(/Encounters/));
      expect(defaultProps.onEncounterClick).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText(/Factions/));
      expect(defaultProps.onFactionsClick).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText(/NPCs/));
      expect(defaultProps.onNPCsClick).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText(/Quests/));
      expect(defaultProps.onQuestsClick).toHaveBeenCalledTimes(1);
    });

    it('should call onCharacterClick with character object', () => {
      const props = { ...defaultProps, characters: [{ name: 'Aragorn' }] };
      render(<Sidebar {...props} />);
      fireEvent.click(screen.getByText('Aragorn'));
      expect(defaultProps.onCharacterClick).toHaveBeenCalledWith({ name: 'Aragorn' });
    });

    it('should open rules URL in new tab when Rules clicked', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      render(<Sidebar {...defaultProps} />);
      fireEvent.click(screen.getByText(/Rules/));
      expect(openSpy).toHaveBeenCalledWith('https://paulgilchrist.github.io/dnd-tools/rules/general', '_blank');
      openSpy.mockRestore();
    });
  });

  describe('button states', () => {
    it('should disable rename button on non-localhost', () => {
      render(<Sidebar {...defaultProps} isLocalhost={false} />);
      expect(screen.getByTitle('Rename Campaign')).toHaveAttribute('disabled');
    });

    it('should disable delete campaign button when characters exist, enable when empty', () => {
      render(<Sidebar {...defaultProps} characters={[{ name: 'Aragorn' }]} />);
      expect(screen.getByTitle('Delete Campaign')).toHaveAttribute('disabled');
      cleanup();

      render(<Sidebar {...defaultProps} characters={[]} />);
      expect(screen.getByTitle('Delete Campaign')).not.toHaveAttribute('disabled');
    });
  });

  describe('active highlighting', () => {
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

    it.each([
      { activeView: { type: 'factions' }, label: /Factions/ },
      { activeView: { type: 'npcs' }, label: /NPCs/ },
      { activeView: 'quests', label: /Quests/ },
    ])('should show active class on %p when activeView is %p', ({ activeView, label }) => {
      render(<Sidebar {...defaultProps} activeView={activeView} />);
      expect(screen.getByText(label).closest('button')).toHaveClass('active');
    });
  });

  describe('characters section toggle', () => {
    it('should toggle characters section, persist state, and restore from localStorage', () => {
      const props = { ...defaultProps, characters: [{ name: 'Aragorn' }] };

      // Default: expanded
      render(<Sidebar {...props} />);
      expect(screen.getByText('Aragorn')).toBeInTheDocument();

      // Collapse
      const charactersHeader = screen.getByText('Characters').closest('button');
      fireEvent.click(charactersHeader);
      expect(screen.queryByText('Aragorn')).not.toBeInTheDocument();
      expect(window.localStorage.getItem('sidebar-characters-expanded')).toBe('false');

      // Restore from localStorage
      window.localStorage.setItem('sidebar-characters-expanded', 'false');
      render(<Sidebar {...props} />);
      expect(screen.queryByText('Aragorn')).not.toBeInTheDocument();
    });
  });
});
