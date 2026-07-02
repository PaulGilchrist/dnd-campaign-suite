import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import storage from '../../../ui/storage.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check resource usage
    const usesKey = getRuntimeUsesKey(action.name);
    const storedUses = getRuntimeValue(playerName, usesKey, campaignName);
    const currentUses = storedUses != null ? Number(storedUses) : auto.usesMax;
    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining. Must finish a Long Rest to regain.`,
                automation: auto,
            },
        };
    }

    // Get combat context to find creatures
    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat active.',
                automation: auto,
            },
        };
    }

    // Find the creature making the death save (target or ally within range)
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    // Get the player creature's max HP for healing calculation
    const playerMaxHp = playerStats.hitPoints?.max || playerStats.currentHitPoints || 1;

    // Calculate healing amount (half target's max HP)
    const targetMaxHp = target?.maxHp || playerMaxHp;
    const healAmount = Math.floor(targetMaxHp / 2);

    // Consume the resource
    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    // Apply healing to the target
    if (target) {
        if (target.type === 'player') {
            await setRuntimeValue(target.name, 'currentHitPoints', healAmount, campaignName);
        } else {
            target.currentHp = healAmount;
            if (target.maxHp) {
                target.maxHp = targetMaxHp;
            }
            const updatedCs = await getCombatContext(campaignName);
            if (updatedCs) {
                storage.set('combatSummary', updatedCs, campaignName);
            }
        }
    }

    // Remove conditions from target (including "Pending" — unstable at 0 HP state)
    if (target) {
        setRuntimeValue(targetName, 'activeConditions', [], campaignName);
    }

    // Apply AoE radiant damage to creatures within 30 feet
    const damageExpr = auto.damageExpression || '2d8 + CHA modifier';
    const damageResult = rollExpression(damageExpr);
    const damageAmount = damageResult?.total || 0;

    // Apply Blinded condition to creatures within range (excluding the healed target)
    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const blindedArray = Array.isArray(storedEffects) ? storedEffects : [];
    const now = Date.now();
    const blindedEffect = {
        target: targetName || 'all_enemies',
        source: action.name,
        option: 'Searing Vengeance',
        effect: 'blinded',
        value: damageAmount,
        duration: 'until_end_of_current_turn',
        timestamp: now,
    };
    blindedArray.push(blindedEffect);
    setRuntimeValue(campaignName, 'targetEffects', blindedArray, campaignName);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name} used on ${targetName || 'target'} — healed for ${healAmount} HP, ${damageAmount} radiant damage to nearby creatures, Blinded until end of turn`,
    }).catch(() => {});

    // Log the healing
    await addEntry(campaignName, {
        type: 'heal',
        characterName: playerName,
        targetName: targetName || 'target',
        amount: healAmount,
        abilityName: action.name,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[searingVengeance] Error:", e); });

    // Log the damage
    if (damageAmount > 0) {
        await addEntry(campaignName, {
            type: 'damage_roll',
            characterName: playerName,
            targetName: targetName || 'target',
            damageType: auto.damageType || 'Radiant',
            total: damageAmount,
            formula: damageExpr,
            description: `${action.name} dealt ${damageAmount} radiant damage to creatures within 30 feet.`,
        }).catch((e) => { console.error("[searingVengeance] Error:", e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${playerName} unleashes Searing Vengeance! ${targetName || 'Target'} regains ${healAmount} HP and conditions end. Each creature within 30 feet takes ${damageAmount} radiant damage and is Blinded until end of current turn.`,
            automation: auto,
        },
    };
}
