import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveDiceExpression } from '../../../combat/automation/automationService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check Channel Divinity charges
    const storedCharges = getRuntimeValue(playerName, 'channelDivinityCharges', campaignName);
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

    if (currentCharges <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No Channel Divinity charges remaining.`,
                automation: auto,
            },
        };
    }

    // Calculate temp HP: 2d8 + paladin level
    const expression = '2d8 + paladin level';
    const resolved = resolveDiceExpression(expression, playerStats);
    const result = rollExpression(resolved);
    const tempHpAmount = result ? result.total : 0;

    if (tempHpAmount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Could not calculate temp HP.`,
                automation: auto,
            },
        };
    }

    // Find all creatures within range
    const rangeFt = rangeToFeet(auto.range || '30 ft');
    const targets = [];

    if (mapName && rangeFt != null) {
        const attackerPlayer = await loadMapData(campaignName, mapName).then(md => md?.players?.find(p => p.name === playerName));
        if (attackerPlayer) {
            const attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
            const mapPlayers = (await loadMapData(campaignName, mapName))?.players || [];
            for (const p of mapPlayers) {
                if (p.name === playerName) continue;
                if (targets.length >= 10) break; // cap at reasonable number
                const pos = { gridX: p.gridX, gridY: p.gridY };
                const dist = getDistanceFeet(attackerPos, pos);
                if (dist != null && dist <= rangeFt) {
                    targets.push(p.name);
                }
            }
        }
    }

    // Distribute temp HP: divide among targets, each gets tempHpAmount
    // "distribute" means each creature within range gets the full amount (2d8 + paladin level)
    // This is consistent with how "distribute Temporary Hit Points" works in 5e
    for (const targetName of targets) {
        setRuntimeValue(targetName, 'tempHp', tempHpAmount, campaignName);
    }

    // Expend Channel Divinity
    const newCharges = currentCharges - 1;
    await setRuntimeValue(playerName, 'channelDivinityCharges', newCharges, campaignName);

    const targetList = targets.length > 0 ? targets.join(', ') : 'no targets in range';
    const description = `${action.name}: Expend Channel Divinity to grant ${tempHpAmount} temporary hit points to ${targetList}.`;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} (2d8 + ${playerStats.level} = ${tempHpAmount} temp HP). Targets: ${targetList}`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'roll',
        payload: {
            roll: `2d8 + ${playerStats.level}`,
            result: tempHpAmount,
            name: action.name,
            tempHp: tempHpAmount,
            targets,
            description,
        },
    };
}
