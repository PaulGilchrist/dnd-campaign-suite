import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharReactions from './CharReactions.jsx';

vi.mock('../../hooks/useLoggedDiceRoll.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/useActionPopup.js';

const mockPlayerStats = {
  reactions: [
     {
      name: 'Cautious Action',
      description: 'Take the Dodge action as a reaction.',
     },
   ],
  spellAbilities: {
    spells: [
       {
        name: 'Shield',
        desc: 'A barrier of invisible force appears.',
        casting_time: '1 reaction',
        prepared: 'Always',
       },
     ],
   },
};

const mockPlayerStatsWithNoReactions = {
  reactions: [],
  spellAbilities: {
    spells: [],
   },
};

describe('CharReactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
    }));
  });

  it('should render reactions header', () => {
    render(
       <CharReactions playerStats={mockPlayerStats} />
     );

    expect(screen.getByText('Reactions')).toBeInTheDocument();
   });

  it('should display reaction names', () => {
    render(
       <CharReactions playerStats={mockPlayerStats} />
     );

    expect(screen.getByText(/Cautious Action/)).toBeInTheDocument();
   });

  it('should display reaction descriptions', () => {
    render(
       <CharReactions playerStats={mockPlayerStats} />
     );

    expect(screen.getByText(/Take the Dodge action as a reaction/)).toBeInTheDocument();
   });

  it('should include spell reactions with 1 reaction casting time', () => {
    render(
       <CharReactions playerStats={mockPlayerStats} />
     );

    const shieldElements = screen.getAllByText(/Shield/);
    expect(shieldElements.length).toBeGreaterThanOrEqual(1);
   });

  it('should always include Opportunity Attack reaction', () => {
    render(
       <CharReactions playerStats={mockPlayerStatsWithNoReactions} />
     );

    expect(screen.getByText(/Opportunity Attack/)).toBeInTheDocument();
    expect(screen.getByText(/Can attack creature that moves out of your reach/)).toBeInTheDocument();
   });

  it('should not duplicate Opportunity Attack if already in reactions', () => {
    const playerStatsWithOpportunityAttack = {
      reactions: [
         {
          name: 'Opportunity Attack',
          description: 'Can attack creature that moves out of your reach',
         },
       ],
      spellAbilities: {
        spells: [],
       },
     };

    render(
       <CharReactions playerStats={playerStatsWithOpportunityAttack} />
     );

    const opportunityAttackElements = screen.getAllByText(/Opportunity Attack/);
    expect(opportunityAttackElements.length).toBe(1);
   });

  it('should not duplicate spell reactions already in reactions list', () => {
    const playerStatsWithDuplicateSpell = {
      reactions: [
         {
          name: 'Shield',
          description: 'A barrier of invisible force appears.',
         },
       ],
      spellAbilities: {
        spells: [
           {
            name: 'Shield',
            desc: 'A barrier of invisible force appears.',
            casting_time: '1 reaction',
            prepared: 'Always',
           },
         ],
       },
     };

    render(
       <CharReactions playerStats={playerStatsWithDuplicateSpell} />
     );

    const shieldElements = screen.getAllByText(/Shield/);
    expect(shieldElements.length).toBe(2);
   });

   it('should only include Always or Prepared spells', () => {
    const playerStatsWithUnpreparedSpell = {
      reactions: [],
      spellAbilities: {
        spells: [
           {
            name: 'Shield',
            desc: 'A barrier of invisible force appears.',
            casting_time: '1 reaction',
            prepared: '',
           },
         ],
       },
     };

    render(
       <CharReactions playerStats={playerStatsWithUnpreparedSpell} />
     );

    expect(screen.queryByText(/Shield/)).not.toBeInTheDocument();
   });

  it('should call setPopupHtml when reaction with details is clicked', () => {
    const mockSetPopupHtml = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
      rollAttack: vi.fn(),
    }));

    const playerStatsWithDetails = {
      reactions: [
         {
          name: 'Cautious Action',
          description: 'Take the Dodge action as a reaction.',
          details: 'This feature comes from the Fighter class.',
         },
       ],
      spellAbilities: {
        spells: [],
       },
     };

    render(
       <CharReactions playerStats={playerStatsWithDetails} />
     );

    const clickableElement = screen.getByText(/Cautious Action/);
    fireEvent.click(clickableElement);

    expect(mockSetPopupHtml).toHaveBeenCalled();
    const expectedHtml = buildFeatureDetailHtml(playerStatsWithDetails.reactions[0]);
    expect(mockSetPopupHtml).toHaveBeenCalledWith(expectedHtml);
   });

  it('should call rollAttack when Opportunity Attack is clicked', async () => {
    const mockRollAttack = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: mockRollAttack,
    }));

    const playerStatsWithAttack = {
      reactions: [],
      spellAbilities: { spells: [] },
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, type: 'Action' },
      ],
    };

    render(
       <CharReactions playerStats={playerStatsWithAttack} />
     );

    const oaElement = screen.getByText(/Opportunity Attack/);
    fireEvent.click(oaElement);

    await vi.waitFor(() => {
      expect(mockRollAttack).toHaveBeenCalledWith('Longsword', 5, { forcedMode: undefined });
    });
   });

  it('should handle empty playerStats gracefully', () => {
    render(
       <CharReactions playerStats={{}} />
     );

    expect(screen.getByText('Reactions')).toBeInTheDocument();
    expect(screen.getByText(/Opportunity Attack/)).toBeInTheDocument();
   });

  it('should render popup element container', () => {
    const mockPopupHtml = '<div>Popup Content</div>';
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: mockPopupHtml,
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
    }));

    render(
       <CharReactions playerStats={mockPlayerStats} />
     );

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
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
});
