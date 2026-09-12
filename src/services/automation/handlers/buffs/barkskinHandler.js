import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const BARKSKIN_BUFF_NAME = 'Barkskin';

function getBarkskinDuration(spell) {
    return spell.duration || 'Up to 1 hour';
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const spell = action.spell || {};

    const rangeFt = rangeToFeet(spell.range || 'Touch');

    const positions = _mapName ? await resolveMapPositions(campaignName, _mapName, playerStats.name) : null;
    const attackerPos = positions?.attackerPos || null;

    const combatSummary = getCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];

    const creatureTargets = allCreatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'barkskin_target_selection',
            name: action.name,
            creatureTargets,
            range: spell.range || 'Touch',
            rangeFt,
            duration: getBarkskinDuration(spell),
            attackerPos,
        },
    };
}

function getActiveBuffList(targetName, campaignName) {
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    return Array.isArray(activeBuffs) ? activeBuffs : [];
}

function processBarkskinTarget(targetName, targetCharacter, casterName, duration, campaignName, skippedTargets) {
    const targetAc = targetCharacter?.computedStats?.armorClass ?? targetCharacter?.armorClass ?? 10;

    if (targetAc >= 17) {
        skippedTargets.push({ name: targetName, ac: targetAc });
        return false;
    }

    const buffs = getActiveBuffList(targetName, campaignName);
    const existingBarkskin = buffs.some(b => b.name === BARKSKIN_BUFF_NAME);
    if (!existingBarkskin) {
        buffs.push({
            name: BARKSKIN_BUFF_NAME,
            effect: 'barkskin',
            duration,
            sourceCharacter: casterName,
        });
        setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
    }

    addExpiration(casterName, targetName, [
        { type: 'remove_active_buff', buffName: BARKSKIN_BUFF_NAME }
    ], campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: BARKSKIN_BUFF_NAME,
        description: `${casterName} cast ${BARKSKIN_BUFF_NAME} on ${targetName}. Target's AC becomes 17.`,
    }).catch((e) => { console.error('[barkskin] Error logging:', e); });

    return true;
}

export async function applyBarkskin(action, playerStats, campaignName, _mapName, targetNames, characters) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spell = action.spell || {};
    const duration = getBarkskinDuration(spell);
    const casterName = playerStats.name;

    const targetCharacterMap = {};
    for (const char of (characters || [])) {
        targetCharacterMap[char.name] = char;
    }

    let appliedTargets = [];
    let skippedTargets = [];

    for (const targetName of targetNames) {
        if (processBarkskinTarget(targetName, targetCharacterMap[targetName], casterName, duration, campaignName, skippedTargets)) {
            appliedTargets.push(targetName);
        }
    }

    const popupDescription = buildDescription(appliedTargets, skippedTargets, targetNames.length);
    const popupPayload = {
        type: 'automation_info',
        name: action.name,
        description: popupDescription,
        automation: action.automation || {},
    };

    return {
        type: 'popup',
        payload: popupPayload,
    };
}

function buildDescription(applied, skipped, totalRequested) {
    const parts = [];

    if (applied.length > 0) {
        const targetsList = applied.length === 1 ? applied[0] : applied.join(', ');
        if (skipped.length > 0) {
            parts.push(`${applied.length} target(s) gained Barkskin: ${targetsList}.`);
        } else {
            parts.push(`${applied.length} target(s) gained Barkskin from ${applied.length === 1 ? 'a' : 'the'} cast: ${targetsList}.`);
        }
    }

    if (skipped.length > 0) {
        const skippedDetails = skipped.map(s => `${s.name} (AC ${s.ac})`).join(', ');
        if (skipped.length === totalRequested) {
            parts.push(`Barkskin failed on all ${totalRequested} target(s) — they already have AC 17 or higher: ${skippedDetails}.`);
        } else {
            parts.push(`Barkskin would not improve: ${skippedDetails}.`);
        }
    }

    return parts.join(' ');
}

export function isBarkskinActive(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    return activeBuffs.some(b => b.name === BARKSKIN_BUFF_NAME && b.effect === 'barkskin');
}
