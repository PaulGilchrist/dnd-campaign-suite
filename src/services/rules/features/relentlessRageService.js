// Relentless Rage (Barbarian lv11) — zero-HP interceptor (applyDamage.js ZERO_HP_INTERCEPTORS).
// Ruleset law (disk classes.json rows, both verified 2026-10-22):
// - 5e TEXT: "If you succeed, you drop to 1 hit point instead" — lawful healExpression is
//   the numeric literal 1 (#1399 data fix; the former '2 * barbarian_level' byte was the
//   2024 rule fabricated into the 5e row).
// - 2024 TEXT: "your Hit Points instead change to a number equal to twice your Barbarian
//   level" — keeps '2 * barbarian_level'.
// Engine invariants (#1403): success ALWAYS lands HP >= 1 (Math.max floor) — a raw
// overwrite of 0 would create the illegal alive-at-0 state while death saves sit cleared.
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { sendDeathSavePrompt } from '../../combat/conditions/savePromptService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import utils from '../../ui/utils.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

function getBarbarianLevel(playerComputed) {
    return playerComputed?.class?.class_levels?.find(
        cl => cl.name === 'Barbarian'
    )?.level || playerComputed?.level || 1;
}

const HEAL_FIELD_RESOLVERS = {
    barbarian_level: getBarbarianLevel,
    level: (playerComputed) => playerComputed?.level || 1,
};

function evaluateMultiplierExpression(numericMatch, playerComputed) {
    const multiplier = parseInt(numericMatch[1], 10);
    const resolve = HEAL_FIELD_RESOLVERS[numericMatch[2].toLowerCase()];
    return multiplier * (resolve ? resolve(playerComputed) : 0);
}

function evaluateHealExpression(expression, playerComputed) {
    if (typeof expression === 'number') return expression;
    if (!expression) return playerComputed?.level || 1;

    const text = String(expression);
    if (/2\s*\*\s*barbarian_level/i.test(text)) {
        return 2 * getBarbarianLevel(playerComputed);
    }

    const numericMatch = text.match(/^(\d+)\s*\*\s*(\w+)$/);
    if (numericMatch) return evaluateMultiplierExpression(numericMatch, playerComputed);

    // Numeric literal ('1'-shaped drop-to-1, #1399): exact value, NOT the level fallback.
    const numericLiteral = Number(text);
    if (Number.isFinite(numericLiteral)) return numericLiteral;

    return playerComputed?.level || 1;
}

function findRelentlessRageAutomation(allFeatures) {
    for (const feature of allFeatures) {
        if (feature?.name === 'Relentless Rage' && feature?.automation) {
            return feature.automation;
        }
    }
    return null;
}

// Death-save slot machine for the save-FAILURE leg: prompts once, consumes the matching
// promptId exactly once (eager self-unsubscribe at match, #1400/#1401), refuses malformed
// store shapes loudly instead of silently corrupting the track, and logs the outcome
// faithfully (success mirrors the byte the slot machine decided on, #1400).
function attachDeathSaveSlotMachine(creature, campaignName) {
    const deathSavePromptId = utils.guid();
    sendDeathSavePrompt(campaignName, {
        promptId: deathSavePromptId,
        targetName: creature.name,
    });

    const handleDeathSaveResult = (deathEvent) => {
        if (deathEvent.detail?.promptId !== deathSavePromptId) return;
        window.removeEventListener('death-save-result', handleDeathSaveResult);

        const dsResult = deathEvent.detail;
        const rawSaves = getRuntimeValue(creature.name, 'deathSaves', campaignName);
        const rawFailures = getRuntimeValue(creature.name, 'deathFailures', campaignName);

        // #1400 guard: counter math is only defined on arrays. A truthy NON-array
        // ('locked', {}, 7) previously spread into chars or threw a jsdom-swallowed
        // TypeError — the slot machine died silently. Refuse loudly; null/undefined
        // is the rules-defined empty track and still defaults.
        if ((rawSaves != null && !Array.isArray(rawSaves)) ||
            (rawFailures != null && !Array.isArray(rawFailures))) {
            console.error('[relentlessRage] Refusing death-save advance: non-array deathSaves/deathFailures in store', { rawSaves, rawFailures });
            return;
        }

        let newSaves = Array.isArray(rawSaves) ? [...rawSaves] : [false, false, false];
        let newFailures = Array.isArray(rawFailures) ? [...rawFailures] : [false, false, false];

        if (dsResult.isNat20) {
            newSaves = [false, false, false];
            newFailures = [false, false, false];
            setRuntimeValue(creature.name, 'currentHitPoints', 1, campaignName)
                .catch((e) => { console.error('[relentlessRage] Error:', e); });
        } else if (dsResult.success) {
            const firstEmpty = newSaves.indexOf(false);
            if (firstEmpty !== -1) newSaves[firstEmpty] = true;
        } else {
            const failMultiplier = dsResult.isNat1 ? 2 : 1;
            for (let i = 0; i < failMultiplier; i++) {
                const firstEmpty = newFailures.indexOf(false);
                if (firstEmpty !== -1) newFailures[firstEmpty] = true;
            }
        }

        setRuntimeValue(creature.name, 'deathSaves', newSaves, campaignName)
            .catch((e) => { console.error('[relentlessRage] Error:', e); });
        setRuntimeValue(creature.name, 'deathFailures', newFailures, campaignName)
            .catch((e) => { console.error('[relentlessRage] Error:', e); });

        addEntry(campaignName, {
            type: 'death_save',
            characterName: creature.name,
            roll: dsResult.roll,
            isNatural20: dsResult.isNat20,
            isNatural1: dsResult.isNat1,
            // #1400: log matches the branch — the slot machine above decided on
            // dsResult.success; the former result==='stable'/'nat20' fallback could
            // claim success on a run that advanced a FAILURE slot.
            success: dsResult.success === true,
        }).catch((e) => { console.error('[relentlessRage] Error:', e); });
    };

    window.addEventListener('death-save-result', handleDeathSaveResult);
}

export function checkRelentlessRage(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }
    const featureAutomation = findRelentlessRageAutomation(rawAllFeatures);

    if (!featureAutomation) {
        return { intercepted: false };
    }

    const rawBuffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(rawBuffs) ? rawBuffs : [];
    const rageActive = activeBuffs.some(b => b.name === 'Rage');
    if (!rageActive) {
        return { intercepted: false };
    }

    const usesKey = getRuntimeUsesKey('Relentless Rage');
    const currentUses = Number(getRuntimeValue(creature.name, usesKey) ?? 0);

    const baseDc = featureAutomation.saveDc || 10;
    const scaling = featureAutomation.dcScaling || 0;
    const saveDc = baseDc + (currentUses * scaling);

    const { promptId } = createSaveListener(campaignName, {
        targetName: creature.name,
        saveType: featureAutomation.saveType || 'CON',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: creature.name,
        abilityName: 'Relentless Rage',
        description: `Relentless Rage triggered — ${creature.name} must make ${featureAutomation.saveType || 'CON'} save (DC ${saveDc})`,
        source: 'Relentless Rage',
        promptId,
    }).catch((e) => { console.error("[relentlessRage] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;
        // #1400/#1401 eager consume: unsubscribe AT the promptId match (mirrors the
        // death-save listener's own shape), so every consumed subscribe has exactly
        // one unsubscribe and no store rejection/stall can strand this listener for
        // replay — the same id variable guards and deregisters.
        window.removeEventListener('save-result', handleSaveResult);

        try {
            const healAmount = evaluateHealExpression(featureAutomation.healExpression, playerComputed);
            const saveRoll = event.detail.roll;
            const saveBonus = event.detail.saveBonus;
            const saveTotal = event.detail.total;

            if (event.detail.success) {
                // #1403 clamp: relentless rage leaves the creature STANDING. The raw
                // overwrite could write HP 0 (evaluator zero, malformed rows) while
                // clearing death saves below — the illegal alive-at-0 state. Floor at 1.
                const newHp = Math.max(1, healAmount);
                await setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);

                creature.currentHp = newHp;

                // Coherent stabilization: clears land only AFTER HP >= 1 is committed.
                await setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
                await setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);
                await setRuntimeValue(creature.name, 'isDead', 0, campaignName);

                const rawConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName);
                const conditions = rawConditions || [];
                const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');
                await setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);

                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: creature.name,
                    abilityName: 'Relentless Rage',
                    description: `${creature.name} succeeded on CON save. Relentless Rage sets Hit Points to ${newHp}.`,
                    saveRoll,
                    saveBonus,
                    saveTotal,
                    saveDc,
                    saveSuccess: true,
                    hpGained: newHp,
                    source: 'Relentless Rage',
                }).catch((e) => { console.error("[relentlessRage] Error:", e); });

                window.dispatchEvent(new CustomEvent('combat-summary-updated'));
            } else {
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: creature.name,
                    abilityName: 'Relentless Rage',
                    description: `${creature.name} failed CON save. Relentless Rage did not activate.`,
                    saveRoll,
                    saveBonus,
                    saveTotal,
                    saveDc,
                    saveSuccess: false,
                    source: 'Relentless Rage',
                }).catch((e) => { console.error("[relentlessRage] Error:", e); });

                const currentHp = getRuntimeValue(creature.name, 'currentHitPoints', campaignName);
                if (currentHp != null && Number(currentHp) <= 0) {
                    attachDeathSaveSlotMachine(creature, campaignName);
                }
            }

            await setRuntimeValue(creature.name, usesKey, currentUses + 1, campaignName);
        } catch (e) {
            // #1401: store rejections surface (no unhandled escape into the void) and
            // the uses latch is NOT bumped when the commit itself failed — no phantom
            // consumption. The listener already self-removed at the match above.
            console.error("[relentlessRage] Error:", e);
        }
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        intercepted: true,
        awaitingSave: true,
    };
}

export { evaluateHealExpression, getRuntimeUsesKey };
