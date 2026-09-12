import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';
import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Check whether a creature (by name) is a Humanoid.
 * Players are always Humanoid. NPCs are checked against monster data.
 */
async function isTargetHumanoid(targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures) return true;

    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature) return true;

    if (creature.type === 'player') return true;

    try {
        const monsterData = await getMonsterData(targetName, null);
        if (monsterData?.type) {
            return monsterData.type.toLowerCase() === 'humanoid';
        }
    } catch (error) {
        // If we can't load monster data, default to Humanoid
        console.warn('[dominatePersonService] Monster data unavailable, defaulting to Humanoid:', error);
    }

    return true;
}

function dominatePersonInfoPopup(description) {
    return { type: 'popup', payload: { type: 'automation_info', name: 'Dominate Person', description } };
}

async function resolveDominatePersonTarget(playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (cs?.creatures && cs.creatures.length > 0) {
        const attackerTarget = getTargetFromAttacker(cs, playerStats.name);
        if (attackerTarget) return attackerTarget.name;
    }
    console.error(`[dominatePersonService] No target selected for Dominate Person by ${playerStats.name}. Caster has no target in initiative view.`);
    return null;
}

function refundDominatePersonSlot(playerStats, refundLevel, campaignName) {
    const slotKey = `spell_slots_level_${refundLevel}`;
    const currentSlots = getRuntimeValue(playerStats.name, slotKey);
    if (currentSlots != null && currentSlots >= 0) {
        setRuntimeValue(playerStats.name, slotKey, currentSlots + 1, campaignName);
    }
}

function logNonHumanoidRejection(targetName, playerStats, campaignName) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Dominate Person',
        description: `${playerStats.name} casts Dominate Person on ${targetName} but it has no effect — ${targetName} is not a Humanoid.`,
    }).catch((e) => { console.error("[dominatePersonService:log-error]", e); });
}

function resolveSlotLevel(metaCtx, spell) {
    return metaCtx?.slotLevel || spell.level || 5;
}

function resolveSpellSaveDc(metaCtx, playerStats) {
    return metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
}

export async function triggerDominatePerson(spell, metaCtx, playerStats, campaignName, mapName) {
    if ((spell.name || '').toLowerCase() !== 'dominate person') return null;

    const targetName = metaCtx?.targetName || await resolveDominatePersonTarget(playerStats, campaignName);
    if (!targetName) {
        return dominatePersonInfoPopup('No target selected for Dominate Person.');
    }

    // Check: Target is not a Humanoid
    const isHumanoid = await isTargetHumanoid(targetName, campaignName);
    if (!isHumanoid) {
        logNonHumanoidRejection(targetName, playerStats, campaignName);
        refundDominatePersonSlot(playerStats, resolveSlotLevel(metaCtx, spell), campaignName);
        return dominatePersonInfoPopup(`No effect. ${targetName} is not a Humanoid. Spell slot refunded.`);
    }

    // RAW advantage is "if you or your allies are fighting it" — the gridless app
    // exposes no adjacency/hostility signal on combatSummary, so no advantage is
    // granted here (the former currentHp<maxHp proxy was not the RAW condition).

    const action = {
        name: 'Dominate Person',
        automation: {
            type: 'dominate_person',
            saveDc: resolveSpellSaveDc(metaCtx, playerStats),
            targetName: targetName,
            advantage: false,
        },
        spell,
        spellSlotLevel: resolveSlotLevel(metaCtx, spell),
    };

    try {
        return await executeHandler(action, playerStats, campaignName, mapName);
    } catch (e) {
        console.error('[dominatePersonService] Failed to execute Dominate Person handler:', e);
        return dominatePersonInfoPopup('Failed to execute Dominate Person.');
    }
}
