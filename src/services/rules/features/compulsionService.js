// compulsionService — Compulsion (SP-027) confirm-side service. Live lane (#1348, 2026-10-22):
// spellGates.gateCompulsion → pendingCompulsion → handleCompulsionConfirm → applyCompulsionEffect.
// The former triggerCompulsion export was DEAD (zero production callers; the real sheet cast never
// builds a type-'compulsion' action envelope — disk spell rows carry no automation.type) and also
// double-fetched getCombatContext (:11/:36) and stamped app-fabricated automation.advantage
// (old :37/:48). Disk law (public/data/spells.json + 2024/spells.json, read 2026-10-22): the
// Compulsion prose grants NO advantage on either ruleset — straight WIS save; 5e prose adds only
// "A target automatically succeeds on this saving throw if it can't be charmed" (immunity
// adjudication, downstream at the prompt/GM seam — not an advantage flag). The live stamp below is
// advantage:false / disadvantage:false, matching the prose. compulsionHandler.js stays registered
// in HANDLER_MAP (automation/index.js:219/:548) but now has no in-repo envelope producer.
import { getCombatContext } from '../combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addEntry } from '../../ui/logService.js';
import { addExpiration } from '../effects/expirations.js';
import { addCondition } from '../../combat/conditions/conditionSaveService.js';

function defaultSpellSaveDc(playerStats) {
    return playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
}

export async function applyCompulsionEffect(spell, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spellSaveDc = defaultSpellSaveDc(playerStats);
    const casterName = playerStats.name;

    const logTargets = [];

    for (const targetName of targetNames) {
        const { promise, promptId } = createSaveListener(campaignName, {
            targetName,
            saveType: 'WIS',
            saveDc: spellSaveDc,
            dcSuccess: 'none',
            advantage: false,
            disadvantage: false,
            condition: 'charmed',
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Compulsion',
            description: `${casterName} casts Compulsion on ${targetName}! ${targetName} must make a WIS save (DC ${spellSaveDc}) or become Charmed.`,
            promptId,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[compulsionService] Error logging cast:', e); });

        const saveResult = await promise;

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-compulsion',
            targetName,
            saveDc: spellSaveDc,
            saveType: 'WIS',
            success: saveResult.success,
            description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} on WIS save against Compulsion (DC ${spellSaveDc}).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[compulsionService] Error logging save:', e); });

        if (!saveResult.success) {
            const cs = await getCombatContext(campaignName);
            const conditionDef = { key: 'charmed', label: 'Charmed' };
            addCondition({ combatSummary: cs, creatureName: targetName, conditionDef, dc: spellSaveDc, ability: 'WIS', getRuntimeValue, setRuntimeValue, campaignName, playerStats });

            addExpiration({ attackerName: casterName, targetName, effects: [
                { type: 'charmed', condition: 'charmed' },
            ], campaignName });

            logTargets.push({ name: targetName, saved: false });

            addEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Charmed',
                reason: 'Compulsion spell',
                note: `${targetName} is Charmed by ${casterName}. As a bonus action on each of its turns, ${targetName} must use its movement to travel to the nearest space that is furthest away from ${casterName}.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[compulsionService] Error logging condition:', e); });
        } else {
            logTargets.push({ name: targetName, saved: true });
        }
    }

    const failedTargets = logTargets.filter(t => !t.saved).map(t => t.name);
    const succeededTargets = logTargets.filter(t => t.saved).map(t => t.name);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Compulsion',
        description: `Compulsion cast: ${failedTargets.length} of ${targetNames.length} target(s) affected. Targets: ${targetNames.join(', ')}. ${succeededTargets.length} succeeded on WIS save.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[compulsionService] Error logging summary:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Compulsion',
            description: `${failedTargets.length} of ${targetNames.length} target(s) affected by Compulsion and became Charmed.`,
        },
    };
}
