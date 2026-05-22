import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';

// Mock the useActionPopup hook
vi.mock('../../hooks/useActionPopup.js', () => ({
  default: vi.fn(),
  buildFeatureDetailHtml: (entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  },
}));

// Mock sanitizeHtml
vi.mock('../../services/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  renderMarkdown: vi.fn((md) => md),
  renderMarkdownInline: vi.fn((md) => md),
}));

import useActionPopup, { buildFeatureDetailHtml } from '../../hooks/useActionPopup.js';

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

      // Mock useActionPopup to return a controlled popup
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      }));
    });

  it('should render special actions header', () => {
    render(
        <CharSpecialActions playerStats={mockPlayerStats} />
      );

    expect(screen.getByText('Special Actions')).toBeInTheDocument();
    });

  it('should display special action names', () => {
    render(
        <CharSpecialActions playerStats={mockPlayerStats} />
      );

    expect(screen.getByText(/Second Wind/)).toBeInTheDocument();
    });

  it('should display special action descriptions', () => {
    render(
        <CharSpecialActions playerStats={mockPlayerStats} />
      );

    expect(screen.getByText(/You can use a bonus action to regain hit points/)).toBeInTheDocument();
    });

  it('should add Great Weapon Fighting when in fightingStyles', () => {
    render(
        <CharSpecialActions playerStats={mockPlayerStatsWithFightingStyle} />
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
        <CharSpecialActions playerStats={playerStatsWithProtection} />
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
        <CharSpecialActions playerStats={playerStatsWithDuplicate} />
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
        <CharSpecialActions playerStats={playerStats} />
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
        <CharSpecialActions playerStats={playerStats} />
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
        <CharSpecialActions playerStats={playerStats} />
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
        <CharSpecialActions playerStats={playerStats} />
      );

    expect(screen.queryByText(/Extra Attack/)).not.toBeInTheDocument();
    });

  it('should call showPopup when special action with details is clicked', () => {
    const mockShowPopup = vi.fn();
    useActionPopup.mockImplementation(() => ({
      showPopup: mockShowPopup,
      popupHtml: null,
      }));

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
        <CharSpecialActions playerStats={playerStatsWithDetails} />
      );

    const clickableElement = screen.getByText(/Second Wind/);
    fireEvent.click(clickableElement);

    expect(mockShowPopup).toHaveBeenCalledWith(playerStatsWithDetails.specialActions[0]);
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
           <CharSpecialActions playerStats={emptyPlayerStats} />
         );

      expect(screen.getByText('Special Actions')).toBeInTheDocument();
       });

  it('should render popup element container', () => {
    const mockPopupHtml = '<div>Popup Content</div>';
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: mockPopupHtml,
      }));

    render(
        <CharSpecialActions playerStats={mockPlayerStats} />
      );

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
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
         <CharSpecialActions playerStats={playerStats} />
       );

    expect(screen.getByText('Special Actions')).toBeInTheDocument();
   });

  it('should return null for feature without details', () => {
    const result = buildFeatureDetailHtml({ name: 'Test', description: 'Test desc' });
    expect(result).toBeNull();
  });

  it('should return html for feature with details', () => {
    const result = buildFeatureDetailHtml({ name: 'Test', description: 'Test desc', details: 'Some details' });
    expect(result).toContain('<b>Test</b>');
    expect(result).toContain('Some details');
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
      <CharSpecialActions playerStats={playerStatsWithBoth} />
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
      <CharSpecialActions playerStats={playerStatsWithDupProtection} />
    );

    const protectionElements = screen.getAllByText(/Protection/);
    expect(protectionElements.length).toBe(1);
  });

  it('should dismiss popup when overlay is clicked', () => {
    const mockSetPopupHtml = vi.fn();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: '<div>Popup Content</div>',
      setPopupHtml: mockSetPopupHtml,
    }));

    render(
      <CharSpecialActions playerStats={mockPlayerStats} />
    );

    const overlay = screen.getByTestId('popup-overlay');
    fireEvent.click(overlay);

    expect(mockSetPopupHtml).toHaveBeenCalledWith(null);
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
      <CharSpecialActions playerStats={playerStatsNoSpecial} />
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
      <CharSpecialActions playerStats={playerStatsMinimal} />
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
      <CharSpecialActions playerStats={playerStatsNoName} />
    );

    expect(container.querySelector('.sectionHeader')).toBeInTheDocument();
    expect(screen.getByText('An unnamed special action')).toBeInTheDocument();
  });
});
