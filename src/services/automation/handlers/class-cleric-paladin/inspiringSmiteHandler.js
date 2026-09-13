import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { resolveDiceExpression } from '../../../combat/automation/automationService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { resolveChannelDivinityCharges } from '../healing/healingPoolHandler.js';

// No map: include all allies + self (assume in range)
function collectNoMapTargets(allyList, playerName, hasAllyList) {
    const creatureTargets = [];
    for (const allyName of allyList) {
        if (hasAllyList && allyName !== playerName) {
            creatureTargets.push({ name: allyName, type: 'player' });
        }
    }
    return creatureTargets;
}

async function collectAlliesInRange(allyList, playerName, rangeFt) {
    const creatureTargets = [];
    for (const allyName of allyList) {
        if (allyName === playerName) continue;
        if (await isWithinRange(playerName, allyName, rangeFt)) {
            creatureTargets.push({ name: allyName, type: 'player' });
        }
    }
    return creatureTargets;
}

async function collectMapPlayersInRange(mapPlayers, playerName, rangeFt) {
    const creatureTargets = [];
    for (const p of mapPlayers) {
        if (p.name === playerName) continue;
        if (creatureTargets.length >= 10) break;
        if (await isWithinRange(playerName, p.name, rangeFt)) {
            creatureTargets.push({ name: p.name, type: 'player' });
        }
    }
    return creatureTargets;
}

async function buildCreatureTargets(playerName, campaignName, mapName, rangeFt) {
    const allyList = getAllyList(playerName);
    const hasAllyList = allyList.length > 1;

    if (!mapName || rangeFt == null) {
        const creatureTargets = collectNoMapTargets(allyList, playerName, hasAllyList);
        creatureTargets.push({ name: playerName, type: 'player' });
        return creatureTargets;
    }

    const mapData = await loadMapData(campaignName, mapName);
    const mapPlayers = mapData?.players || [];
    const creatureTargets = hasAllyList
        ? await collectAlliesInRange(allyList, playerName, rangeFt)
        : await collectMapPlayersInRange(mapPlayers, playerName, rangeFt);

    // Include self
    creatureTargets.push({ name: playerName, type: 'player' });
    return creatureTargets;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check Channel Divinity charges
    const { currentCharges } = resolveChannelDivinityCharges(playerStats);

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
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const isDivineSmiteCast = lastAttack?.attackName?.toLowerCase() === 'divine smite';
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

    // Build target list using allies within range
    const rangeFt = rangeToFeet(auto.range || '30 ft');
    const creatureTargets = await buildCreatureTargets(playerName, campaignName, _mapName, rangeFt);

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
