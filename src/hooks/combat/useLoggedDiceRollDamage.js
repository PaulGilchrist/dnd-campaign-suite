import { formatDamageFormula } from '../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasGreatWeaponFighting, applyGreatWeaponFightingToDamage } from '../../services/combat/automation/automationService.js';
import { isMagicMissileImmune, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';

import { createAutoMissHandler } from './handlers/handleAutoMiss.js';
import { createAoeDamageHandler } from './handlers/handleAoeDamage.js';
import { createNpcSaveDamageHandler } from './handlers/handleNpcSaveDamage.js';
import { createPlayerSaveDamageHandler } from './handlers/handlePlayerSaveDamage.js';
import { createPlainDamageHandler } from './handlers/handlePlainDamage.js';
import { handleSanctuarySave } from './handlers/handleSanctuarySave.js';
import { applySuperiorityDamageBonuses } from './handlers/handleSuperiorityBonuses.js';
import { resolveTargetMaxHp } from './handlers/damageHandlerUtils.js';

function applyDamageRollAdjustments({ isCrit, context, boostedTotal, boostedRolls, modifier, damageType }) {
    const gwfBaseRolls = isCrit && context?.doubledRolls ? context.doubledRolls.slice(0, context.doubledRolls.length / 2) : boostedRolls;
    const rollsForMin = isCrit && context?.doubledRolls ? context.doubledRolls : boostedRolls;
    let adjustedTotal = applyMinDamageAdjustment(boostedTotal, rollsForMin, context?.playerStats, damageType);
    let displayRolls = isCrit && context?.doubledRolls ? context.doubledRolls : boostedRolls;
    let gwfDisplayRolls = gwfBaseRolls;
    if (hasGreatWeaponFighting(context?.playerStats)) {
        const gwfRolls = applyGreatWeaponFightingToDamage(gwfBaseRolls, context?.playerStats);
        const hasChanges = gwfRolls.some((r, i) => r !== gwfBaseRolls[i]);
        if (hasChanges) {
            const gwfTotal = (isCrit ? gwfRolls.reduce((sum, r) => sum + r, 0) * 2 : gwfRolls.reduce((sum, r) => sum + r, 0)) + modifier;
            adjustedTotal = applyMinDamageAdjustment(gwfTotal, gwfRolls, context?.playerStats, damageType);
            displayRolls = isCrit ? gwfRolls.concat(gwfRolls) : gwfRolls;
            gwfDisplayRolls = gwfRolls;
        }
    }
    return { adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls };
}

function findContextTarget(combatSummary, context) {
    return combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
}

function resolveImmunityCurrentHp(target) {
    if (target?.type === 'player') return getRuntimeValue(target.name, 'hitPoints') ?? 0;
    return target?.currentHp ?? target?.maxHp;
}

function buildImmunityLogData({ characterName, name, formula, rolls, total, modifier, context, isCrit }) {
    return {
        type: 'roll',
        characterName,
        rollType: 'damage',
        name,
        formula: isCrit ? formatDamageFormula(formula, rolls, true) : formula,
        rolls,
        total,
        modifier,
        damageType: context?.damageType,
        targetName: context?.targetName,
        finalDamage: 0,
        note: 'Shield: Immune to Magic Missile',
        isCrit,
    };
}

function buildImmunityPopupData({ name, formula, rolls, total, modifier, context, target, targetMaxHp }) {
    return {
        type: 'damage',
        name,
        formula,
        rolls,
        bonus: 0,
        modifier,
        damageType: context?.damageType,
        targetName: context?.targetName,
        total,
        adjustedTotal: 0,
        targetCurrentHp: resolveImmunityCurrentHp(target),
        targetMaxHp,
        damageApplied: true,
        finalDamage: 0,
        damageReduced: true,
        note: 'Shield: Immune to Magic Missile',
    };
}

async function handleMagicMissileImmunity({ characterName, campaignName, name, formula, rolls, total, modifier, context, logEntry, setPopupHtml }) {
    if (!isMagicMissileImmune(characterName, campaignName) || !name || name.toLowerCase() !== 'magic missile') return false;
    const combatSummary = await loadCombatSummary(campaignName);
    const target = findContextTarget(combatSummary, context);
    const targetMaxHp = resolveTargetMaxHp(target);
    const isCrit = context?.isAutoCrit || false;
    logEntry(buildImmunityLogData({ characterName, name, formula, rolls, total, modifier, context, isCrit }));
    setPopupHtml(buildImmunityPopupData({ name, formula, rolls, total, modifier, context, target, targetMaxHp }));
    return true;
}

export function createLogDamageAndShow(deps) {
    const { characterName, campaignName, setPopupHtml, logEntry } = deps;
    const handlerDeps = { characterName, campaignName, characters: deps.characters, charactersRef: deps.charactersRef, setPopupHtml, logEntry, pendingSaves: deps.pendingSaves };

    const autoMissHandler = createAutoMissHandler(handlerDeps);
    const aoeDamageHandler = createAoeDamageHandler(handlerDeps);
    const npcSaveDamageHandler = createNpcSaveDamageHandler(handlerDeps);
    const playerSaveDamageHandler = createPlayerSaveDamageHandler(handlerDeps);
    const plainDamageHandler = createPlainDamageHandler(handlerDeps);

    return async function logDamageAndShow(name, formula, total, rolls, modifier, context) {

        // Sanctuary: if target is warded, attacker (characterName) must succeed on WIS save before save-based spell
        const sanctuaryResult = await handleSanctuarySave(characterName, campaignName, context, logEntry);
        if (sanctuaryResult.blocked) {
            setPopupHtml({ type: 'automation_info', name: 'Sanctuary', description: sanctuaryResult.description });
            return;
        }

        // Apply superiority damage bonuses
        const { total: boostedTotal, rolls: boostedRolls } = applySuperiorityDamageBonuses(characterName, campaignName, formula, total, rolls, context);

        const { saveDc, saveType, damageType, isAutoMiss } = context || {};
        const isCrit = context?.isAutoCrit || context?.isCrit || false;
        const { adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls } = applyDamageRollAdjustments({ isCrit, context, boostedTotal, boostedRolls, modifier, damageType });

        if (await handleMagicMissileImmunity({ characterName, campaignName, name, formula, rolls, total, modifier, context, logEntry, setPopupHtml })) return;

        const combatSummary = await loadCombatSummary(campaignName);

        if (isAutoMiss) {
            await autoMissHandler(name, formula, total, rolls, modifier, context);
            return;
        }

        const targetTargetName = context?.targetName;
        if (targetTargetName && targetTargetName.startsWith('overlay-')) {
            await aoeDamageHandler({ name, formula, total, rolls, modifier, context, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls });
            return;
        }

        const target = findContextTarget(combatSummary, context);

        if (saveDc && saveType && target) {
            if (target.type === 'npc') {
                await npcSaveDamageHandler({ name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls });
                return;
            }

            if (target.type === 'player') {
                const handled = await playerSaveDamageHandler({ name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls });
                if (handled) return;
            }
        }

        await plainDamageHandler({ name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls });
    };
}
