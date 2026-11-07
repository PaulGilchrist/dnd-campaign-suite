// Hover-tooltip descriptions for the base actions listed in public/data/actions.json.
// Names here must cover every entry in that file. Kept separate from the JSON so the
// shared data file stays a plain name list (existing fetch/mock contract).
export const BASE_ACTION_DESCRIPTIONS = {
    Attack: 'Make one melee or ranged attack against a target within reach or range.',
    'Cast a Spell': 'Cast a spell with a casting time of 1 action.',
    Dash: 'Gain extra movement for the current turn, equal to your speed after modifiers.',
    Disengage: 'Your movement does not provoke opportunity attacks for the rest of the turn.',
    // 2014 PHB: Dodge also grants advantage on Dexterity saving throws. The 2024
    // version is attack-roll disadvantage only — mirrors the dexSaveClause branch
    // in useCharActionsBaseActions.handleDodgeAction.
    Dodge: 'Until the start of your next turn, attack rolls against you have disadvantage and you have advantage on Dexterity saving throws. You lose this benefit if you are incapacitated.',
    Dodge2024: 'Until the start of your next turn, attack rolls against you have disadvantage. You lose this benefit if you are incapacitated.',
    Grapple: 'Special melee attack: contest your Strength (Athletics) against the target\u2019s Athletics or Acrobatics \u2014 on a win its speed becomes 0. Click to roll.',
    Help: 'Give an ally advantage on their next ability check, or fight a creature to give an ally advantage on their next attack roll against it.',
    Hide: 'Make a Dexterity (Stealth) check to become hidden from other creatures. Click to roll.',
    Improvise: 'Attempt something the other actions do not cover \u2014 work out how it plays out with the DM.',
    Ready: 'Choose a trigger, then use your reaction to take the readied action or cast a readied spell when it occurs.',
    Search: 'Make a Wisdom (Perception) or Intelligence (Investigation) check to spot something hidden.',
    Shove: 'Special melee attack: push a creature up to 5 feet away or knock it prone.',
    'Use an Object': 'Interact with an object as normal, or act with an item that requires an action to use.',
};

// Resolve the hover tooltip for one base action name. Dodge is ruleset-aware.
export function getBaseActionTooltip(actionName, rules) {
    if (actionName === 'Dodge') {
        return rules === '2024' ? BASE_ACTION_DESCRIPTIONS.Dodge2024 : BASE_ACTION_DESCRIPTIONS.Dodge;
    }
    return BASE_ACTION_DESCRIPTIONS[actionName];
}
