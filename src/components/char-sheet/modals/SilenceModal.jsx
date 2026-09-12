import { useCallback } from 'react';
import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../services/rules/combat/damageUtils.js';
import { getDistanceFeet } from '../../../services/rules/combat/rangeValidation.js';
import { addEntry } from '../../../services/ui/logService.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';
import { addSilencedTarget } from '../../../services/rules/features/silenceService.js';

const SILENCE_KEY = 'silenceCaster';
const SILENCE_CENTER_KEY = 'silenceCenter';
const SILENCE_RADIUS_KEY = 'silenceRadius';
const SILENCE_BUFF_NAME = 'Silence';

function hasGridPos(c) {
    return !!c && c.gridX != null && c.gridY != null;
}

async function resolveSilenceCombatants(campaignName) {
    const combatSummary = await getCombatContext(campaignName);
    return [
        ...(combatSummary?.players || []),
        ...(combatSummary?.creatures || []),
    ];
}

function resolveSilenceCenterGrid(posOf, targetedNames, casterName) {
    // "Point you choose" (manual-picker model): the first placed picked token
    // is the sphere center; fall back to the caster's grid position.
    for (const targetName of targetedNames) {
        const pickedPos = posOf(targetName);
        if (pickedPos) {
            return { gridX: pickedPos.gridX, gridY: pickedPos.gridY };
        }
    }
    const casterPos = posOf(casterName);
    if (casterPos) {
        return { gridX: casterPos.gridX, gridY: casterPos.gridY };
    }
    return null;
}

export default function SilenceModal({
    playerStats,
    campaignName,
    aoeRadius,
    onClose,
    creatureTargets,
}) {
    const allCreatures = creatureTargets || [];

    const handleConfirm = useCallback(async (selected) => {
        const casterName = playerStats.name;
        const targetedNames = Array.isArray(selected) ? selected.map(t => t.name || t) : [];

        if (targetedNames.length === 0) {
            setRuntimeValue(casterName, SILENCE_KEY, false, campaignName);
            setRuntimeValue(casterName, SILENCE_CENTER_KEY, null, campaignName);
            setRuntimeValue(casterName, SILENCE_RADIUS_KEY, null, campaignName);
            onClose();
            return;
        }

        const csAll = await resolveSilenceCombatants(campaignName);
        const posOf = name => csAll.find(c => c.name === name && hasGridPos(c));
        const centerGrid = resolveSilenceCenterGrid(posOf, targetedNames, casterName);

        setRuntimeValue(casterName, SILENCE_KEY, true, campaignName);
        setRuntimeValue(casterName, SILENCE_CENTER_KEY, centerGrid ? JSON.stringify(centerGrid) : null, campaignName);
        setRuntimeValue(casterName, SILENCE_RADIUS_KEY, aoeRadius, campaignName);

        const grantSilenceBuff = (name) => {
            const stored = getRuntimeValue(name, 'activeBuffs', campaignName) || [];
            const buffs = Array.isArray(stored) ? stored : [];
            if (buffs.some(b => b.name === SILENCE_BUFF_NAME && b.effect === 'silence')) return;
            setRuntimeValue(name, 'activeBuffs', [...buffs, {
                name: SILENCE_BUFF_NAME,
                effect: 'silence',
                duration: 'concentration',
                sourceCharacter: casterName,
            }], campaignName);
        };

        // The caster's own Silence buff feeds getSilenceSource for the V-component gate.
        grantSilenceBuff(casterName);

        const results = [];

        for (const targetName of targetedNames) {
            // With a known center, creatures provably outside the 20-ft sphere are refused.
            if (centerGrid) {
                const targetPos = posOf(targetName);
                if (targetPos) {
                    const dist = getDistanceFeet(centerGrid, targetPos);
                    if (dist != null && dist > aoeRadius) {
                        await addEntry(campaignName, {
                            type: 'automation',
                            creatureName: targetName,
                            name: SILENCE_BUFF_NAME,
                            description: `${targetName} is ${Math.round(dist)} ft from the Silence center — outside the ${aoeRadius}-foot-radius sphere, unaffected.`,
                            timestamp: Date.now(),
                        }).catch((e) => { console.error("[silence] Error logging refusal:", e); });
                        continue;
                    }
                }
            }

            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'deafened');
            const newConditions = [...filtered, 'deafened'];
            setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);

            grantSilenceBuff(targetName);
            addSilencedTarget(casterName, targetName, campaignName);
            addExpiration(casterName, targetName, [
                { type: 'condition', condition: 'deafened' },
                { type: 'remove_active_buff', buffName: SILENCE_BUFF_NAME },
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
            { type: 'remove_active_buff', buffName: SILENCE_BUFF_NAME },
            { type: 'clear_silence_zone', casterName },
            { type: 'clear_runtime_value', creatureName: casterName, key: SILENCE_KEY },
            { type: 'clear_runtime_value', creatureName: casterName, key: SILENCE_CENTER_KEY },
            { type: 'clear_runtime_value', creatureName: casterName, key: SILENCE_RADIUS_KEY },
        ], campaignName);

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Silence',
            description: `${casterName} cast Silence — a ${aoeRadius}-foot-radius sphere of silence is created. ${results.join(' ')} Creatures inside are immune to Thunder damage. Verbal spell components cannot be used inside.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[silence] Error:", e); });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        onClose();
    }, [playerStats.name, campaignName, aoeRadius, onClose]);

    const handleSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    return (
        <CreatureSelectionModal
            title="Silence"
            icon="fa-volume-xmark"
            targets={allCreatures}
            description="For the duration, no sound can be created within or pass through a 20-foot-radius sphere centered on a point you choose. Any creature you choose within range is Deafened and immune to Thunder damage. Casting a spell that includes a Verbal component is impossible there."
            confirmLabel="Cast Silence"
            confirmIcon="fa-volume-xmark"
            onConfirm={handleConfirm}
            onSkip={handleSkip}
        />
    );
}
