// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCStatBlockForm from './NPCStatBlockForm';

const defaultFormData = {
  name: 'Goblin',
  race: 'Humanoid',
  classRole: 'Scout',
  armorClass: 15,
  hitPoints: '45',
  hitDice: '6d8',
  speed: { walk: '30 ft.' },
  initiativeBonus: '+2',
  abilityScores: { str: 10, dex: 14, con: 12, int: 8, wis: 10, cha: 7 },
  savingThrowBonuses: { str: '+2', dex: '+4' },
  skillBonuses: { perception: '+3', stealth: '+5' },
  damageResistances: ['fire'],
  damageImmunities: [],
  conditionImmunities: ['charmed'],
  actions: [
    { name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8+3', damage_type_primary: 'slashing', damage_dice_secondary: '', damage_type_secondary: '', description: 'Melee Weapon Attack.' },
  ],
  traits: 'Darkvision.',
  reactions: 'Reaction text.',
};

describe('NPCStatBlockForm', () => {
  it('renders without crashing', () => {
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
  });

  it('renders section headings', () => {
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
    expect(screen.getByText('Combat Stats')).toBeInTheDocument();
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
    expect(screen.getByText('Skill Bonuses')).toBeInTheDocument();
    expect(screen.getByText('Defenses')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Traits')).toBeInTheDocument();
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('renders with empty arrays for all defenses', () => {
    const data = {
      ...defaultFormData,
      damageResistances: [],
      damageImmunities: [],
      conditionImmunities: [],
    };
    render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
    expect(screen.getByText('Combat Stats')).toBeInTheDocument();
  });

  it('renders with undefined actions', () => {
    const data = { ...defaultFormData, actions: undefined };
    render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});
