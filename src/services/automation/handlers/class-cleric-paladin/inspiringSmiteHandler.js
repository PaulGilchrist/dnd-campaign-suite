import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveDiceExpression } from '../../../combat/automation/automationService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
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

    // Check lastAttack for Divine Smite
    const combatSummary = await getCombatContext(campaignName);
    const lastAttack = combatSummary?.lastAttack || null;
    const isDivineSmiteCast = lastAttack?.spellName?.toLowerCase() === 'divine smite';
    const isPlayerAttack = lastAttack?.attackerName === playerName;

    if (!isDivineSmiteCast || !isPlayerAttack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} can only be used immediately after casting Divine Smite.`,
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

    // Get ally list from selectedAllies
    const storedAllies = getRuntimeValue(playerName, 'selectedAllies', campaignName);
    const allyList = Array.isArray(storedAllies) && storedAllies.length > 0 ? storedAllies : null;

    // Build target list using allies within range
    const rangeFt = rangeToFeet(auto.range || '30 ft');
    const creatureTargets = [];

    if (mapName && rangeFt != null) {
        const attackerPlayer = await loadMapData(campaignName, mapName).then(md => md?.players?.find(p => p.name === playerName));
        if (attackerPlayer) {
            const attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
            const mapPlayers = (await loadMapData(campaignName, mapName))?.players || [];

            if (allyList) {
                for (const allyName of allyList) {
                    if (allyName === playerName) continue;
                    const ally = mapPlayers.find(p => p.name === allyName);
                    if (!ally) continue;
                    const allyPos = { gridX: ally.gridX, gridY: ally.gridY };
                    if (isWithinRange(attackerPos, allyPos, rangeFt)) {
                        creatureTargets.push({ name: allyName, type: 'player' });
                    }
                }
            } else {
                for (const p of mapPlayers) {
                    if (p.name === playerName) continue;
                    if (creatureTargets.length >= 10) break;
                    const pos = { gridX: p.gridX, gridY: p.gridY };
                    if (isWithinRange(attackerPos, pos, rangeFt)) {
                        creatureTargets.push({ name: p.name, type: 'player' });
                    }
                }
            }

            // Include self
            creatureTargets.push({ name: playerName, type: 'player' });
        }
    } else {
        // No map: include all allies + self (assume in range)
        if (allyList) {
            for (const allyName of allyList) {
                if (allyName === playerName) continue;
                creatureTargets.push({ name: allyName, type: 'player' });
            }
        }
        creatureTargets.push({ name: playerName, type: 'player' });
    }

    // Dispatch CustomEvent to show modal
    window.dispatchEvent(new CustomEvent('inspiring-smite-pending', {
        detail: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            tempHp: tempHpAmount,
            roll: `2d8 + ${playerStats.level}`,
            channelDivinityCharges: currentCharges,
        },
    }));

    return null;
}
