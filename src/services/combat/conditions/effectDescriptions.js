/**
 * Badge descriptions for initiative tracker creature cards.
 * Condition descriptions sourced from public/data/conditions.json.
 */

// Condition badge descriptions from conditions.json
export const CONDITION_DESCRIPTIONS = {
    'Blinded': 'You can\'t see and automatically fail ability checks that require sight. Attack rolls against you have Advantage, and your attack rolls have Disadvantage.',
    'Charmed': 'You can\'t attack the charmer or target them with damaging abilities. The charmer has Advantage on social ability checks against you.',
    'Deafened': 'You can\'t hear and automatically fail ability checks that require hearing.',
    'Frightened': 'You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight. You can\'t willingly move closer to the source of fear.',
    'Grappled': 'Your Speed is 0 and can\'t increase. You have Disadvantage on attack rolls against any target other than the grappler.',
    'Incapacitated': 'You can\'t take any action, Bonus Action, or Reaction. Your Concentration is broken.',
    'Paralyzed': 'You have the Incapacitated condition. Your Speed is 0. You automatically fail Strength and Dexterity saving throws. Attack rolls that hit you are Critical Hits if the attacker is within 5 feet.',
    'Petrified': 'You are transformed into an inanimate substance. You have the Incapacitated condition, Speed 0, and Resistance to all damage. You automatically fail Strength and Dexterity saving throws.',
    'Poisoned': 'You have Disadvantage on attack rolls and ability checks.',
    'Prone': 'Your only movement is to crawl. Attack rolls against you have Advantage if the attacker is within 5 feet, otherwise Disadvantage.',
    'Restrained': 'Your Speed is 0. Attack rolls against you have Advantage, and your attack rolls have Disadvantage. You have Disadvantage on Dexterity saving throws.',
    'Stunned': 'You have the Incapacitated condition. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage.',
    'Unconscious': 'You have the Incapacitated and Prone conditions. Your Speed is 0. You automatically fail Strength and Dexterity saving throws. Attack rolls that hit you are Critical Hits if the attacker is within 5 feet. You are unaware of your surroundings.',
    'Cursed': 'You have disadvantage on attack rolls and ability checks.',
    'Dazed': 'On next turn, the creature can only do one of: move OR take action OR use a Bonus Action.',
}

// Effect badge descriptions for badges not covered by conditions
export const EFFECT_DESCRIPTIONS = {
    'Disadv': 'Has disadvantage on attack rolls and/or ability checks.',
    'STR Disadv': 'Has disadvantage on Strength checks (e.g., from Ray of Enfeeblement).',
    'Adv vs': 'Attackers have advantage on attack rolls against this creature.',
    'Disadv vs': 'Attackers have disadvantage on attack rolls against this creature.',
    'Save Disadv': 'Has disadvantage on its next saving throw.',
    '-1d8 dmg': 'Damage dealt by this creature is reduced by 1d8 (e.g., from Ray of Enfeeblement).',
    'Speed -N': 'Speed is reduced by N feet.',
    '+N to hit': 'Attackers gain a +N bonus to hit this creature.',
    'No OA': 'Cannot make opportunity attacks.',
    'Insp. Move': 'Inspiring Movement: the creature does not provoke opportunity attacks when moving.',
    'No OA (Crit)': 'Remarkable Athlete: the creature does not provoke opportunity attacks on critical hits.',
    'OA Disadv': 'Opportunity attacks against this creature have disadvantage.',
    'No Difficult Terrain on Dash': 'Can ignore difficult terrain when taking the Dash action.',
    'Disadv Fire/Radiant': 'Has disadvantage on saving throws against Fire and Radiant damage.',
}

// HP status descriptions
export const HP_STATUS_DESCRIPTIONS = {
    'DEAD': 'Creature is at 0 or fewer hit points.',
    'BLOODIED': 'Creature is at half or fewer hit points.',
    'OK': 'Creature is above half hit points.',
}
