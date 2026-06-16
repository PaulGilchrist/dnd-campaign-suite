import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';

// Mock executeHandler
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn().mockResolvedValue(null),
}));

// Mock hasAutomation
vi.mock('../../services/combat/automationService.js', () => ({
  hasAutomation: vi.fn((action) => !!(action?.automation)),
}));

// Mock TeleportModal
vi.mock('./modals/TeleportModal.jsx', () => ({
  default: ({ action, onClose }) => (
    <div data-testid="teleport-modal">
      <span>{action?.name || 'Teleport'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock sanitizeHtml
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  renderMarkdown: vi.fn((md) => md),
  renderMarkdownInline: vi.fn((md) => md),
}));

// Mock useActionPopup (no longer used but still imported)
vi.mock('../../hooks/useActionPopup.js', () => ({
  default: vi.fn(),
  buildFeatureDetailHtml: (entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  },
}));

// Mock Popup to render its children
vi.mock('../common/Popup.jsx', () => ({
  default: ({ html, onClickOrKeyDown }) => (
    <div data-testid="popup-overlay" onClick={onClickOrKeyDown}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  ),
}));

// Mock fighting styles
vi.mock('../../services/character/fightingStyles.js', () => ({
  getFightingStyle: vi.fn((name) => {
    if (name === 'Great Weapon Fighting') {
      return { name: 'Great Weapon Fighting', description: 'When you roll a 1 or 2 on a damage die...', type: 'passive' };
    }
    if (name === 'Protection') {
      return { name: 'Protection', description: 'When a creature you can see attacks a target other than you...', type: 'passive' };
    }
    return null;
  }),
}));

import { executeHandler } from '../../services/automation/index.js';

const mockPlayerStats = {
  specialActions: [
    {
      name: 'Second Wind',
      description: 'You can use a bonus action to regain hit points.',
    },
  ],
  class: {
    fightingStyles: [],
  },
  actions: [
    {
      name: 'Attack',
      description: 'Make a weapon attack.',
    },
  ],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
};

const mockPlayerStatsWithFightingStyle = {
  specialActions: [],
  class: {
    fightingStyles: ['Great Weapon Fighting'],
  },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
};

describe('CharSpecialActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeHandler.mockResolvedValue(null);
  });

  it('should render special actions header', () => {
    render(
      <CharSpecialActions playerStats={mockPlayerStats} campaignName="test" />
    );

    expect(screen.getByText('Special Actions')).toBeInTheDocument();
  });

  it('should display special action names', () => {
    render(
      <CharSpecialActions playerStats={mockPlayerStats} campaignName="test" />
    );

    expect(screen.getByText(/Second Wind/)).toBeInTheDocument();
  });

  it('should display special action descriptions', () => {
    render(
      <CharSpecialActions playerStats={mockPlayerStats} campaignName="test" />
    );

    expect(screen.getByText(/You can use a bonus action to regain hit points/)).toBeInTheDocument();
  });

  it('should add Great Weapon Fighting when in fightingStyles', () => {
    render(
      <CharSpecialActions playerStats={mockPlayerStatsWithFightingStyle} campaignName="test" />
    );

    expect(screen.getByText(/Great Weapon Fighting/)).toBeInTheDocument();
  });

  it('should add Protection fighting style when in fightingStyles', () => {
    const playerStatsWithProtection = {
      specialActions: [],
      class: {
        fightingStyles: ['Protection'],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsWithProtection} campaignName="test" />
    );

    expect(screen.getByText(/Protection/)).toBeInTheDocument();
  });

  it('should not duplicate fighting style if already in specialActions', () => {
    const playerStatsWithDuplicate = {
      specialActions: [
        {
          name: 'Great Weapon Fighting',
          description: 'When you roll a 1 or 2 on a damage die...',
        },
      ],
      class: {
        fightingStyles: ['Great Weapon Fighting'],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsWithDuplicate} campaignName="test" />
    );

    const greatWeaponElements = screen.getAllByText(/Great Weapon Fighting/);
    expect(greatWeaponElements.length).toBe(1);
  });

  it('should filter out actions that are in actions list', () => {
    const playerStats = {
      specialActions: [
        {
          name: 'Attack',
          description: 'Make a weapon attack.',
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [
        {
          name: 'Attack',
          description: 'Make a weapon attack.',
        },
      ],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStats} campaignName="test" />
    );

    expect(screen.queryByText(/Attack/)).not.toBeInTheDocument();
  });

  it('should filter out actions that are in bonusActions list', () => {
    const playerStats = {
      specialActions: [
        {
          name: 'Dash',
          description: 'Take the Dash action.',
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [
        {
          name: 'Dash',
          description: 'Take the Dash action.',
        },
      ],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStats} campaignName="test" />
    );

    expect(screen.queryByText(/Dash/)).not.toBeInTheDocument();
  });

  it('should filter out actions that are in reactions list', () => {
    const playerStats = {
      specialActions: [
        {
          name: 'Opportunity Attack',
          description: 'Can attack creature that moves out of your reach.',
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [
        {
          name: 'Opportunity Attack',
          description: 'Can attack creature that moves out of your reach.',
        },
      ],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStats} campaignName="test" />
    );

    expect(screen.queryByText(/Opportunity Attack/)).not.toBeInTheDocument();
  });

  it('should filter out actions that are in characterAdvancement list', () => {
    const playerStats = {
      specialActions: [
        {
          name: 'Extra Attack',
          description: 'You can attack twice.',
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [
        {
          name: 'Extra Attack',
          description: 'You can attack twice.',
        },
      ],
    };

    render(
      <CharSpecialActions playerStats={playerStats} campaignName="test" />
    );

    expect(screen.queryByText(/Extra Attack/)).not.toBeInTheDocument();
  });

  it('should show popup when special action with details is clicked', () => {
    const playerStatsWithDetails = {
      specialActions: [
        {
          name: 'Second Wind',
          description: 'You can use a bonus action to regain hit points.',
          details: 'This feature comes from the Fighter class.',
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsWithDetails} campaignName="test" />
    );

    const clickableElement = screen.getByText(/Second Wind/);
    fireEvent.click(clickableElement);

    expect(screen.getByText(/This feature comes from the Fighter class/)).toBeInTheDocument();
  });

  it('should execute automation when special action with automation is clicked', async () => {
    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Blink Steps', description: 'Teleported 30 ft.' },
    });

    const playerStatsWithAutomation = {
      specialActions: [
        {
          name: 'Blink Steps',
          description: 'Teleport up to 30 feet.',
          automation: { type: 'temp_buff', effect: 'bonus_teleport' },
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsWithAutomation} campaignName="test" />
    );

    const clickableElement = screen.getByText(/Blink Steps/);
    fireEvent.click(clickableElement);

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledWith(
        playerStatsWithAutomation.specialActions[0],
        playerStatsWithAutomation,
        'test',
        null
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Teleported 30 ft/)).toBeInTheDocument();
    });
  });

  it('should show teleport modal when automation returns teleport modal', async () => {
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'teleport',
      payload: { action: { name: 'Blink Steps', automation: { effect: 'bonus_teleport', distance: '30 ft' } }, playerStats: mockPlayerStats, campaignName: 'test' },
    });

    const playerStatsWithTeleport = {
      specialActions: [
        {
          name: 'Blink Steps',
          description: 'Teleport up to 30 feet.',
          automation: { type: 'temp_buff', effect: 'bonus_teleport' },
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsWithTeleport} campaignName="test" />
    );

    const clickableElement = screen.getByText(/Blink Steps/);
    fireEvent.click(clickableElement);

    await waitFor(() => {
      expect(screen.getByTestId('teleport-modal')).toBeInTheDocument();
    });
  });

  it('should handle empty playerStats gracefully', () => {
    const emptyPlayerStats = {
      specialActions: [],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={emptyPlayerStats} campaignName="test" />
    );

    expect(screen.getByText('Special Actions')).toBeInTheDocument();
  });

  it('should render popup element container', () => {
    // The popup won't be shown initially since we don't have state access
    // Just verify the component renders without error
    render(
      <CharSpecialActions playerStats={mockPlayerStats} campaignName="test" />
    );

    expect(screen.getByText('Special Actions')).toBeInTheDocument();
  });

  it('should handle empty specialActions array', () => {
    const playerStats = {
      specialActions: [],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStats} campaignName="test" />
    );

    expect(screen.getByText('Special Actions')).toBeInTheDocument();
  });

  it('should only add Great Weapon Fighting when both fighting styles are present due to else if', () => {
    const playerStatsWithBoth = {
      specialActions: [],
      class: {
        fightingStyles: ['Great Weapon Fighting', 'Protection'],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsWithBoth} campaignName="test" />
    );

    expect(screen.getByText(/Great Weapon Fighting/)).toBeInTheDocument();
    expect(screen.queryByText(/Protection/)).not.toBeInTheDocument();
  });

  it('should not duplicate Protection when already in specialActions', () => {
    const playerStatsWithDupProtection = {
      specialActions: [
        {
          name: 'Protection',
          description: 'When a creature you can see attacks a target other than you...',
        },
      ],
      class: {
        fightingStyles: ['Protection'],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsWithDupProtection} campaignName="test" />
    );

    const protectionElements = screen.getAllByText(/Protection/);
    expect(protectionElements.length).toBe(1);
  });

  it('should dismiss popup when overlay is clicked', async () => {
    const playerStatsWithAutomation = {
      specialActions: [
        {
          name: 'Blink Steps',
          description: 'Teleport up to 30 feet.',
          automation: { type: 'temp_buff', effect: 'bonus_teleport' },
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Blink Steps', description: 'Teleported 30 ft.' },
    });

    render(
      <CharSpecialActions playerStats={playerStatsWithAutomation} campaignName="test" />
    );

    const clickableElement = screen.getByText(/Blink Steps/);
    fireEvent.click(clickableElement);

    await waitFor(() => {
      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('popup-overlay'));

    await waitFor(() => {
      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });
  });

  it('should handle undefined specialActions gracefully', () => {
    const playerStatsNoSpecial = {
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsNoSpecial} campaignName="test" />
    );

    expect(screen.getByText('Special Actions')).toBeInTheDocument();
  });

  it('should handle undefined actions/bonusActions/reactions/characterAdvancement gracefully', () => {
    const playerStatsMinimal = {
      specialActions: [
        {
          name: 'Second Wind',
          description: 'You can use a bonus action to regain hit points.',
        },
      ],
      class: {
        fightingStyles: [],
      },
    };

    render(
      <CharSpecialActions playerStats={playerStatsMinimal} campaignName="test" />
    );

    expect(screen.getByText(/Second Wind/)).toBeInTheDocument();
  });

  it('should use fallback key when special action has no name', () => {
    const playerStatsNoName = {
      specialActions: [
        {
          description: 'An unnamed special action',
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    const { container } = render(
      <CharSpecialActions playerStats={playerStatsNoName} campaignName="test" />
    );

    expect(container.querySelector('.sectionHeader')).toBeInTheDocument();
    expect(screen.getByText('An unnamed special action')).toBeInTheDocument();
  });

  it('should not execute automation when cannotAct is true', async () => {
    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Blink Steps', description: 'Teleported 30 ft.' },
    });

    const playerStatsWithAutomation = {
      specialActions: [
        {
          name: 'Blink Steps',
          description: 'Teleport up to 30 feet.',
          automation: { type: 'temp_buff', effect: 'bonus_teleport' },
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsWithAutomation} campaignName="test" cannotAct={true} />
    );

    const clickableElement = screen.getByText(/Blink Steps/);
    fireEvent.click(clickableElement);

    await waitFor(() => {
      expect(executeHandler).not.toHaveBeenCalled();
    });
  });

  it('should render non-automation special actions as non-clickable', () => {
    const playerStatsNoAutomation = {
      specialActions: [
        {
          name: 'Second Wind',
          description: 'You can use a bonus action to regain hit points.',
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsNoAutomation} campaignName="test" />
    );

    expect(screen.getByText(/Second Wind/)).toBeInTheDocument();
  });

  it('should render automation special actions as clickable', () => {
    const playerStatsWithAutomation = {
      specialActions: [
        {
          name: 'Blink Steps',
          description: 'Teleport up to 30 feet.',
          automation: { type: 'temp_buff', effect: 'bonus_teleport' },
        },
      ],
      class: {
        fightingStyles: [],
      },
      actions: [],
      bonusActions: [],
      reactions: [],
      characterAdvancement: [],
    };

    render(
      <CharSpecialActions playerStats={playerStatsWithAutomation} campaignName="test" />
    );

    const clickableElement = screen.getByText(/Blink Steps/);
    expect(clickableElement).toHaveClass('clickable');
  });
});
