import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getEffectDefinition } from '../../../combat/conditions/targetEffectDefinitions.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const spell = action.spell || {};

    const rangeFt = rangeToFeet(auto.range || spell.range || '30 feet');

    const positions = _mapName ? await resolveMapPositions(campaignName, _mapName, playerStats.name) : null;
    const attackerPos = positions?.attackerPos || null;

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

    const creatureTargets = combatSummary.creatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'beacon_of_hope_target_selection',
            name: action.name,
            creatureTargets,
            range: auto.range || spell.range || '30 feet',
            rangeFt,
            slotLevel: action.spellSlotLevel || spell.level || 3,
            attackerPos,
            automation: auto,
        },
    };
}

function logBeaconOfHopeCast(campaignName, casterName, action, targetNames, now) {
    const targetList = targetNames.join(', ');
    const spellLevel = action.spell?.level || 3;
    const castingTime = action.spell?.casting_time || '1 action';

    addEntry(campaignName, {
        type: 'spell',
        characterName: casterName,
        targetName: targetNames[0],
        targets: targetNames,
        spellName: 'Beacon of Hope',
        spellLevel,
        castingTime,
        description: `${casterName} casts Beacon of Hope on ${targetList}. Targets gain advantage on WIS saves and death saves, and regain maximum HP from healing.`,
        timestamp: now,
    }).catch((e) => { console.error('[beaconOfHope] Error logging cast:', e); });

    addEntry(campaignName, {
        type: 'spell',
        characterName: casterName,
        targetName: targetNames[0],
        targets: targetNames,
        spellName: 'Beacon of Hope',
        spellLevel,
        castingTime,
        description: `Beacon of Hope cast: ${targetNames.length} creature(s) affected.`,
        timestamp: now,
    }).catch((e) => { console.error('[beaconOfHope] Error logging summary:', e); });
}

export async function applyBeaconOfHopeEffect(action, playerStats, campaignName, _mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? [...storedEffects] : [];
    const casterName = playerStats.name;

    const effectDef = getEffectDefinition('beacon_of_hope');
    const effectLabel = effectDef?.label || 'Beacon of Hope';

    const reasons = [];
    const now = Date.now();

    for (const targetName of targetNames) {
        const existing = effects.find(te => te.target === targetName && te.effect === 'beacon_of_hope');
        if (existing) continue;

        const reason = {
            name: effectLabel,
            caster: casterName,
            timestamp: now,
            duration: 'concentration',
        };
        reasons.push(reason);

        effects.push({
            target: targetName,
            effect: 'beacon_of_hope',
            label: effectLabel,
            caster: casterName,
            duration: 'concentration',
            reasons: [reason],
        });
    }

    if (reasons.length > 0) {
        setRuntimeValue('campaign', 'targetEffects', effects, campaignName, true);
        logBeaconOfHopeCast(campaignName, casterName, action, targetNames, now);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Beacon of Hope',
            description: `${targetNames.length} of ${targetNames.length} target(s) affected by Beacon of Hope.`,
        },
    };
}
