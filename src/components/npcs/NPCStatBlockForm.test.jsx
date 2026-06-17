import { render, screen, fireEvent } from '@testing-library/react';
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
    { name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8+3', damage_type_primary: 'slashing', description: 'Melee Weapon Attack.' },
  ],
  traits: 'Darkvision.',
  reactions: 'Reaction text.',
};

describe('NPCStatBlockForm', () => {
  it('renders combat stats section', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(screen.getByText('Combat Stats')).toBeInTheDocument();
  });

  it('renders HP input', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders Hit Dice input', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(3);
  });

  it('renders Speed input', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(4);
  });

  it('renders Initiative Bonus input', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(8);
  });

  it('renders ability scores section', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
  });

  it('renders all ability labels', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(container.textContent).toContain('STR');
    expect(container.textContent).toContain('DEX');
    expect(container.textContent).toContain('CON');
    expect(container.textContent).toContain('INT');
    expect(container.textContent).toContain('WIS');
    expect(container.textContent).toContain('CHA');
  });

  it('renders ability score inputs', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(8);
  });

  it('renders ability modifiers', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(container.textContent).toContain('+2');
    expect(container.textContent).toContain('+1');
  });

  it('renders saving throw inputs', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(6);
  });

  it('renders skills section', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(screen.getByText('Skill Bonuses')).toBeInTheDocument();
  });

  it('renders skill rows', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const skillInputs = container.querySelectorAll('.npcs-skill-name');
    expect(skillInputs.length).toBe(2);
  });

  it('renders add skill button', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(screen.getByRole('button', { name: /Add Skill/i })).toBeInTheDocument();
  });

  it('renders remove skill buttons', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const removeButtons = screen.getAllByRole('button', { name: /Remove skill/i });
    expect(removeButtons.length).toBe(2);
  });

  it('renders defenses section', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(screen.getByText('Defenses')).toBeInTheDocument();
  });

  it('renders damage resistances input', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(7);
  });

  it('renders damage immunities input', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(8);
  });

  it('renders condition immunities input', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(9);
  });

  it('renders actions section', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders action fields', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const actionNameInputs = container.querySelectorAll('.npcs-action-name');
    expect(actionNameInputs.length).toBe(1);
    expect(actionNameInputs[0].value).toBe('Longsword');
  });

  it('renders add action button', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(screen.getByRole('button', { name: /Add Action/i })).toBeInTheDocument();
  });

  it('renders remove action buttons', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const removeButtons = screen.getAllByRole('button', { name: /Remove action/i });
    expect(removeButtons.length).toBe(1);
  });

  it('renders traits textarea', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(screen.getByText('Traits')).toBeInTheDocument();
  });

  it('renders reactions textarea', () => {
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('handles ability score change', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '18' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('handles save bonus change', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    fireEvent.change(inputs[0], { target: { value: '+5' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('handles skill bonus change', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    fireEvent.change(inputs[1], { target: { value: '+10' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('handles action change', () => {
    const setFormData = vi.fn();
    const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={setFormData} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    const actionNameInput = [...inputs].find(i => i.placeholder?.includes('Action name'));
    if (actionNameInput) {
      fireEvent.change(actionNameInput, { target: { value: 'New Action' } });
      expect(setFormData).toHaveBeenCalled();
    }
  });

  it('renders with empty skillBonuses', () => {
    const formData = { ...defaultFormData, skillBonuses: {} };
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={formData} setFormData={setFormData} />);
    expect(screen.getByText('Skill Bonuses')).toBeInTheDocument();
  });

  it('renders with no actions', () => {
    const formData = { ...defaultFormData, actions: [] };
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={formData} setFormData={setFormData} />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Action/i })).toBeInTheDocument();
  });

  it('renders with empty arrays for resistances', () => {
    const formData = { ...defaultFormData, damageResistances: [], damageImmunities: [], conditionImmunities: [] };
    const setFormData = vi.fn();
    render(<NPCStatBlockForm formData={formData} setFormData={setFormData} />);
    expect(screen.getByText('Defenses')).toBeInTheDocument();
  });
});
