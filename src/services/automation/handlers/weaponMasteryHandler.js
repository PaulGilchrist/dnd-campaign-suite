import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/damageUtils.js';
const MASTERY_EFFECTS = {
    Push: {
        label: 'Push (10 ft)',
        description: 'Push the creature up to 10 feet straight away from you if it is Large or smaller.',
        effect: 'push',
        value: 10,
    },
    Topple: {
        label: 'Topple (Prone)',
        description: 'Force the creature to make a Constitution saving throw or fall Prone.',
        effect: 'topple',
        requiresSave: true,
        saveAbility: 'CON',
    },
    Sap: {
        label: 'Sap (Disadvantage)',
        description: 'The creature has Disadvantage on its next attack roll before the start of your next turn.',
        effect: 'disadvantage_next_attack',
    },
    Slow: {
        label: 'Slow (Speed -10 ft)',
        description: 'Reduce the creature\'s Speed by 10 feet until the start of your next turn.',
        effect: 'speed_reduction',
        value: 10,
    },
    Vex: {
        label: 'Vex (Advantage)',
        description: 'You have Advantage on your next attack roll against that creature before the end of your next turn.',
        effect: 'next_attack_advantage',
        value: 5,
    },
    Cleave: {
        label: 'Cleave (Extra Attack)',
        description: 'Make a melee attack roll with the weapon against a second creature within 5 feet of the first.',
        effect: 'cleave',
    },
    Nick: {
        label: 'Nick (Extra Attack)',
        description: 'Make the extra attack of the Light property as part of the Attack action instead of as a Bonus Action.',
        effect: 'nick',
    },
    Graze: {
        label: 'Graze (Miss Damage)',
        description: 'If your attack roll misses, deal damage equal to your ability modifier.',
        effect: 'graze',
    },
};

export { MASTERY_EFFECTS };

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const availableMasteries = auto.masteries || [];

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} available${targetName ? ` against ${targetName}` : ''}`,
    }).catch(() => {});

    return {
        type: 'modal',
        modalName: 'weaponMastery',
        payload: {
            action,
            playerStats,
            campaignName,
            targetName,
            availableMasteries,
        },
    };
}

export async function applyMasteryEffect(masteryName, playerStats, campaignName, targetName) {
    const mastery = MASTERY_EFFECTS[masteryName];
    if (!mastery) return null;

    if (mastery.requiresSave && mastery.saveAbility) {
        const ability = playerStats.abilities?.find(a => a.name === mastery.saveAbility);
        const mod = ability ? ability.bonus : 0;
        const prof = playerStats.proficiency || 0;
        const saveDc = 8 + mod + prof;

        addEntry(campaignName, {
            type: 'save_triggered',
            characterName: playerStats.name,
            targetName: targetName || 'unknown',
            saveType: mastery.saveAbility,
            saveDc,
            description: `${masteryName}: ${targetName || 'target'} must make a DC ${saveDc} ${mastery.saveAbility} save or ${mastery.effect === 'topple' ? 'fall Prone' : 'suffer the effect'}.`,
        }).catch(() => {});
    }

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: targetName,
        source: masteryName,
        option: masteryName,
        effect: mastery.effect,
        value: mastery.value || null,
        duration: 'until_start_of_next_turn',
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    const desc = buildMasteryDescription(masteryName, targetName);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: masteryName,
            description: desc,
            automation: { type: 'mastery_rider', masteries: [masteryName] },
        },
    };
}

function buildMasteryDescription(masteryName, targetName) {
    const target = targetName || 'target';
    switch (masteryName) {
        case 'Push': return `${masteryName} applied to ${target} — pushed up to 10 ft away.`;
        case 'Topple': return `${masteryName} applied to ${target} — forced CON save vs Prone.`;
        case 'Sap': return `${masteryName} applied to ${target} — Disadvantage on next attack roll.`;
        case 'Slow': return `${masteryName} applied to ${target} — Speed reduced by 10 ft.`;
        case 'Vex': return `${masteryName} applied to ${target} — you have Advantage on next attack.`;
        case 'Cleave': return `${masteryName} — make an extra attack against a second creature within 5 ft.`;
        case 'Graze': return `${masteryName} — deal damage equal to ability modifier on a miss.`;
        case 'Nick': return `${masteryName} — make Light weapon extra attack as part of Attack action.`;
        default: return `${masteryName} applied to ${target}.`;
    }
}
