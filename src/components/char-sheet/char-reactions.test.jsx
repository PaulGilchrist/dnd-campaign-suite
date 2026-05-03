import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharReactions from './char-reactions';

// Mock the useActionPopup hook
vi.mock('./common/use-action-popup', () => ({
  default: vi.fn(),
  buildFeatureDetailHtml: (entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  },
}));

// Mock sanitizeHtml
vi.mock('../../services/sanitize', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

import useActionPopup, { buildFeatureDetailHtml } from './common/use-action-popup';

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

    // Mock useActionPopup to return a controlled popup
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      PopupElement: null,
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

    expect(screen.getByText(/Shield/)).toBeInTheDocument();
    expect(screen.getByText(/A barrier of invisible force appears/)).toBeInTheDocument();
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

  it('should not add duplicate spell reactions', () => {
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
    expect(shieldElements.length).toBe(1);
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

  it('should call showPopup when reaction with details is clicked', () => {
    const mockShowPopup = vi.fn();
    useActionPopup.mockImplementation(() => ({
      showPopup: mockShowPopup,
      PopupElement: null,
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

    expect(mockShowPopup).toHaveBeenCalledWith(playerStatsWithDetails.reactions[0]);
   });

  it('should handle empty playerStats gracefully', () => {
    render(
       <CharReactions playerStats={{}} />
     );

    expect(screen.getByText('Reactions')).toBeInTheDocument();
    expect(screen.getByText(/Opportunity Attack/)).toBeInTheDocument();
   });

  it('should render popup element container', () => {
    const mockPopupElement = <div data-testid="popup">Popup Content</div>;
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      PopupElement: mockPopupElement,
     }));

    render(
       <CharReactions playerStats={mockPlayerStats} />
     );

    expect(screen.getByTestId('popup')).toBeInTheDocument();
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