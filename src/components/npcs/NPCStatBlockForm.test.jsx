// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCStatBlockForm from './NPCStatBlockForm';

const baseFormData = {
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

describe('NPCStatBlockForm rendering', () => {
  it('renders without crashing with full formData', () => {
    render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
  });

  it('renders with minimal/empty formData', () => {
    const minimalData = {
      armorClass: 10,
      hitPoints: '',
      hitDice: '',
      speed: { walk: '30 ft.' },
      initiativeBonus: '',
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      savingThrowBonuses: {},
      skillBonuses: {},
      damageResistances: [],
      damageImmunities: [],
      conditionImmunities: [],
      actions: [],
      traits: '',
      reactions: '',
    };
    render(<NPCStatBlockForm formData={minimalData} setFormData={vi.fn()} />);
    expect(screen.getByText('Combat Stats')).toBeInTheDocument();
  });

  it('renders all section headings', () => {
    render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    expect(screen.getByText('Combat Stats')).toBeInTheDocument();
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
    expect(screen.getByText('Skill Bonuses')).toBeInTheDocument();
    expect(screen.getByText('Defenses')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Traits')).toBeInTheDocument();
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('renders all six ability score labels', () => {
    render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    expect(screen.getByText('STR')).toBeInTheDocument();
    expect(screen.getByText('DEX')).toBeInTheDocument();
    expect(screen.getByText('CON')).toBeInTheDocument();
    expect(screen.getByText('INT')).toBeInTheDocument();
    expect(screen.getByText('WIS')).toBeInTheDocument();
    expect(screen.getByText('CHA')).toBeInTheDocument();
  });

  it('displays existing skill names in the skills section', () => {
    const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    const skillNameInputs = container.querySelectorAll('.npcs-skill-name');
    expect(skillNameInputs[0].value).toBe('perception');
    expect(skillNameInputs[1].value).toBe('stealth');
  });

  it('displays existing defense values', () => {
    render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    expect(screen.getByDisplayValue('fire')).toBeInTheDocument();
    expect(screen.getByDisplayValue('charmed')).toBeInTheDocument();
  });

  it('displays existing action data', () => {
    render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    expect(screen.getByDisplayValue('Longsword')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1d8+3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('slashing')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Melee Weapon Attack.')).toBeInTheDocument();
  });

  it('renders with undefined actions', () => {
    const data = { ...baseFormData, actions: undefined };
    render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders with empty arrays for all defenses', () => {
    const data = {
      ...baseFormData,
      damageResistances: [],
      damageImmunities: [],
      conditionImmunities: [],
    };
    render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
    expect(screen.getByText('Combat Stats')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('fire')).toBeNull();
  });

  it('renders textarea for traits and reactions', () => {
    const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    const textareas = container.querySelectorAll('textarea');
    // Should have traits textarea, reactions textarea, and action description textarea
    expect(textareas).toHaveLength(3);
  });

  it('renders Add Skill button', () => {
    render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add Skill/i })).toBeInTheDocument();
  });

  it('renders Add Action button', () => {
    render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add Action/i })).toBeInTheDocument();
  });

  it('renders remove buttons for existing skills', () => {
    render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    const removeButtons = screen.getAllByRole('button', { name: /Remove skill/i });
    expect(removeButtons).toHaveLength(2);
  });

  it('renders remove button for existing action', () => {
    render(<NPCStatBlockForm formData={baseFormData} setFormData={vi.fn()} />);
    const removeButtons = screen.getAllByRole('button', { name: /Remove action/i });
    expect(removeButtons).toHaveLength(1);
  });

  it('does not render remove buttons when no skills exist', () => {
    const data = { ...baseFormData, skillBonuses: {} };
    render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
    const removeButtons = screen.queryAllByRole('button', { name: /Remove skill/i });
    expect(removeButtons).toHaveLength(0);
  });

  it('does not render remove buttons when no actions exist', () => {
    const data = { ...baseFormData, actions: [] };
    render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
    const removeButtons = screen.queryAllByRole('button', { name: /Remove action/i });
    expect(removeButtons).toHaveLength(0);
  });
});
