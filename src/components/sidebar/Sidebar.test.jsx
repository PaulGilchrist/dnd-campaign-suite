import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sidebar from './Sidebar.jsx';

describe('Sidebar', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('should display campaign name', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
  });

  it('should render Campaigns back button', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText(/Campaigns/)).toBeInTheDocument();
  });

  it('should call onBackToCampaigns when Campaigns clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText(/Campaigns/));
    expect(defaultProps.onBackToCampaigns).toHaveBeenCalledTimes(1);
  });

  it('should render Add Character button', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText(/Add Character/)).toBeInTheDocument();
  });

  it('should call onAddCharacter when Add Character clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText(/Add Character/));
    expect(defaultProps.onAddCharacter).toHaveBeenCalledTimes(1);
  });

  it('should render character names when characters exist', () => {
    const props = {
      ...defaultProps,
      characters: [{ name: 'Aragorn' }, { name: 'Legolas' }],
    };
    render(<Sidebar {...props} />);
    expect(screen.getByText('Aragorn')).toBeInTheDocument();
    expect(screen.getByText('Legolas')).toBeInTheDocument();
  });

  it('should call onCharacterClick when character clicked', () => {
    const props = {
      ...defaultProps,
      characters: [{ name: 'Aragorn' }],
    };
    render(<Sidebar {...props} />);
    fireEvent.click(screen.getByText('Aragorn'));
    expect(defaultProps.onCharacterClick).toHaveBeenCalledWith({ name: 'Aragorn' });
  });

  it('should highlight active character', () => {
    const props = {
      ...defaultProps,
      characters: [{ name: 'Aragorn' }, { name: 'Legolas' }],
      activeCharacter: { name: 'Legolas' },
    };
    render(<Sidebar {...props} />);
    const legolasBtn = screen.getByText('Legolas').closest('button');
    expect(legolasBtn.classList.contains('active')).toBe(true);
  });

  it('should render Initiative button', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText(/Initiative/)).toBeInTheDocument();
  });

  it('should call onInitiativeClick when Initiative clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText(/Initiative/));
    expect(defaultProps.onInitiativeClick).toHaveBeenCalledTimes(1);
  });

  it('should render Notes button', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText(/Notes/)).toBeInTheDocument();
  });

  it('should call onNotesClick when Notes clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText(/Notes/));
    expect(defaultProps.onNotesClick).toHaveBeenCalledTimes(1);
  });

  it('should render Maps button with Maps label on localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    expect(screen.getByText('Maps')).toBeInTheDocument();
  });

  it('should render Map button with Map label on non-localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={false} />);
    expect(screen.getByText('Map')).toBeInTheDocument();
  });

  it('should call onMapsClick when Maps clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText(/Map/));
    expect(defaultProps.onMapsClick).toHaveBeenCalledTimes(1);
  });

  it('should render Encounters button on localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    expect(screen.getByText(/Encounters/)).toBeInTheDocument();
  });

  it('should not render Encounters button on non-localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={false} />);
    expect(screen.queryByText(/Encounters/)).not.toBeInTheDocument();
  });

  it('should call onEncounterClick when Encounters clicked', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    fireEvent.click(screen.getByText(/Encounters/));
    expect(defaultProps.onEncounterClick).toHaveBeenCalledTimes(1);
  });

  it('should render Factions button on localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    expect(screen.getByText(/Factions/)).toBeInTheDocument();
  });

  it('should not render Factions button on non-localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={false} />);
    expect(screen.queryByText(/Factions/)).not.toBeInTheDocument();
  });

  it('should call onFactionsClick when Factions clicked', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    fireEvent.click(screen.getByText(/Factions/));
    expect(defaultProps.onFactionsClick).toHaveBeenCalledTimes(1);
  });

  it('should render NPCs button on localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    expect(screen.getByText(/NPCs/)).toBeInTheDocument();
  });

  it('should not render NPCs button on non-localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={false} />);
    expect(screen.queryByText(/NPCs/)).not.toBeInTheDocument();
  });

  it('should call onNPCsClick when NPCs clicked', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    fireEvent.click(screen.getByText(/NPCs/));
    expect(defaultProps.onNPCsClick).toHaveBeenCalledTimes(1);
  });

  it('should render Quests button on localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    expect(screen.getByText(/Quests/)).toBeInTheDocument();
  });

  it('should not render Quests button on non-localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={false} />);
    expect(screen.queryByText(/Quests/)).not.toBeInTheDocument();
  });

  it('should call onQuestsClick when Quests clicked', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    fireEvent.click(screen.getByText(/Quests/));
    expect(defaultProps.onQuestsClick).toHaveBeenCalledTimes(1);
  });

  it('should call toggleTheme when theme toggle clicked', () => {
    render(<Sidebar {...defaultProps} />);
    const themeButton = document.querySelector('.theme-toggle-btn');
    fireEvent.click(themeButton);
    expect(defaultProps.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('should call onRenameCampaign when rename clicked', () => {
    render(<Sidebar {...defaultProps} />);
    const renameButton = document.querySelector('.rename-campaign-btn');
    fireEvent.click(renameButton);
    expect(defaultProps.onRenameCampaign).toHaveBeenCalledTimes(1);
  });

  it('should disable rename button on non-localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={false} />);
    const renameButton = document.querySelector('.rename-campaign-btn');
    expect(renameButton.disabled).toBe(true);
  });

  it('should enable rename button on localhost', () => {
    render(<Sidebar {...defaultProps} isLocalhost={true} />);
    const renameButton = document.querySelector('.rename-campaign-btn');
    expect(renameButton.disabled).toBe(false);
  });

  it('should call onDeleteCampaign when delete clicked', () => {
    render(<Sidebar {...defaultProps} />);
    const deleteButton = document.querySelector('.delete-campaign-btn');
    fireEvent.click(deleteButton);
    expect(defaultProps.onDeleteCampaign).toHaveBeenCalledTimes(1);
  });

  it('should disable delete campaign button when characters exist', () => {
    render(<Sidebar {...defaultProps} characters={[{ name: 'Aragorn' }]} />);
    const deleteButton = document.querySelector('.delete-campaign-btn');
    expect(deleteButton.disabled).toBe(true);
  });

  it('should enable delete campaign button when no characters', () => {
    render(<Sidebar {...defaultProps} characters={[]} />);
    const deleteButton = document.querySelector('.delete-campaign-btn');
    expect(deleteButton.disabled).toBe(false);
  });

  it('should toggle characters section when header clicked', () => {
    const props = {
      ...defaultProps,
      characters: [{ name: 'Aragorn' }],
    };
    render(<Sidebar {...props} />);
    expect(screen.getByText('Aragorn')).toBeInTheDocument();

    const charactersHeader = screen.getByText('Characters').closest('button');
    fireEvent.click(charactersHeader);

    expect(screen.queryByText('Aragorn')).not.toBeInTheDocument();
  });

  it('should persist expanded state to localStorage', () => {
    const props = {
      ...defaultProps,
      characters: [{ name: 'Aragorn' }],
    };
    render(<Sidebar {...props} />);

    const charactersHeader = screen.getByText('Characters').closest('button');
    fireEvent.click(charactersHeader);

    expect(window.localStorage.getItem('sidebar-characters-expanded')).toBe('false');
  });

  it('should restore expanded state from localStorage', () => {
    window.localStorage.setItem('sidebar-characters-expanded', 'false');
    const props = {
      ...defaultProps,
      characters: [{ name: 'Aragorn' }],
    };
    render(<Sidebar {...props} />);

    expect(screen.queryByText('Aragorn')).not.toBeInTheDocument();
  });

  it('should show active class on Factions when activeView is factions', () => {
    render(<Sidebar {...defaultProps} activeView={{ type: 'factions' }} />);
    const factionsBtn = screen.getByText(/Factions/).closest('button');
    expect(factionsBtn.classList.contains('active')).toBe(true);
  });

  it('should show active class on NPCs when activeView is npcs', () => {
    render(<Sidebar {...defaultProps} activeView={{ type: 'npcs' }} />);
    const npcsBtn = screen.getByText(/NPCs/).closest('button');
    expect(npcsBtn.classList.contains('active')).toBe(true);
  });

  it('should show active class on Quests when activeView is quests', () => {
    render(<Sidebar {...defaultProps} activeView="quests" />);
    const questsBtn = screen.getByText(/Quests/).closest('button');
    expect(questsBtn.classList.contains('active')).toBe(true);
  });
});
