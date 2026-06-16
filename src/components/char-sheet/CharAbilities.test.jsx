import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities.jsx';

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(),
}));

import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const mockPlayerStats = {
  abilities: [
    {
      name: 'Strength',
      totalScore: 15,
      bonus: 2,
      save: 2,
      skills: [
        { name: 'Athletics', bonus: 2 },
       ],
      },
    {
      name: 'Dexterity',
      totalScore: 10,
      bonus: 0,
      save: 0,
      skills: [
        { name: 'Acrobatics', bonus: 0 },
        { name: 'Stealth', bonus: 0 },
       ],
      },
   ],
};

const mockAllAbilityScores = [
  {
    full_name: 'Strength',
    desc: '<p>Strength measures physical power.</p>',
   },
  {
    full_name: 'Dexterity',
    desc: '<p>Dexterity measures agility and reflexes.</p>',
   },
];

describe('CharAbilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    }));
   });

  it('should render ability headers', () => {
    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    expect(screen.getByText('Ability')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('Bonus')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
   });

  it('should display ability names', () => {
    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('Dexterity')).toBeInTheDocument();
   });

  it('should display ability scores', () => {
    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
   });

  it('should display ability bonuses with sign', () => {
    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    const bonusElements = screen.getAllByText('+2');
    expect(bonusElements.length).toBeGreaterThan(0);
    const zeroElements = screen.getAllByText('+0');
    expect(zeroElements.length).toBeGreaterThan(0);
   });

  it('should display skills for each ability', () => {
    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    expect(screen.getByText(/Athletics/)).toBeInTheDocument();
    expect(screen.getByText(/Acrobatics/)).toBeInTheDocument();
    expect(screen.getByText(/Stealth/)).toBeInTheDocument();
   });

  it('should call setPopupHtml with ability description when ability name is clicked', () => {
    const mockSetPopupHtml = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    }));

    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    const strengthElement = screen.getByText('Strength');
    fireEvent.click(strengthElement);

    expect(mockSetPopupHtml).toHaveBeenCalled();
    const html = mockSetPopupHtml.mock.calls[0][0];
    expect(html).toContain('Strength');
   });

  it('should render multiple abilities', () => {
    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    const abilityDivs = document.querySelectorAll('.abilities');
    expect(abilityDivs.length).toBeGreaterThan(0);
   });

  it('should handle empty abilities array', () => {
    const emptyStats = { abilities: [] };

    render(
      <CharAbilities
        playerStats={emptyStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    expect(screen.getByText('Ability')).toBeInTheDocument();
   });

  it('should display negative bonuses correctly', () => {
    const negativeStats = {
      abilities: [
        {
          name: 'Charisma',
          totalScore: 8,
          bonus: -1,
          save: -1,
          skills: [
            { name: 'Deception', bonus: -1 },
           ],
          },
       ],
    };

    render(
      <CharAbilities
        playerStats={negativeStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    const negativeElements = screen.getAllByText('-1');
    expect(negativeElements.length).toBeGreaterThan(0);
   });

  it('should render popup element container', () => {
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: { type: 'd20', name: 'Test', rolls: [1, 2], bonus: 3 },
      setPopupHtml: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    }));

    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
      />
    );

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
  });

  it('should call rollAbilityCheck when ability bonus is clicked', () => {
    const mockRollAbilityCheck = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAbilityCheck: mockRollAbilityCheck,
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    }));

    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
      />
    );

    const bonusElements = screen.getAllByText('+2');
    fireEvent.click(bonusElements[0]);
    expect(mockRollAbilityCheck).toHaveBeenCalledWith('Strength', 2, undefined);
  });

  it('should call rollSavingThrow when save value is clicked', () => {
    const mockRollSavingThrow = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: mockRollSavingThrow,
      rollSkillCheck: vi.fn(),
    }));

    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
      />
    );

    const saveElements = screen.getAllByText('+2');
    fireEvent.click(saveElements[saveElements.length - 1]);
    expect(mockRollSavingThrow).toHaveBeenCalledWith('Strength', 2, { forcedMode: undefined, autoFail: undefined });
  });

  it('should call rollSkillCheck when skill is clicked', () => {
    const mockRollSkillCheck = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: mockRollSkillCheck,
    }));

    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
      />
    );

    const athleticsElement = screen.getByText(/Athletics/);
    fireEvent.click(athleticsElement);
    expect(mockRollSkillCheck).toHaveBeenCalledWith('Athletics', 2, undefined);
  });

  it('should not render popup when popupHtml is null', () => {
    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
      />
    );

    expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
  });

  it('should dismiss popup when overlay is clicked', () => {
    const mockSetPopupHtml = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: { type: 'd20', name: 'Test', rolls: [1, 2], bonus: 3 },
      setPopupHtml: mockSetPopupHtml,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    }));

    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
      />
    );

    const overlay = screen.getByTestId('popup-overlay');
    fireEvent.click(overlay);

    expect(mockSetPopupHtml).toHaveBeenCalledWith(null);
  });
});
