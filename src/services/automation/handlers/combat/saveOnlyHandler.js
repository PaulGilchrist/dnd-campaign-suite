import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const STUNNING_STRIKE_EFFECTS = {
    success: [
        { type: 'speed_halved', condition: 'speed_halved' },
        { type: 'advantage_on_target' },
    ],
    fail: [
        { type: 'stunned', condition: 'stunned' },
    ],
};

function getDefaultEffects(automationName, auto) {
    if (automationName === 'Stunning Strike') {
        return STUNNING_STRIKE_EFFECTS;
    }
    return { success: [], fail: [{ type: 'stunned', condition: auto?.effects?.fail?.[0]?.condition || 'stunned' }] };
}

// Refusal slug convention: derived from the ACTION name (monsterSelfBuff
// precedent — Stunning Strike → stunning_strike_refused).
function refusalSlug(actionName) {
    return String(actionName || 'save_only').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function saveOnlyRefusal(action, playerStats, campaignName, reason, message) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerStats.name,
        abilityName: action.name,
        automationType: action.automation?.type || 'save_only',
        automationDetail: `${refusalSlug(action.name)}_refused`,
        reason,
        description: `${action.name} refused — ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveOnly] Error logging refusal:', e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type || 'save_only',
            description: message,
            automation: action.automation,
        },
    };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const saveDc = buildSaveDc(auto, playerStats);

    // Every save_only consumer requires another creature (Stunning Strike:
    // "when you hit a creature"; Color Spray/Entangle/Grease/Arms of Hadar/
    // Dominate Monster: creatures in an area/point of your choice) — self is
    // never a legal target. Refuse with a popup instead of the old
    // `|| playerStats.name` fallback that forced a save prompt on the caster.
    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || null;

    if (!targetName) {
        return saveOnlyRefusal(action, playerStats, campaignName, 'no_target',
            `No target selected — ${action.name} requires another creature. Select a target in combat first.`);
    }

    if (targetName === playerStats.name) {
        return saveOnlyRefusal(action, playerStats, campaignName, 'cannot_target_self',
            `You can't target yourself with ${action.name} — it requires another creature.`);
    }

    const effects = auto.effects || getDefaultEffects(action.name, auto);
    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType: auto.saveType || 'CON',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} triggered — target ${targetName} must make ${auto.saveType || 'CON'} save (DC ${saveDc})`,
        promptId,
    }).catch((e) => { console.error("[saveOnly] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;
        window.removeEventListener('save-result', handleSaveResult);
        window.removeEventListener('save-dismissed', handleSaveDismissed);

        const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const isSuccessful = event.detail.success;

        if (isSuccessful) {
            applySuccessEffects(effects.success, targetName, playerStats.name, campaignName);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'CON',
                success: true,
                description: `${targetName} succeeded on ${auto.saveType || 'CON'} save. Speed halved until start of next turn.`,
            }).catch((e) => { console.error("[saveOnly] Error:", e); });

            addExpiration({ attackerName: playerStats.name, targetName, effects: [
                { type: 'stunned', condition: 'speed_halved' },
                { type: 'advantage_on_target' }
            ], campaignName, rounds: undefined, expireOnCreatureName: targetName });
        } else {
            const conditionKey = effects.fail?.[0]?.condition || 'stunned';
            const filtered = conditions.filter(c => String(c).toLowerCase() !== conditionKey.toLowerCase());
            const newConditions = [...filtered, conditionKey];

            setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'CON',
                success: false,
                description: `${targetName} failed ${auto.saveType || 'CON'} save. Stunned until start of next turn.`,
            }).catch((e) => { console.error("[saveOnly] Error:", e); });

            addExpiration({ attackerName: playerStats.name, targetName, effects: [
                { type: 'stunned', condition: 'stunned' }
            ], campaignName, rounds: undefined, expireOnCreatureName: targetName });
        }
    };

    // Dismiss hygiene (save-dismissed family, 2026-11-05): a GM Dismiss on the
    // un-rolled prompt never dispatches save-result (dismiss doctrine — a
    // dismissed save never resolves), so this raw listener used to leak one
    // window listener + closure set per dismissed cast while createSaveListener's
    // own listener detached itself. Mirrors savePrompt.js:167-172 /
    // DivineSparkModal's save-dismissed opt-in: detach BOTH listeners and log
    // the abandonment as <feature>_refused (save_dismissed) — zero further
    // state; the spend stays (§9 pay-early family).
    const handleSaveDismissed = (event) => {
        if (event.detail.promptId !== promptId) return;
        window.removeEventListener('save-dismissed', handleSaveDismissed);
        window.removeEventListener('save-result', handleSaveResult);
        // Popup return value is unused (the queued prompt is gone; the cast's
        // ability_use spend row already landed) — this call logs the refusal.
        saveOnlyRefusal(action, playerStats, campaignName, 'save_dismissed',
            `${action.name} abandoned — the save prompt was dismissed, no condition applied to ${targetName}.`);
    };

    window.addEventListener('save-result', handleSaveResult);
    window.addEventListener('save-dismissed', handleSaveDismissed);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            targetName,
            description: `Target ${targetName} must make a ${auto.saveType || 'CON'} saving throw (DC ${saveDc}).`,
            automation: auto,
        },
    };
}

function applySuccessEffects(effects, targetName, attackerName, campaignName) {
    if (!effects || !Array.isArray(effects)) return;
    for (const effect of effects) {
        switch (effect.type) {
            case 'speed_halved': {
                // CLA-342: canonical key consumed by CharSheet.conditionEffects and
                // cleared by clearExpirationEffects — the old timestamped key was dead.
                const key = effect.condition === 'speed_halved' ? 'stunned_speedHalved' : `stunned_${effect.condition}`;
                setRuntimeValue(targetName, key, true, campaignName);
                break;
            }
            case 'advantage_on_target': {
                const advKey = `_advantageOn_${targetName}`;
                const storedAdv = getRuntimeValue(attackerName, advKey) || [];
                if (!storedAdv.includes(targetName)) {
                    setRuntimeValue(attackerName, advKey, [...storedAdv, targetName], campaignName);
                  }
                break;
            }
          }
    }
}
