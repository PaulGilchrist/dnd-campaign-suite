import { render, screen, fireEvent } from '@testing-library/react';
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

function getUpdater(setFormData) {
  expect(setFormData).toHaveBeenCalledTimes(1);
  return setFormData.mock.calls[0][0];
}

function applyUpdater(updater, prev) {
  return updater(prev);
}

describe('NPCStatBlockForm interactions', () => {
  describe('Combat Stats field changes', () => {
    function getAcInput(container) {
      return container.querySelector('input[placeholder="10"]');
    }
    function getHpInput(container) {
      return container.querySelector('input[placeholder="e.g., 45"]');
    }
    function getHdInput(container) {
      return container.querySelector('input[placeholder="e.g., 6d8"]');
    }
    function getSpeedInput(container) {
      return container.querySelector('input[placeholder="30 ft."]');
    }
    function getInitInput(container) {
      return container.querySelector('input[placeholder="+0"][type="number"]');
    }

    it('handles AC change with a numeric value', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.change(getAcInput(container), { target: { value: '18' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.armorClass).toBe(18);
    });

    it('handles AC change with empty value (sets null)', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.change(getAcInput(container), { target: { value: '' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.armorClass).toBeNull();
    });

    it('handles HP change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.change(getHpInput(container), { target: { value: '55' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.hitPoints).toBe('55');
    });

    it('handles Hit Dice change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.change(getHdInput(container), { target: { value: '8d10' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.hitDice).toBe('8d10');
    });

    it('handles Speed change and preserves other speed properties', () => {
      const setFormData = vi.fn();
      const formWithExtraSpeed = {
        ...baseFormData,
        speed: { walk: '30 ft.', climb: '15 ft.' },
      };
      const { container } = render(<NPCStatBlockForm formData={formWithExtraSpeed} setFormData={setFormData} />);
      fireEvent.change(getSpeedInput(container), { target: { value: '40 ft.' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, formWithExtraSpeed);
      expect(result.speed.walk).toBe('40 ft.');
      expect(result.speed.climb).toBe('15 ft.');
    });

    it('handles Initiative Bonus change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={{ ...baseFormData, initiativeBonus: '' }} setFormData={setFormData} />);
      fireEvent.change(getInitInput(container), { target: { value: '5' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, { ...baseFormData, initiativeBonus: '' });
      expect(result.initiativeBonus).toBe('5');
    });
  });

  describe('Ability score changes', () => {
    it('handles STR ability score change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const inputs = container.querySelectorAll('.npcs-ability-input');
      fireEvent.change(inputs[0], { target: { value: '18' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.abilityScores.str).toBe(18);
      expect(result.abilityScores.dex).toBe(14);
    });

    it('handles DEX ability score change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const inputs = container.querySelectorAll('.npcs-ability-input');
      fireEvent.change(inputs[1], { target: { value: '16' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.abilityScores.dex).toBe(16);
    });

    it('handles ability score change with invalid input (defaults to 0)', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const inputs = container.querySelectorAll('.npcs-ability-input');
      fireEvent.change(inputs[0], { target: { value: 'abc' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.abilityScores.str).toBe(0);
    });

    it('handles ability score change with empty string (defaults to 0)', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const inputs = container.querySelectorAll('.npcs-ability-input');
      fireEvent.change(inputs[0], { target: { value: '' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.abilityScores.str).toBe(0);
    });
  });

  describe('Saving throw changes', () => {
    it('handles STR save bonus change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const saveInputs = container.querySelectorAll('.npcs-save-input');
      fireEvent.change(saveInputs[0], { target: { value: '+5' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.savingThrowBonuses.str).toBe('+5');
    });

    it('handles CON save bonus change (previously undefined)', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const saveInputs = container.querySelectorAll('.npcs-save-input');
      fireEvent.change(saveInputs[2], { target: { value: '+3' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.savingThrowBonuses.con).toBe('+3');
    });
  });

  describe('Skill bonus changes', () => {
    it('handles changing an existing skill bonus', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const skillBonusInputs = container.querySelectorAll('.npcs-skill-bonus');
      fireEvent.change(skillBonusInputs[0], { target: { value: '+6' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.skillBonuses.perception).toBe('+6');
    });

    it('adds a new skill via Add Skill button', () => {
      const setFormData = vi.fn();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Skill/i }));
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.skillBonuses['']).toBe('');
    });

    it('removes a skill via remove button', () => {
      const setFormData = vi.fn();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const removeButtons = screen.getAllByRole('button', { name: /Remove skill/i });
      fireEvent.click(removeButtons[0]);
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.skillBonuses.perception).toBeUndefined();
      expect(result.skillBonuses.stealth).toBe('+5');
    });

    it('renames a skill by changing its name input', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const skillNameInputs = container.querySelectorAll('.npcs-skill-name');
      fireEvent.change(skillNameInputs[0], { target: { value: 'investigation' } });

      expect(setFormData).toHaveBeenCalledTimes(2);
      const removeUpdater = setFormData.mock.calls[0][0];
      const removeResult = removeUpdater(baseFormData);
      expect(removeResult.skillBonuses.perception).toBeUndefined();

      const addUpdater = setFormData.mock.calls[1][0];
      const addResult = addUpdater(baseFormData);
      expect(addResult.skillBonuses.investigation).toBe('+3');
    });

    it('does not rename on same name', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const skillNameInputs = container.querySelectorAll('.npcs-skill-name');
      fireEvent.change(skillNameInputs[0], { target: { value: 'perception' } });
      expect(setFormData).not.toHaveBeenCalled();
    });
  });

  describe('Defense array field changes', () => {
    it('handles damage resistances change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const resistInput = container.querySelector('input[placeholder="fire, cold, poison"]');
      fireEvent.change(resistInput, { target: { value: 'fire, cold, lightning' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.damageResistances).toEqual(['fire', 'cold', 'lightning']);
    });

    it('handles damage immunities change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const immuneInput = container.querySelector('input[placeholder="necrotic, psychic"]');
      fireEvent.change(immuneInput, { target: { value: 'necrotic' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.damageImmunities).toEqual(['necrotic']);
    });

    it('handles condition immunities change with empty string', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const condInput = container.querySelector('input[placeholder="charmed, frightened"]');
      fireEvent.change(condInput, { target: { value: '' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.conditionImmunities).toEqual([]);
    });

    it('handles comma-separated input with extra spaces', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const resistInput = container.querySelector('input[placeholder="fire, cold, poison"]');
      fireEvent.change(resistInput, { target: { value: '  fire  ,  cold  ,  lightning  ' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.damageResistances).toEqual(['fire', 'cold', 'lightning']);
    });
  });

  describe('Action field changes', () => {
    it('handles action name change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const nameInput = container.querySelector('.npcs-action-name');
      fireEvent.change(nameInput, { target: { value: 'Greatsword' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.actions[0].name).toBe('Greatsword');
    });

    it('handles action attack bonus change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const atkBonusInput = container.querySelector('.npcs-action-bonus');
      fireEvent.change(atkBonusInput, { target: { value: '+7' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.actions[0].attack_bonus).toBe('+7');
    });

    it('handles action damage dice change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const dmgInput = container.querySelector('.npcs-action-damage');
      fireEvent.change(dmgInput, { target: { value: '2d6+5' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.actions[0].damage_dice_primary).toBe('2d6+5');
    });

    it('handles action damage type change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const typeInput = container.querySelector('.npcs-action-damage-type');
      fireEvent.change(typeInput, { target: { value: 'piercing' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.actions[0].damage_type_primary).toBe('piercing');
    });

    it('handles action secondary damage dice change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const secInput = container.querySelector('.npcs-action-damage-secondary');
      fireEvent.change(secInput, { target: { value: '1d6' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.actions[0].damage_dice_secondary).toBe('1d6');
    });

    it('handles action secondary damage type change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const secTypeInput = container.querySelector('.npcs-action-damage-type-secondary');
      fireEvent.change(secTypeInput, { target: { value: 'fire' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.actions[0].damage_type_secondary).toBe('fire');
    });

    it('handles action description change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const descTextarea = container.querySelector('.npcs-action-desc');
      fireEvent.change(descTextarea, { target: { value: 'New description.' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.actions[0].description).toBe('New description.');
    });

    it('adds a new action via Add Action button', () => {
      const setFormData = vi.fn();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Action/i }));
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.actions).toHaveLength(2);
      expect(result.actions[1]).toEqual({
        name: '', attack_bonus: '', damage_dice_primary: '', damage_type_primary: '',
        damage_dice_secondary: '', damage_type_secondary: '', description: '',
      });
    });

    it('removes an action via remove button', () => {
      const setFormData = vi.fn();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const removeBtn = screen.getByRole('button', { name: /Remove action/i });
      fireEvent.click(removeBtn);
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.actions).toHaveLength(0);
    });

    it('removes the correct action when multiple exist', () => {
      const setFormData = vi.fn();
      const data = {
        ...baseFormData,
        actions: [
          { name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8+3', damage_type_primary: 'slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
          { name: 'Shortbow', attack_bonus: '+4', damage_dice_primary: '1d6+2', damage_type_primary: 'piercing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
        ],
      };
      render(<NPCStatBlockForm formData={data} setFormData={setFormData} />);
      const removeButtons = screen.getAllByRole('button', { name: /Remove action/i });
      expect(removeButtons).toHaveLength(2);
      fireEvent.click(removeButtons[0]);
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, data);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Shortbow');
    });

    it('adds action when actions is null/undefined', () => {
      const setFormData = vi.fn();
      const data = { ...baseFormData, actions: undefined };
      render(<NPCStatBlockForm formData={data} setFormData={setFormData} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Action/i }));
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, data);
      expect(result.actions).toHaveLength(1);
    });

    it('handleActionChange works when prev.actions is undefined', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const nameInput = container.querySelector('.npcs-action-name');
      fireEvent.change(nameInput, { target: { value: 'Greatsword' } });
      const updater = setFormData.mock.calls[0][0];
      const prev = { ...baseFormData, actions: undefined };
      const result = updater(prev);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Greatsword');
    });

    it('handleRemoveAction works when prev.actions is undefined', () => {
      const setFormData = vi.fn();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const removeBtn = screen.getByRole('button', { name: /Remove action/i });
      fireEvent.click(removeBtn);
      const updater = setFormData.mock.calls[0][0];
      const prev = { ...baseFormData, actions: undefined };
      const result = updater(prev);
      expect(result.actions).toEqual([]);
    });
  });

  describe('Textarea field changes', () => {
    function getTraitsTextarea(container) {
      return [...container.querySelectorAll('textarea')]
        .find(t => t.placeholder.includes('Special traits'));
    }
    function getReactionsTextarea(container) {
      return [...container.querySelectorAll('textarea')]
        .find(t => t.placeholder.includes('Reactions'));
    }

    it('handles traits textarea change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.change(getTraitsTextarea(container), { target: { value: 'Darkvision 60 ft.\nKeen Senses.' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.traits).toBe('Darkvision 60 ft.\nKeen Senses.');
    });

    it('handles reactions textarea change', () => {
      const setFormData = vi.fn();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.change(getReactionsTextarea(container), { target: { value: 'Opportunity Attack.' } });
      const updater = getUpdater(setFormData);
      const result = applyUpdater(updater, baseFormData);
      expect(result.reactions).toBe('Opportunity Attack.');
    });
  });
});
