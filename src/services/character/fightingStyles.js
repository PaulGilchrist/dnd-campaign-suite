export const FIGHTING_STYLES = {
  'Archery': {
    name: 'Archery',
    description: 'You get a +2 bonus to attack rolls you make with ranged weapons.'
  },
  'Blind Fighting': {
    name: 'Blind Fighting',
    description: 'You gain blindvision with a range of 10 feet. Blindvision works exactly like normal vision, except it works in total darkness and dim light does not impose the blinded condition on you. You can use this feature once before finishing a long rest.'
  },
  'Defense': {
    name: 'Defense',
    description: 'While you are wearing armor, you gain a +1 bonus to AC.'
  },
  'Dueling': {
    name: 'Dueling',
    description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.'
  },
  'Great Weapon Fighting': {
    name: 'Great Weapon Fighting',
    description: 'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.'
  },
  'Interception': {
    name: 'Interception',
    description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You can then reduce the damage the target takes by 1d10 + your proficiency bonus. You must be holding a shield to use this feature.'
  },
  'Protection': {
    name: 'Protection',
    description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.'
  },
  'Thrown Weapon Fighting': {
    name: 'Thrown Weapon Fighting',
    description: 'You can treat any short sword that you hold with one hand as if it had the thrown property, and you can make ranged attacks with a short sword as if you had the light property with it. When you make a ranged attack roll with a thrown weapon, you add your proficiency bonus to the attack roll.'
  },
  'Two-Weapon Fighting': {
    name: 'Two-Weapon Fighting',
    description: 'If you are wielding a light melee weapon that you are holding in one hand, a light melee weapon that you are holding in the other hand, and no armor shields, you can add your ability modifier to the damage of the second attack.'
  },
  'Unarmed Fighting': {
    name: 'Unarmed Fighting',
    description: 'While you are unarmed and not holding anything in both hands, you gain a +2 bonus to AC.'
  },
  'Blessed Warrior': {
    name: 'Blessed Warrior',
    description: 'You gain a +2 bonus to attack rolls you make with melee weapons.'
  },
  'Druidic Warrior': {
    name: 'Druidic Warrior',
    description: 'You gain a +2 bonus to damage rolls you make with melee weapons.'
  },
  'Superior Technique': {
    name: 'Superior Technique',
    description: 'You learn one maneuver of your choice from the Battle Master. You can use your superiority dice to fuel that maneuver. Whenever you finish a short or long rest, you can choose a different maneuver from the Battle Master to replace the maneuver.'
  }
};

export function getFightingStyle(name) { return FIGHTING_STYLES[name] || null; }
