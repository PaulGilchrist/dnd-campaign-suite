import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

async function findRecentSuccessfulSave(playerStats, campaignName, mapName, rangeFt, isSelf) {
    const playerName = playerStats.name;

    if (isSelf) {
        const attackResult = await findLastAttack(campaignName);
        const attackEvent = attackResult.attackEvent;
        if (attackEvent && attackResult.targetName === playerName) {
            const { hit } = attackEvent;
            if (hit === true) {
                return { name: playerName, event: attackEvent, type: 'attack_roll', success: true };
            }
        }
        return null;
    }

    if (!rangeFt) return null;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary?.creatures) return null;

    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent) return null;

    // Check if the last attack was from an ally (not the player)
    if (attackResult.attackerName && attackResult.attackerName !== playerName) {
        const attackerCreature = combatSummary.creatures.find(c => c.name === attackResult.attackerName);
        if (attackerCreature && attackerCreature.name !== playerName) {
            if (mapName && rangeFt != null) {
                const positions = await resolveMapPositions(campaignName, mapName, playerName);
                if (positions?.attackerPos && positions?.targetPos) {
                    const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
                    if (dist != null && dist > rangeFt) return null;
                }
            }
            return { name: attackResult.attackerName, event: attackEvent, type: 'attack_roll', success: true };
        }
    }

    return null;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Beguiling Twist';

    const rangeFt = rangeToFeet(auto.range || '120_ft');

    const isSelf = auto.target === 'self';
    const differentCreature = auto.target === 'different_creature';

    const result = await findRecentSuccessfulSave(playerStats, campaignName, mapName, rangeFt, isSelf);

    if (!result) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent successful save found for you or any creature within ${auto.range || '120 ft'}. ${featureName} must be used shortly after a successful save against Charmed or Frightened.`,
                automation: auto,
            },
        };
    }

    let targetName = result.name;

    if (differentCreature) {
        const combatSummary = await getCombatContext(campaignName);
        if (!combatSummary?.creatures) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `Cannot determine targets. ${featureName} requires selecting a different creature from the one who succeeded on the save.`,
                    automation: auto,
                },
            };
        }

        const otherCreatures = combatSummary.creatures.filter(
            c => c.name !== targetName
        );

        if (otherCreatures.length === 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${targetName} succeeded on a save, but no other creatures are available to target with ${featureName}.`,
                    automation: auto,
                },
            };
        }

        targetName = otherCreatures[0]?.name || targetName;
    }

    const saveAbility = 'WIS';
    const prof = playerStats.proficiency || 0;
    const chaBonus = getAbilityModifier(playerStats.abilities, 'CHA');
    const saveDc = 8 + chaBonus + prof;

    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType: saveAbility,
        saveDc,
    });

    const conditionType = auto.condition || 'charmed_frightened';
    const conditionName = conditionType === 'charmed_frightened' ? 'Charmed or Frightened' : conditionType === 'charmed' ? 'Charmed' : 'Frightened';

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — ${targetName} must make WIS save (DC ${saveDc}) or be ${conditionName} for 1 minute.`,
        promptId,
    }).catch((e) => { console.error("[beguilingTwist] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        const isSuccessful = event.detail.success;

        if (!isSuccessful) {
            const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
            const conditionList = Array.isArray(conditions) ? conditions : [];
            const condKey = conditionType === 'charmed_frightened' ? 'charmed' : conditionType;
            if (!conditionList.some(c => String(c).toLowerCase() === condKey)) {
                const newConditions = [...conditionList, condKey];
                setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
            }

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: saveAbility,
                success: false,
                description: `${targetName} failed WIS save. ${targetName} is now ${conditionName} for 1 minute.`,
            }).catch((e) => { console.error("[beguilingTwist] Error:", e); });

            addExpiration(playerName, targetName, [
                { type: 'condition', condition: condKey }
            ], campaignName, 60);
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: saveAbility,
                success: true,
                description: `${targetName} succeeded on WIS save. ${featureName} has no effect.`,
            }).catch((e) => { console.error("[beguilingTwist] Error:", e); });
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            targetName,
            description: `Target ${targetName} must make a WIS saving throw (DC ${saveDc}) or be ${conditionName} for 1 minute.`,
            automation: auto,
        },
    };
}
