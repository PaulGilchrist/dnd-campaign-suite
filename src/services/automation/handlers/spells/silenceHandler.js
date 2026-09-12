import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import {
    isSilenceActive as isSilenceActiveService,
    addSilencedTarget,
    removeSilencedTargets,
} from '../../../rules/features/silenceService.js';

const SILENCE_EFFECT = 'silence';
const SILENCE_KEY = 'silenceCaster';
const SILENCE_CENTER_KEY = 'silenceCenter';
const SILENCE_RADIUS_KEY = 'silenceRadius';

// JSON string of the caster's grid position, or null when unplaced.
function resolveSilenceCenter(combatSummary, casterName) {
    if (!combatSummary) return null;
    const casterPos = combatSummary.players?.find(p => p.name === casterName);
    if (casterPos && casterPos.gridX != null && casterPos.gridY != null) {
        return JSON.stringify({ gridX: casterPos.gridX, gridY: casterPos.gridY });
    }
    return null;
}

function clearSilenceZone(casterName, campaignName) {
    setRuntimeValue(casterName, SILENCE_KEY, false, campaignName);
    setRuntimeValue(casterName, SILENCE_CENTER_KEY, null, campaignName);
    setRuntimeValue(casterName, SILENCE_RADIUS_KEY, null, campaignName);
}

// Strip the Deafened condition from every silenced target of this caster.
function clearSilencedTargetConditions(silencedTargets, campaignName) {
    for (const targetName of silencedTargets) {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'deafened');
        if (filtered.length !== conditions.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        }
    }
}

function buildSilenceTargetList(combatSummary) {
    const allTargets = [];
    if (!combatSummary) return allTargets;
    const players = combatSummary.players || [];
    const creatures = combatSummary.creatures || [];
    const allCreatures = [...players, ...creatures];
    for (const creature of allCreatures) {
        const name = creature.name;
        const isPlayer = combatSummary.players?.some(p => p.name === name);
        const hpInfo = !isPlayer && creature.currentHp != null && creature.maxHp != null
            ? { currentHp: creature.currentHp, maxHp: creature.maxHp }
            : {};
        allTargets.push({ name, type: isPlayer ? 'player' : 'creature', ...hpInfo });
    }
    return allTargets;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const buffName = action.name;

    const aoeRadius = auto.aoeRadius || 20;

    const { wasActive } = toggleBuff(
        playerName,
        buffName,
        { ...auto, effect: SILENCE_EFFECT, aoeRadius },
        campaignName
    );

    if (wasActive) {
        clearSilenceZone(playerName, campaignName);
        clearSilencedTargetConditions(removeSilencedTargets(playerName, campaignName), campaignName);

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: buffName,
                automationType: auto.type,
                description: `${buffName} ended`,
                automation: auto,
            },
        };
    }

    const combatSummary = await getCombatContext(campaignName);

    setRuntimeValue(playerName, SILENCE_KEY, true, campaignName);
    setRuntimeValue(playerName, SILENCE_CENTER_KEY, resolveSilenceCenter(combatSummary, playerName), campaignName);
    setRuntimeValue(playerName, SILENCE_RADIUS_KEY, aoeRadius, campaignName);

    addExpiration(playerName, playerName, [
        { type: 'remove_active_buff', buffName },
        { type: 'clear_silence_zone', casterName: playerName },
    ], campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'silence_target_selection',
            name: buffName,
            automationType: auto.type,
            targets: buildSilenceTargetList(combatSummary),
            aoeRadius,
            automation: auto,
        },
    };
}

export async function handleTargetSelection(casterName, selectedTargets, campaignName, aoeRadius) {
    const buffName = 'Silence';
    const targetedNames = Array.isArray(selectedTargets) ? selectedTargets.map(t => t.name || t) : [];

    if (targetedNames.length === 0) {
        clearSilenceZone(casterName, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: buffName,
                description: 'No targets selected. Silence not cast.',
            },
        };
    }

    setRuntimeValue(casterName, SILENCE_KEY, true, campaignName);

    const combatSummary = await getCombatContext(campaignName);
    setRuntimeValue(casterName, SILENCE_CENTER_KEY, resolveSilenceCenter(combatSummary, casterName), campaignName);
    setRuntimeValue(casterName, SILENCE_RADIUS_KEY, aoeRadius, campaignName);

    const results = [];
    const silencedTargets = [];

    for (const targetName of targetedNames) {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'deafened');
        const newConditions = [...filtered, 'deafened'];
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);

        addSilencedTarget(casterName, targetName, campaignName);
        silencedTargets.push(targetName);

        addExpiration(casterName, targetName, [
            { type: 'condition', condition: 'deafened' },
        ], campaignName);

        await addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Deafened',
            reason: 'Silence spell',
            note: `${targetName} is Deafened by Silence and cannot hear or cast spells with Verbal components.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[silence] Error logging condition:", e); });

        results.push(`${targetName} is Deafened.`);
    }

    addExpiration(casterName, casterName, [
        { type: 'remove_active_buff', buffName },
        { type: 'clear_silence_zone', casterName },
    ], campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: buffName,
        description: `${casterName} cast ${buffName} — a ${aoeRadius}-foot-radius sphere of silence is created. ${results.join(' ')} Creatures inside are immune to Thunder damage. Verbal spell components cannot be used inside.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[silence] Error:", e); });

    const summary = targetedNames.length > 0
        ? `Silence affects ${targetedNames.length} creature(s). ${results.join(' ')}`
        : 'No creatures affected by Silence.';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: buffName,
            description: summary,
        },
    };
}

export function isSilenceActive(playerName, campaignName) {
    return isSilenceActiveService(playerName, campaignName);
}
