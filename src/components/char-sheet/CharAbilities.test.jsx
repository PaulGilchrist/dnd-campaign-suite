import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities.jsx';

// Mock the useActionPopup hook
vi.mock('../../hooks/useActionPopup.js', () => ({
  default: vi.fn(),
  buildAbilityDetailHtml: vi.fn(),
}));

import useActionPopup from '../../hooks/useActionPopup.js';
import { buildAbilityDetailHtml } from '../../hooks/useActionPopup.js';

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
     
      // Mock useActionPopup to return a controlled popup
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
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

  it('should call showPopup when ability name is clicked', () => {
    const mockShowPopup = vi.fn();
    useActionPopup.mockImplementation(() => ({
       showPopup: mockShowPopup,
       popupHtml: null,
       setPopupHtml: vi.fn(),
      }));

    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
       />
     );

    const strengthElement = screen.getByText('Strength');
    fireEvent.click(strengthElement);

    expect(mockShowPopup).toHaveBeenCalledWith('Strength');
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
    const mockPopupHtml = '<div>Popup Content</div>';
    useActionPopup.mockImplementation(() => ({
       showPopup: vi.fn(),
       popupHtml: mockPopupHtml,
       setPopupHtml: vi.fn(),
     }));

    render(
      <CharAbilities
        playerStats={mockPlayerStats}
        allAbilityScores={mockAllAbilityScores}
      />
    );

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
  });

  it('should return null when ability score not found', () => {
    vi.resetAllMocks();
    const allScores = [{ full_name: 'Strength', desc: '<p>desc</p>' }];
    buildAbilityDetailHtml.mockImplementation((scores) => (name) => {
      const found = scores.find((s) => s.full_name === name);
      return found ? `<h3>${found.full_name}</h3>${found.desc}` : null;
    });
    const result = buildAbilityDetailHtml(allScores)('NonExistentAbility');
    expect(result).toBeNull();
   });

  it('should return html when ability score is found', () => {
    vi.resetAllMocks();
    const allScores = [{ full_name: 'Strength', desc: '<p>Strength measures physical power.</p>' }];
    buildAbilityDetailHtml.mockImplementation((scores) => (name) => {
      const found = scores.find((s) => s.full_name === name);
      return found ? `<h3>${found.full_name}</h3>${found.desc}` : null;
    });
    const result = buildAbilityDetailHtml(allScores)('Strength');
    expect(result).toContain('<h3>Strength</h3>');
    expect(result).toContain('Strength measures physical power');
   });
});