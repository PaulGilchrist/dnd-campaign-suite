import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    const creatureTargets = combatSummary.creatures
        .filter(c => c.name !== playerStats.name)
        .map(c => {
            const activeBuffs = getRuntimeValue(c.name, 'activeBuffs') || [];
            const cursedBuffs = activeBuffs.filter(b => b.type === 'cursed' || b.cursed);
            const attunement = getRuntimeValue(c.name, 'attunement') || [];
            const hasCurse = cursedBuffs.length > 0 || attunement.length > 0;
            return {
                name: c.name,
                hasCurse: hasCurse,
                cursedBuffs: cursedBuffs,
                attunement: attunement,
            };
        });

    const selfBuffs = getRuntimeValue(playerStats.name, 'activeBuffs') || [];
    const selfCursedBuffs = selfBuffs.filter(b => b.type === 'cursed' || b.cursed);
    const selfAttunement = getRuntimeValue(playerStats.name, 'attunement') || [];
    const selfHasCurse = selfCursedBuffs.length > 0 || selfAttunement.length > 0;

    const allTargets = [
        { name: playerStats.name, hasCurse: selfHasCurse, cursedBuffs: selfCursedBuffs, attunement: selfAttunement, isSelf: true },
        ...creatureTargets,
    ];

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Select a target to remove curses from.`,
            automation: auto,
            targets: allTargets,
            range: auto.range || 'Touch',
        },
    };
}

export async function applyRemoveCurse(action, playerStats, campaignName, mapName, result) {
    if (!result || !result.targetName) {
        return null;
    }

    const targetName = result.targetName;
    const removedItems = [];

    // Remove cursed buffs
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
    const cursedBuffs = activeBuffs.filter(b => b.type === 'cursed' || b.cursed);
    if (cursedBuffs.length > 0) {
        const newBuffs = activeBuffs.filter(b => b.type !== 'cursed' && !b.cursed);
        setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);
        removedItems.push(`Curse (removed ${cursedBuffs.length} cursed effect(s))`);

        for (const cursedBuff of cursedBuffs) {
            postLogEntry(campaignName, {
                type: 'buff',
                action: 'removed',
                characterName: targetName,
                buffName: cursedBuff.name || 'Curse',
                reason: 'Remove Curse',
                timestamp: Date.now(),
            });
        }
    }

    // Break attunement to cursed magic items
    const attunement = getRuntimeValue(targetName, 'attunement') || [];
    if (attunement.length > 0) {
        setRuntimeValue(targetName, 'attunement', [], campaignName);
        removedItems.push(`Attunement broken (removed ${attunement.length} attuned item(s))`);
    }

    if (removedItems.length > 0) {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${playerStats.name} cast ${action.name} on ${targetName}: ${removedItems.join('; ')}.`,
            targetName,
            timestamp: Date.now(),
        });

        postLogEntry(campaignName, {
            type: 'spell_effect',
            characterName: playerStats.name,
            spellName: action.name,
            targetName,
            effects: removedItems,
            timestamp: Date.now(),
        });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: removedItems.length > 0
                ? `${targetName}: ${removedItems.join('; ')}`
                : `${targetName}: No curses or attunement found.`,
        },
    };
}
