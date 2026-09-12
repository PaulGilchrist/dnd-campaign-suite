import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import cloneDeep from 'lodash/cloneDeep.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { getMonsterSaveBonuses } from '../../../encounters/encounterToInitiative.js';

function getTargetEffects() {
    const stored = getRuntimeValue('campaign', 'targetEffects');
    return stored || [];
}

function getWisdomModifier(playerStats) {
    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    return wis?.bonus || 0;
}

function getSpellAttackModifier(playerStats) {
    return playerStats.spellAbilities?.toHit || 0;
}

const TYPE_TO_MONSTER_INDEX = {
    'Beast of the Land': 'primal-companion-beast-of-the-land',
    'Beast of the Sea': 'primal-companion-beast-of-the-sea',
    'Beast of the Sky': 'primal-companion-beast-of-the-sky',
};

function hasFeature(playerStats, featureName) {
    const classLevels = playerStats?.class?.class_levels || [];
    const subclassLevels = playerStats?.class?.subclass?.class_levels || [];
    const majorFeatures = playerStats?.class?.major?.features || [];
    const allFeatureNames = [
        ...classLevels.flatMap(cl => (cl.features || []).map(f => f.name)),
        ...subclassLevels.flatMap(cl => (cl.features || []).map(f => f.name)),
        ...majorFeatures.map(f => f.name),
    ];
    return allFeatureNames.includes(featureName);
}

function buildPrimalCompanionCreature({ monster, companionTypeConfig, displayName, initiativeValue, rangerLevel, wisModifier, spellAttackMod, proficiencyBonus, spellSaveDc, hasBestialFury }) {
    const hp = companionTypeConfig.hpBase + (companionTypeConfig.hpPerLevel * rangerLevel);

    const baseSaves = getMonsterSaveBonuses(monster);
    const adjustedSaves = {};
    for (const [key, value] of Object.entries(baseSaves)) {
        adjustedSaves[key] = value + proficiencyBonus;
    }

    const actions = resolveMonsterActions(monster, wisModifier, spellAttackMod, spellSaveDc, hasBestialFury);

    const speed = {};
    const baseSpeed = companionTypeConfig.speed || '30 ft';
    if (companionTypeConfig.specialSpeed) {
        speed.walk = baseSpeed;
        const speedType = companionTypeConfig.specialSpeed.split(' ')[0];
        speed[speedType] = companionTypeConfig.specialSpeed;
    } else {
        speed.walk = baseSpeed;
    }

    return {
        name: displayName,
        type: 'npc',
        monsterType: monster.type,
        initiative: String(initiativeValue - 0.1),
        targetName: null,
        ac: 13 + wisModifier,
        resistances: monster.damage_resistances || [],
        immunities: monster.damage_immunities || monster.immunities || [],
        concentration: null,
        maxHp: hp,
        currentHp: hp,
        saveBonuses: adjustedSaves,
        monsterIndex: monster.index,
        size: companionTypeConfig.size || monster.size || 'Medium',
        speed,
        actions,
    };
}

function resolveMonsterActions(monster, wisModifier, spellAttackMod, spellSaveDc, hasBestialFury) {
    const actions = (monster.actions || []).map(action => {
        const resolved = { ...action };
        resolved.damage_dice_primary = String(resolved.damage_dice_primary || '').replace(/WIS modifier/gi, String(wisModifier));
        let desc = String(resolved.description || '');
        desc = desc.replace(/WIS modifier/gi, String(wisModifier));
        desc = desc.replace(/spell attack modifier/gi, `+${spellAttackMod}`);
        if (hasBestialFury && resolved.name && resolved.name.includes("Beast's Strike")) {
            desc += ' (can be used twice per turn)';
            resolved.damage_type_primary = 'Force';
            desc = desc.replace(/Bludgeoning\/Piercing\/Slashing/gi, 'Force')
                .replace(/Bludgeoning\/Piercing/gi, 'Force')
                .replace(/Slashing/gi, 'Force')
                .replace(/Piercing/gi, 'Force')
                .replace(/Bludgeoning/gi, 'Force');
        }
        resolved.description = desc;
        if (resolved.attack_bonus === null || resolved.attack_bonus === undefined) {
            resolved.attack_bonus = spellAttackMod;
        }
        if (resolved.save_dc != null && resolved.save_dc === 20) {
            resolved.save_dc = spellSaveDc;
        }
        return resolved;
    });

    actions.push({
        name: "Exceptional Training",
        description: `Bonus Action: The beast can take the Dash, Disengage, Dodge, or Help action. It can deal Force damage instead of its normal damage type.`,
    });

    return actions;
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionKey = 'primalCompanionType';
    const stored = getRuntimeValue(playerName, companionKey, campaignName);

    if (!stored) {
        return {
            type: 'modal',
            modalName: 'primalCompanionSummon',
            payload: { action, playerStats, campaignName },
        };
    }

    const combatSummary = getCombatSummary(campaignName);
    const companionInCombat = combatSummary?.creatures?.some(
        c => c.name === `Primal Companion (${stored})`
    );

    if (!companionInCombat) {
        return {
            type: 'modal',
            modalName: 'primalCompanionSummon',
            payload: { action, playerStats, campaignName },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${stored} companion is active.`,
            automation: auto,
        },
    };
}

function resolveCompanionInitiative(casterCreature) {
    let initiativeValue = 0;
    if (casterCreature?.initiative !== '' && casterCreature?.initiative !== undefined) {
        initiativeValue = parseInt(casterCreature.initiative, 10) || 0;
    }
    const casterInitBonus = casterCreature?.initiativeBonus || 0;
    return initiativeValue || (Math.floor(Math.random() * 20) + 1 + casterInitBonus);
}

export async function confirmPrimalCompanionSummon(action, playerStats, campaignName, selectedType) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (!selectedType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No companion type selected.',
                automation: auto,
            },
        };
    }

    const monsterIndex = TYPE_TO_MONSTER_INDEX[selectedType];
    if (!monsterIndex) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Unknown companion type: ${selectedType}.`,
                automation: auto,
            },
        };
    }

    const casterName = playerStats.name;
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Failed to load combat summary.',
                automation: auto,
            },
        };
    }

    const monsters = await loadMonsters();
    const monster = monsters.find(m => m.index === monsterIndex);
    if (!monster) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Failed to load ${selectedType} monster data.`,
                automation: auto,
            },
        };
    }

    const companionTypeConfig = auto.companionTypes?.find(ct => ct.name === selectedType);
    if (!companionTypeConfig) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Unknown companion type: ${selectedType}.`,
                automation: auto,
            },
        };
    }

    const rangerLevel = playerStats.level || 3;
    const wisModifier = getWisdomModifier(playerStats);
    const spellAttackMod = getSpellAttackModifier(playerStats);
    const proficiencyBonus = playerStats.proficiency || 2;
    const spellSaveDc = playerStats.spellAbilities?.saveDc || (8 + proficiencyBonus + wisModifier);

    const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
    const initiativeValue = resolveCompanionInitiative(casterCreature);

    const displayName = `Primal Companion (${selectedType})`;

    const hasBestialFury = hasFeature(playerStats, 'Bestial Fury');

    const creature = buildPrimalCompanionCreature({ monster, companionTypeConfig, displayName, initiativeValue, rangerLevel, wisModifier, spellAttackMod, proficiencyBonus, spellSaveDc, hasBestialFury });
    combatSummary.creatures.push(creature);

    let targetEffects = getTargetEffects();
    const existingSummoned = targetEffects.find(
        te => te.target === creature.name && te.effect === 'summoned' && te.source === casterName
    );
    if (!existingSummoned) {
        targetEffects.push({ target: creature.name, source: casterName, effect: 'summoned' });
    }

    combatSummary.creatures.sort((a, b) => {
        const aInit = a.initiative === '' || a.initiative === undefined ? 0 : Number(a.initiative);
        const bInit = b.initiative === '' || b.initiative === undefined ? 0 : Number(b.initiative);
        return bInit - aInit;
    });

    storage.set('combatSummary', cloneDeep(combatSummary), campaignName);
    setRuntimeValue('campaign', 'targetEffects', targetEffects, campaignName);
    await setRuntimeValue(playerName, 'primalCompanionType', selectedType, campaignName);
    await setRuntimeValue(playerName, 'primalCompanionAlive', true, campaignName);
    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    await addEntry(campaignName, {
        type: 'summons',
        characterName: casterName,
        summonName: 'Primal Companion',
        description: `${casterName} summons a Primal Companion (${selectedType}).`,
        summonedCreatures: [creature.name],
        timestamp: Date.now(),
    }).catch((e) => { console.error("[primalCompanionHandler:log-error]", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${casterName} summons a Primal Companion (${selectedType}). It acts on your turn, right after you.`,
            automation: auto,
        },
        logEntries: [{
            type: 'summons',
            characterName: casterName,
            summonName: 'Primal Companion',
            description: `${casterName} summons a Primal Companion (${selectedType}).`,
            summonedCreatures: [creature.name],
            timestamp: Date.now(),
        }],
    };
}

export async function handleCommand(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion summoned.',
                automation: auto,
            },
        };
    }

    let description = `${action.name}: Commanded ${companionType} to use Beast's Strike.`;

    const hasBestialFury = hasFeature(playerStats, 'Bestial Fury');
    if (hasBestialFury) {
        description += ' Bestial Fury: beast attacks twice!';
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: description,
            automation: auto,
        },
    };
}

export async function handleRestore(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to restore.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'primalCompanionAlive', true, campaignName);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${companionType} restored with full HP after 1 minute.`,
            automation: auto,
        },
    };
}

export async function handleBonusActionCommand(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to command.',
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'primalCompanionBonusActionCommand',
        payload: {
            action,
            playerStats,
            campaignName,
            companionType,
        },
    };
}

const BONUS_ACTION_COMMANDS = [
    { name: 'Dash', description: 'Double movement speed this turn' },
    { name: 'Disengage', description: 'Movement doesn\'t trigger opportunity attacks' },
    { name: 'Dodge', description: 'Attackers have disadvantage against the companion' },
    { name: 'Help', description: 'Next ally attack against a target has advantage' },
];

export async function applyBonusActionCommand(action, playerStats, campaignName, selectedAction, useForceDamage) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);

    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to command.',
                automation: auto,
            },
        };
    }

    const commandAction = BONUS_ACTION_COMMANDS.find(c => c.name === selectedAction);
    if (!commandAction) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No action selected.',
                automation: auto,
            },
        };
    }

    let message = `${action.name}: Commanded ${companionType} to take a ${selectedAction} action as a Bonus Action.`;
    if (useForceDamage && auto.forceDamageOption) {
        message += ` Companion deals Force damage instead of its normal damage type.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: message,
            automation: auto,
        },
    };
}
