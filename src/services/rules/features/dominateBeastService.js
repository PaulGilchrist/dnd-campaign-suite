import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';
import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Check whether a creature (by name) is a Beast.
 * NPCs are checked against monster data.
 */
async function isTargetBeast(targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures) return true;

    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature) return true;

    if (creature.type === 'player') return false;

    try {
        const monsterData = await getMonsterData(targetName, null);
        if (monsterData?.type) {
            return monsterData.type.toLowerCase() === 'beast';
        }
    } catch (error) {
        // If we can't load monster data, default to Beast
        console.warn('[dominateBeastService] Monster data unavailable, defaulting to Beast:', error);
    }

    return true;
}

function dominateInfoPopup(description) {
    return { type: 'popup', payload: { type: 'automation_info', name: 'Dominate Beast', description } };
}

async function resolveDominateTarget(playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (cs?.creatures && cs.creatures.length > 0) {
        const attackerTarget = getTargetFromAttacker(cs, playerStats.name);
        if (attackerTarget) return attackerTarget.name;
    }
    console.error(`[dominateBeastService] No target selected for Dominate Beast by ${playerStats.name}. Caster has no target in initiative view.`);
    return null;
}

function refundDominateBeastSlot(playerStats, refundLevel, campaignName) {
    const slotKey = `spell_slots_level_${refundLevel}`;
    const currentSlots = getRuntimeValue(playerStats.name, slotKey);
    if (currentSlots != null && currentSlots >= 0) {
        setRuntimeValue(playerStats.name, slotKey, currentSlots + 1, campaignName);
    }
}

async function targetIsNotFullHealth(targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);
    return targetCreature && targetCreature.currentHp != null && targetCreature.maxHp != null && targetCreature.currentHp < targetCreature.maxHp;
}

function resolveSlotLevel(metaCtx, spell) {
    return metaCtx?.slotLevel || spell.level || 4;
}

function resolveSpellSaveDc(metaCtx, playerStats) {
    return metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
}

async function handleNonBeastTarget(playerStats, targetName, metaCtx, spell, campaignName) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Dominate Beast',
        description: `${playerStats.name} casts Dominate Beast on ${targetName} but it has no effect — ${targetName} is not a Beast.`,
    }).catch((e) => { console.error("[dominateBeastService:log-error]", e); });
    refundDominateBeastSlot(playerStats, resolveSlotLevel(metaCtx, spell), campaignName);
    return dominateInfoPopup(`No effect. ${targetName} is not a Beast. Spell slot refunded.`);
}

export async function triggerDominateBeast(spell, metaCtx, playerStats, campaignName, mapName) {
    if ((spell.name || '').toLowerCase() !== 'dominate beast') return null;

    const targetName = metaCtx?.targetName || await resolveDominateTarget(playerStats, campaignName);
    if (!targetName) {
        return dominateInfoPopup('No target selected for Dominate Beast.');
    }

    // Check: Target is not a Beast
    const isBeast = await isTargetBeast(targetName, campaignName);
    if (!isBeast) {
        return handleNonBeastTarget(playerStats, targetName, metaCtx, spell, campaignName);
    }

    // Check if target is at full health to determine if target gets advantage on save
    const targetNotFullHealth = await targetIsNotFullHealth(targetName, campaignName);

    const action = {
        name: 'Dominate Beast',
        automation: {
            type: 'dominate_beast',
            saveDc: resolveSpellSaveDc(metaCtx, playerStats),
            targetName: targetName,
            advantage: targetNotFullHealth,
        },
        spell,
        spellSlotLevel: resolveSlotLevel(metaCtx, spell),
    };

    try {
        return await executeHandler(action, playerStats, campaignName, mapName);
    } catch (e) {
        console.error('[dominateBeastService] Failed to execute Dominate Beast handler:', e);
        return dominateInfoPopup('Failed to execute Dominate Beast.');
    }
}
