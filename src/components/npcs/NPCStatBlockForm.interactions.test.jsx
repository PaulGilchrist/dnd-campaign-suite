// @cleaned-by-ai
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

function getSetFormData() {
  const setFormData = vi.fn();
  return { setFormData, getUpdates: () => {
    const updates = setFormData.mock.calls.map(call => call[0]);
    return updates;
  }};
}

describe('NPCStatBlockForm interactions', () => {
  describe('Speed change preserves other speed properties', () => {
    it('retains climb speed when walk is edited', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const formWithExtraSpeed = {
        ...baseFormData,
        speed: { walk: '30 ft.', climb: '15 ft.' },
      };
      const { container } = render(<NPCStatBlockForm formData={formWithExtraSpeed} setFormData={setFormData} />);
      const speedInput = container.querySelector('input[placeholder="30 ft."]');
      fireEvent.change(speedInput, { target: { value: '40 ft.' } });
      const updates = getUpdates();
      const result = updates[0](formWithExtraSpeed);
      expect(result.speed.walk).toBe('40 ft.');
      expect(result.speed.climb).toBe('15 ft.');
    });
  });

  describe('Skill bonus mutations', () => {
    it('adds a new skill via Add Skill button', () => {
      const { setFormData, getUpdates } = getSetFormData();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Skill/i }));
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.skillBonuses['']).toBe('');
    });

    it('removes a skill via remove button', () => {
      const { setFormData, getUpdates } = getSetFormData();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const removeButtons = screen.getAllByRole('button', { name: /Remove skill/i });
      fireEvent.click(removeButtons[0]);
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.skillBonuses.perception).toBeUndefined();
      expect(result.skillBonuses.stealth).toBe('+5');
    });

    it('renames a skill by changing its name input', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const skillNameInputs = container.querySelectorAll('.npcs-skill-name');
      fireEvent.change(skillNameInputs[0], { target: { value: 'investigation' } });

      const updates = getUpdates();
      expect(updates.length).toBe(2);
      const removeResult = updates[0](baseFormData);
      expect(removeResult.skillBonuses.perception).toBeUndefined();
      const addResult = updates[1](baseFormData);
      expect(addResult.skillBonuses.investigation).toBe('+3');
    });

    it('does not rename when the name is unchanged', () => {
      const { setFormData } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const skillNameInputs = container.querySelectorAll('.npcs-skill-name');
      fireEvent.change(skillNameInputs[0], { target: { value: 'perception' } });
      expect(setFormData).not.toHaveBeenCalled();
    });
  });

  describe('Defense array field parsing', () => {
    it('parses comma-separated values with extra spaces', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const resistInput = container.querySelector('input[placeholder="fire, cold, poison"]');
      fireEvent.change(resistInput, { target: { value: '  fire  ,  cold  ,  lightning  ' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.damageResistances).toEqual(['fire', 'cold', 'lightning']);
    });

    it('clears condition immunities on empty string', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const condInput = container.querySelector('input[placeholder="charmed, frightened"]');
      fireEvent.change(condInput, { target: { value: '' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.conditionImmunities).toEqual([]);
    });
  });

  describe('Action mutations', () => {
    it('adds a new action via Add Action button', () => {
      const { setFormData, getUpdates } = getSetFormData();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Action/i }));
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions).toHaveLength(2);
      expect(result.actions[1]).toEqual({
        name: '', attack_bonus: '', damage_dice_primary: '', damage_type_primary: '',
        damage_dice_secondary: '', damage_type_secondary: '', description: '',
      });
    });

    it('removes an action via remove button', () => {
      const { setFormData, getUpdates } = getSetFormData();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const removeBtn = screen.getByRole('button', { name: /Remove action/i });
      fireEvent.click(removeBtn);
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions).toHaveLength(0);
    });

    it('removes the correct action when multiple exist', () => {
      const { setFormData, getUpdates } = getSetFormData();
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
      const updates = getUpdates();
      const result = updates[0](data);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Shortbow');
    });

    it('adds action when actions is undefined', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const data = { ...baseFormData, actions: undefined };
      render(<NPCStatBlockForm formData={data} setFormData={setFormData} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Action/i }));
      const updates = getUpdates();
      const result = updates[0](data);
      expect(result.actions).toHaveLength(1);
    });

    it('handles action change when prev.actions is undefined', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const nameInput = container.querySelector('.npcs-action-name');
      fireEvent.change(nameInput, { target: { value: 'Greatsword' } });
      const updates = getUpdates();
      const prev = { ...baseFormData, actions: undefined };
      const result = updates[0](prev);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Greatsword');
    });
  });
});
