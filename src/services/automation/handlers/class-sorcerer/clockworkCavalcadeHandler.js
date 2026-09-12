import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { spendSorceryPoints, getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { dispelSpellsOnTarget } from './clockworkCavalcadeDispel.js';

const USES_KEY = 'clockworkCavalcadeUses';
const RANGE_FT = 30;

function getFeatureInfo(action) {
    const auto = action.automation || {};
    return {
        featureName: action.name || 'Clockwork Cavalcade',
        maxHeal: auto.maxHeal || 100,
        restoreCost: auto.restoreCost || 7,
    };
}

function getUsesRemaining(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, USES_KEY, campaignName);
    return stored != null ? Number(stored) : 1;
}

function notConsumedPopup(action, reason) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name || 'Clockwork Cavalcade',
            description: reason,
            automation: action.automation || {},
        },
    };
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation || {};
    const playerName = playerStats.name;
    const { featureName, maxHeal, restoreCost } = getFeatureInfo(action);

    const usesRemaining = getUsesRemaining(playerName, campaignName);

    if (usesRemaining <= 0) {
        const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
        const currentSP = getCurrentSorceryPoints(playerName, maxSP);
        if (currentSP < restoreCost) {
            return notConsumedPopup(action, `${featureName} has no uses remaining (recharges on a Long Rest). You need ${restoreCost} Sorcery Points to restore it, but you only have ${currentSP}.`);
        }
    }

    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = [];
    if (combatSummary?.creatures) {
        for (const creature of combatSummary.creatures) {
            if (await isWithinRange(playerName, creature.name, RANGE_FT)) {
                creatureTargets.push({
                    name: creature.name,
                    type: creature.type,
                    currentHp: creature.currentHp,
                    maxHp: creature.maxHp,
                });
            }
        }
    }

    return {
        type: 'modal',
        modalName: 'clockworkCavalcade',
        payload: {
            action,
            playerStats,
            featureName,
            playerName,
            campaignName,
            auto,
            maxHeal,
            restoreCost,
            creatureTargets,
            combatSummary,
        },
    };
}

export async function consumeUse(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const { featureName, restoreCost } = getFeatureInfo(action);
    const usesRemaining = getUsesRemaining(playerName, campaignName);

    let spentSP = 0;
    if (usesRemaining <= 0) {
        const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
        const currentSP = getCurrentSorceryPoints(playerName, maxSP);
        if (currentSP < restoreCost) {
            return {
                ok: false,
                reason: `${featureName} has no uses remaining. You need ${restoreCost} Sorcery Points to restore it, but you only have ${currentSP}.`,
            };
        }
        spendSorceryPoints(playerName, restoreCost, campaignName, maxSP);
        spentSP = restoreCost;
        await setRuntimeValue(playerName, USES_KEY, 1, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${playerName} restored ${featureName} by spending ${restoreCost} Sorcery Points.`,
        }).catch((e) => { console.error("[clockworkCavalcade] Error:", e); });
    }

    await setRuntimeValue(playerName, USES_KEY, Math.max(0, usesRemaining - 1), campaignName);

    return {
        ok: true,
        spentSP,
        usesLeft: Math.max(0, usesRemaining - 1),
    };
}

async function healCubeTarget({ combatSummary, playerStats, campaignName, featureName, playerName, targetName, userAmount, remainingPool }) {
    const amount = Number(userAmount) || 0;
    if (amount <= 0) return null;

    const creatures = combatSummary && combatSummary.creatures ? combatSummary.creatures : [];
    const creature = creatures.find(c => c.name === targetName);
    const maxHp = (creature && creature.maxHp) || playerStats.hitPoints || 0;
    let currentHp;
    if (creature && creature.type === 'player') {
        const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
    } else {
        currentHp = creature ? (creature.currentHp ?? maxHp) : maxHp;
    }
    const missingHp = Math.max(0, maxHp - currentHp);
    const actualHeal = Math.min(amount, missingHp, remainingPool);

    if (actualHeal > 0) {
        applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
        remainingPool -= actualHeal;
    }

    const newHp = Math.min(maxHp, currentHp + actualHeal);
    await addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: actualHeal,
        currentHp: newHp,
        maxHp,
        isHealing: true,
        sourceName: playerName,
        note: featureName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[clockworkCavalcade] Error:", e); });

    return { entry: { targetName, healAmount: actualHeal }, remainingPool };
}

export async function confirmClockworkCavalcadeHeal(action, playerStats, campaignName, distribution, maxHeal) {
    const playerName = playerStats.name;
    const { featureName } = getFeatureInfo(action);
    const totalPool = Number(maxHeal) || 100;

    const consumed = await consumeUse(action, playerStats, campaignName);
    if (!consumed.ok) return notConsumedPopup(action, consumed.reason);

    const combatSummary = await getCombatContext(campaignName);
    const results = [];
    let remainingPool = totalPool;

    for (const [targetName, userAmount] of Object.entries(distribution || {})) {
        const healed = await healCubeTarget({ combatSummary, playerStats, campaignName, featureName, playerName, targetName, userAmount, remainingPool });
        if (!healed) continue;
        remainingPool = healed.remainingPool;
        results.push(healed.entry);
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    const totalHealed = results.reduce((sum, r) => sum + r.healAmount, 0);
    const targetList = results.map(r => `${r.targetName} (+${r.healAmount} HP)`).join(', ') || 'none';

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} (Heal), restoring ${totalHealed} HP across ${results.length} creature(s): ${targetList}${consumed.spentSP > 0 ? ` (${consumed.spentSP} SP spent to restore the use)` : ''}.`,
    }).catch((e) => { console.error("[clockworkCavalcade] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: action.automation?.type,
            description: `${featureName} (Heal) restored ${totalHealed} HP across ${results.length} creature(s) in the Cube: ${targetList}.`,
            automation: action.automation || {},
        },
    };
}

export async function confirmClockworkCavalcadeDispel(action, playerStats, campaignName, selectedTargets) {
    const playerName = playerStats.name;
    const { featureName } = getFeatureInfo(action);

    const consumed = await consumeUse(action, playerStats, campaignName);
    if (!consumed.ok) return notConsumedPopup(action, consumed.reason);

    const targets = Array.isArray(selectedTargets) ? selectedTargets : [];
    const allRemoved = [];

    for (const targetName of targets) {
        const removed = await dispelSpellsOnTarget(targetName, campaignName);
        allRemoved.push(removed);

        for (const condition of removed.conditions) {
            await addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: typeof condition === 'string' ? condition : condition.key,
                reason: `${featureName} (Dispel)`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[clockworkCavalcade] Error:", e); });
        }
    }

    window.dispatchEvent(new CustomEvent('target-effects-updated'));
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    const effectCount = allRemoved.reduce((sum, r) => sum + r.effects.length + r.buffs.length + r.conditions.length, 0);
    const detailLines = allRemoved
        .filter(r => r.effects.length > 0 || r.buffs.length > 0 || r.conditions.length > 0)
        .map(r => {
            const parts = [];
            if (r.effects.length > 0) parts.push(`${r.effects.length} spell effect(s)`);
            if (r.buffs.length > 0) parts.push(`${r.buffs.length} buff(s)`);
            if (r.conditions.length > 0) parts.push(`${r.conditions.length} condition(s)`);
            return `${r.target}: ${parts.join(', ')}`;
        });

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} (Dispel) on ${targets.length} creature(s), ending ${effectCount} spell effect(s) of level 6 or lower.${consumed.spentSP > 0 ? ` (${consumed.spentSP} SP spent to restore the use)` : ''}`,
    }).catch((e) => { console.error("[clockworkCavalcade] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: action.automation?.type,
            description: effectCount === 0
                ? `${featureName} (Dispel): No spells of level 6 or lower were found on the selected creature(s).`
                : `${featureName} (Dispel) ended ${effectCount} spell effect(s) of level 6 or lower on ${targets.length} creature(s): ${detailLines.join('; ') || 'none'}.`,
            automation: action.automation || {},
        },
    };
}

export async function confirmClockworkCavalcadeRepair(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const { featureName } = getFeatureInfo(action);

    const consumed = await consumeUse(action, playerStats, campaignName);
    if (!consumed.ok) return notConsumedPopup(action, consumed.reason);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} (Repair). Damaged objects within the 30-foot Cube are repaired instantly.${consumed.spentSP > 0 ? ` (${consumed.spentSP} SP spent to restore the use)` : ''}`,
    }).catch((e) => { console.error("[clockworkCavalcade] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: action.automation?.type,
            description: `${featureName} (Repair) — damaged objects in the 30-foot Cube are repaired instantly.`,
            automation: action.automation || {},
        },
    };
}
