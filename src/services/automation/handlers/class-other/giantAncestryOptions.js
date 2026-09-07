export const GIANT_ANCESTRY_KEY = 'giantAncestrySelection';

export const GIANT_OPTIONS = [
    {
        name: "Cloud's Jaunt",
        type: 'teleport',
        range: '30_ft',
        description: 'Teleport up to 30 feet to an unoccupied space you can see.',
        icon: 'fa-cloud',
    },
    {
        name: "Fire's Burn",
        type: 'damage',
        damage: '1d10',
        damageType: 'Fire',
        description: 'Deal 1d10 fire damage to a creature within 30 feet.',
        icon: 'fa-fire',
    },
    {
        name: "Frost's Chill",
        type: 'damage_with_condition',
        damage: '1d6',
        damageType: 'Cold',
        condition: 'speed_reduction',
        value: '10_ft',
        description: 'Deal 1d6 cold damage and reduce target speed by 10 feet for 1 minute.',
        icon: 'fa-snowflake',
    },
    {
        name: "Hill's Tumble",
        type: 'auto_effect',
        trigger: 'melee_hit',
        effect: 'prone',
        description: 'When you hit a creature with a melee attack, you can knock it prone.',
        icon: 'fa-person-falling',
    },
    {
        name: "Stone's Endurance",
        type: 'damage_reduction',
        reductionExpression: '1d10 + CON modifier',
        description: 'When you take damage, you can reduce it by 1d10 + CON modifier.',
        icon: 'fa-shield',
    },
    {
        name: "Storm's Thunder",
        type: 'reaction_damage',
        damage: '1d8',
        damageType: 'Thunder',
        range: '60_ft',
        description: 'When you take damage from a creature within 60 feet of you, you can take a Reaction to deal 1d8 thunder damage to that creature.',
        icon: 'fa-bolt',
    },
];

export function getRuntimeUsesKey(featureName) {
    const cleaned = featureName.toLowerCase().replace(/'/g, '');
    return cleaned.replace(/ (\w)/g, (_, c) => c.toUpperCase()) + 'Uses';
}

export function getOptionByName(name) {
    return GIANT_OPTIONS.find(o => o.name === name);
}
