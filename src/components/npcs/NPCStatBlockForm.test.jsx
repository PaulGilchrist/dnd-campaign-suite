// @improved-by-ai
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
  describe('section headings', () => {
    it('renders all section headings', () => {
      render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      expect(screen.getByText('Combat Stats')).toBeInTheDocument();
      expect(screen.getByText('Ability Scores')).toBeInTheDocument();
      expect(screen.getByText('Skill Bonuses')).toBeInTheDocument();
      expect(screen.getByText('Defenses')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Traits')).toBeInTheDocument();
      expect(screen.getByText('Reactions')).toBeInTheDocument();
    });
  });

  describe('combat stat inputs', () => {
    it('renders combat stat inputs with correct values', () => {
      render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);

      const acInput = screen.getByPlaceholderText('10');
      expect(acInput).toBeInTheDocument();
      expect(acInput.value).toBe('15');

      const hpInput = screen.getByPlaceholderText('e.g., 45');
      expect(hpInput).toBeInTheDocument();
      expect(hpInput.value).toBe('45');

      const hitDiceInput = screen.getByPlaceholderText('e.g., 6d8');
      expect(hitDiceInput).toBeInTheDocument();
      expect(hitDiceInput.value).toBe('6d8');
    });

    it('renders speed input with walk value', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const speedInput = container.querySelector('input[placeholder="30 ft."]');
      expect(speedInput).toBeInTheDocument();
      expect(speedInput.value).toBe('30 ft.');
    });

    it('renders initiative bonus input', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const initiativeInput = container.querySelector('input[placeholder="+0"][type="number"]');
      expect(initiativeInput).toBeInTheDocument();
    });
  });

  describe('ability scores', () => {
    it('renders all six ability labels', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const text = container.textContent;
      expect(text).toContain('STR');
      expect(text).toContain('DEX');
      expect(text).toContain('CON');
      expect(text).toContain('INT');
      expect(text).toContain('WIS');
      expect(text).toContain('CHA');
    });

    it('renders ability score inputs with correct values', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const inputs = container.querySelectorAll('.npcs-ability-input');
      expect(inputs.length).toBeGreaterThan(0);
      expect(inputs[0].value).toBe('10');
      expect(inputs[1].value).toBe('14');
      expect(inputs[2].value).toBe('12');
      expect(inputs[3].value).toBe('8');
      expect(inputs[4].value).toBe('10');
      expect(inputs[5].value).toBe('7');
    });

    it('renders ability modifiers with correct sign', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const mods = container.querySelectorAll('.npcs-ability-mod');
      expect(mods.length).toBeGreaterThan(0);
      expect(mods[0].textContent).toBe('+0');
      expect(mods[1].textContent).toBe('+2');
      expect(mods[2].textContent).toBe('+1');
      expect(mods[3].textContent).toBe('-1');
      expect(mods[4].textContent).toBe('+0');
      expect(mods[5].textContent).toBe('-2');
    });

    it('renders with negative ability modifier without extra plus sign', () => {
      const data = {
        ...defaultFormData,
        abilityScores: { str: 6, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const mods = container.querySelectorAll('.npcs-ability-mod');
      expect(mods[0].textContent).toBe('-2');
    });
  });

  describe('saving throw inputs', () => {
    it('renders saving throw inputs with correct values', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const saveInputs = [...container.querySelectorAll('.npcs-save-input')];
      expect(saveInputs.length).toBeGreaterThan(0);
      expect(saveInputs[0].value).toBe('+2');
      expect(saveInputs[1].value).toBe('+4');
      expect(saveInputs.slice(2).every(i => i.value === '')).toBeTruthy();
    });
  });

  describe('skill bonuses', () => {
    it('renders skill rows with correct values', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const skillNames = container.querySelectorAll('.npcs-skill-name');
      const skillBonuses = container.querySelectorAll('.npcs-skill-bonus');
      expect(skillNames.length).toBeGreaterThan(0);
      expect(skillBonuses.length).toBeGreaterThan(0);
      expect(skillNames[0].value).toBe('perception');
      expect(skillBonuses[0].value).toBe('+3');
      expect(skillNames[1].value).toBe('stealth');
      expect(skillBonuses[1].value).toBe('+5');
    });

    it('renders add skill and remove skill buttons', () => {
      render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      expect(screen.getByRole('button', { name: /Add Skill/i })).toBeInTheDocument();
      const removeButtons = screen.getAllByRole('button', { name: /Remove skill/i });
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    it('renders with empty skillBonuses', () => {
      const data = { ...defaultFormData, skillBonuses: {} };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      expect(screen.getByText('Skill Bonuses')).toBeInTheDocument();
      expect(container.querySelectorAll('.npcs-skill-name')).toHaveLength(0);
    });

    it('renders with null skillBonuses (falls back via ||)', () => {
      const data = { ...defaultFormData, skillBonuses: null };
      render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      expect(screen.getByText('Skill Bonuses')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Remove skill/i })).not.toBeInTheDocument();
    });
  });

  describe('defenses', () => {
    it('renders defense inputs as comma-separated values', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const resistInput = container.querySelector('input[placeholder="fire, cold, poison"]');
      const immuneInput = container.querySelector('input[placeholder="necrotic, psychic"]');
      const condInput = container.querySelector('input[placeholder="charmed, frightened"]');
      expect(resistInput.value).toBe('fire');
      expect(immuneInput.value).toBe('');
      expect(condInput.value).toBe('charmed');
    });

    it('renders with empty arrays for all defenses', () => {
      const data = {
        ...defaultFormData,
        damageResistances: [],
        damageImmunities: [],
        conditionImmunities: [],
      };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const allTextInputs = container.querySelectorAll('input[type="text"]');
      const resistInput = [...allTextInputs].find(i => i.placeholder === 'fire, cold, poison');
      expect(resistInput.value).toBe('');
    });

    it('renders with null damageResistances (falls back via ||)', () => {
      const data = { ...defaultFormData, damageResistances: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const resistInput = container.querySelector('input[placeholder="fire, cold, poison"]');
      expect(resistInput.value).toBe('');
    });

    it('renders with null damageImmunities (falls back via ||)', () => {
      const data = { ...defaultFormData, damageImmunities: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const immuneInput = container.querySelector('input[placeholder="necrotic, psychic"]');
      expect(immuneInput.value).toBe('');
    });

    it('renders with null conditionImmunities (falls back via ||)', () => {
      const data = { ...defaultFormData, conditionImmunities: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const condInput = container.querySelector('input[placeholder="charmed, frightened"]');
      expect(condInput.value).toBe('');
    });
  });

  describe('actions', () => {
    it('renders action fields with correct values', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const actionNames = container.querySelectorAll('.npcs-action-name');
      expect(actionNames.length).toBeGreaterThan(0);
      expect(actionNames[0].value).toBe('Longsword');

      const atkBonuses = container.querySelectorAll('.npcs-action-bonus');
      expect(atkBonuses[0].value).toBe('+5');

      const dmgDice = container.querySelectorAll('.npcs-action-damage');
      expect(dmgDice[0].value).toBe('1d8+3');

      const dmgTypes = container.querySelectorAll('.npcs-action-damage-type');
      expect(dmgTypes[0].value).toBe('slashing');
    });

    it('renders action description textarea', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const desc = container.querySelector('.npcs-action-desc');
      expect(desc).toBeInTheDocument();
      expect(desc.value).toBe('Melee Weapon Attack.');
    });

    it('renders add action and remove action buttons', () => {
      render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      expect(screen.getByRole('button', { name: /Add Action/i })).toBeInTheDocument();
      const removeButtons = screen.getAllByRole('button', { name: /Remove action/i });
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    it('renders with no actions', () => {
      const data = { ...defaultFormData, actions: [] };
      render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add Action/i })).toBeInTheDocument();
    });

    it('renders multiple actions', () => {
      const data = {
        ...defaultFormData,
        actions: [
          { name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8+3', damage_type_primary: 'slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
          { name: 'Shortbow', attack_bonus: '+4', damage_dice_primary: '1d6+2', damage_type_primary: 'piercing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
        ],
      };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const actionNames = container.querySelectorAll('.npcs-action-name');
      expect(actionNames.length).toBeGreaterThan(1);
      expect(actionNames[0].value).toBe('Longsword');
      expect(actionNames[1].value).toBe('Shortbow');
    });

    it('renders action with undefined fields (falls back to empty string)', () => {
      const data = {
        ...defaultFormData,
        actions: [
          { name: undefined, attack_bonus: undefined, damage_dice_primary: undefined, damage_type_primary: undefined, damage_dice_secondary: undefined, damage_type_secondary: undefined, description: undefined },
        ],
      };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const actionNames = container.querySelectorAll('.npcs-action-name');
      expect(actionNames[0].value).toBe('');
      expect(container.querySelector('.npcs-action-desc').value).toBe('');
    });
  });

  describe('traits and reactions', () => {
    it('renders traits and reactions textareas', () => {
      const { container } = render(<NPCStatBlockForm formData={defaultFormData} setFormData={vi.fn()} />);
      const textareas = container.querySelectorAll('textarea');
      expect(textareas.length).toBeGreaterThan(0);
      expect(textareas[1].value).toBe('Darkvision.');
      expect(textareas[2].value).toBe('Reaction text.');
    });

    it('renders with null traits (falls back to empty string)', () => {
      const data = { ...defaultFormData, traits: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const textareas = container.querySelectorAll('textarea');
      const traitsTextarea = [...textareas].find(t => t.placeholder.includes('Special traits'));
      expect(traitsTextarea.value).toBe('');
    });

    it('renders with null reactions (falls back to empty string)', () => {
      const data = { ...defaultFormData, reactions: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const textareas = container.querySelectorAll('textarea');
      const reactionsTextarea = [...textareas].find(t => t.placeholder.includes('Reactions'));
      expect(reactionsTextarea.value).toBe('');
    });
  });

  describe('null/undefined fallbacks', () => {
    it('renders with null armorClass', () => {
      const data = { ...defaultFormData, armorClass: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const acInput = container.querySelector('input[placeholder="10"]');
      expect(acInput.value).toBe('');
    });

    it('renders with null hitPoints (falls back to empty string)', () => {
      const data = { ...defaultFormData, hitPoints: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const hpInput = container.querySelector('input[placeholder="e.g., 45"]');
      expect(hpInput.value).toBe('');
    });

    it('renders with null hitDice (falls back to empty string)', () => {
      const data = { ...defaultFormData, hitDice: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const hdInput = container.querySelector('input[placeholder="e.g., 6d8"]');
      expect(hdInput.value).toBe('');
    });

    it('renders with null speed', () => {
      const data = { ...defaultFormData, speed: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const speedInput = container.querySelector('input[placeholder="30 ft."]');
      expect(speedInput.value).toBe('');
    });

    it('renders with null initiativeBonus (falls back via nullish coalescing)', () => {
      const data = { ...defaultFormData, initiativeBonus: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const initInput = container.querySelector('input[placeholder="+0"][type="number"]');
      expect(initInput.value).toBe('');
    });

    it('renders with null savingThrowBonuses (falls back via ||)', () => {
      const data = { ...defaultFormData, savingThrowBonuses: null };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const saveInputs = [...container.querySelectorAll('.npcs-save-input')];
      expect(saveInputs.length).toBeGreaterThan(0);
      expect(saveInputs.every(i => i.value === '')).toBeTruthy();
    });

    it('renders with undefined abilityScores', () => {
      const data = { ...defaultFormData, abilityScores: undefined };
      const { container } = render(<NPCStatBlockForm formData={data} setFormData={vi.fn()} />);
      const inputs = container.querySelectorAll('.npcs-ability-input');
      expect(inputs.length).toBeGreaterThan(0);
      expect(inputs[0].value).toBe('10');
    });
  });
});
