import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { addEntry } from '../../ui/logService.js';

function compelledDuelInfoPopup(description) {
    return { type: 'popup', payload: { type: 'automation_info', name: 'Compelled Duel', description } };
}

async function resolveCompelledDuelTarget(playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (cs?.creatures && cs.creatures.length > 0) {
        const attackerTarget = getTargetFromAttacker(cs, playerStats.name);
        if (attackerTarget) return attackerTarget.name;
    }
    console.error(`[compelledDuelService] No target selected for Compelled Duel by ${playerStats.name}. Caster has no target in initiative view.`);
    return null;
}

export async function triggerCompelledDuel(spell, metaCtx, playerStats, campaignName, mapName) {
    // SP-026: an un-armed cast must refuse (dominate-monster/person seam shape)
    // instead of opening a save prompt addressed to "Unknown".
    const targetName = metaCtx?.targetName || await resolveCompelledDuelTarget(playerStats, campaignName);
    if (!targetName) {
        addEntry(campaignName, {
            type: 'automation',
            creatureName: playerStats.name,
            name: 'Compelled Duel',
            automationType: 'compelled_duel_refused',
            automationDetail: 'no_target',
            description: `${playerStats.name} cast Compelled Duel with no armed target — refused; no save prompt opened.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[compelledDuelService] refusal log failed:', e); });
        return compelledDuelInfoPopup('No target selected for Compelled Duel.');
    }

    const action = {
        name: 'Compelled Duel',
        spell: spell,
        automation: {
            type: 'compelled_duel',
            saveDc: metaCtx?.spellSaveDc,
            saveType: 'WIS',
            targetName: targetName,
        },
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[compelledDuelService] Failed to execute Compelled Duel handler:', e);
        throw e;
    }
}
