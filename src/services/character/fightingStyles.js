export const FIGHTING_STYLES = {
  'Great Weapon Fighting': {
    name: 'Great Weapon Fighting',
    description: 'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.'
  },
  'Protection': {
    name: 'Protection',
    description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.'
  }
};

export function getFightingStyle(name) { return FIGHTING_STYLES[name] || null; }
