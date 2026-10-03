import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

// CLA-037: Bewitching Magic is a free Misty Step rider with NO uses limit in
// data — it must never read or burn the foreign `_Steps_of_the_Fey_freeCastCount`
// counter (Steps of the Fey owns that key; see stepsOfTheFeyHandler.js).

function bewitchingRefusal(action, playerName, campaignName, reason) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        abilityName: action.name || 'Bewitching Magic',
        automationType: action.automation?.type || 'bewitching_magic',
        automationDetail: 'bewitching_magic_refused',
        reason,
        description: `Bewitching Magic refused — ${reason}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[bewitchingMagic] Error logging refusal:', e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name || 'Bewitching Magic',
            description: 'Bewitching Magic requires that your last spell cast was an enchantment or illusion spell.',
            automation: action.automation,
        },
    };
}

function qualifiesSchool(school) {
    return school === 'enchantment' || school === 'illusion';
}

function resolveSchool(lastAttack, action) {
    return (lastAttack?.spellSchool || lastAttack?.damageSchool || action?.school || '').toLowerCase();
}

// Manual-lane gate: returns a refusal reason, or null when the lastAttack qualifies.
async function manualRefusalReason(playerName, campaignName) {
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack || lastAttack.attackerName !== playerName) {
        return 'no qualifying spell cast by you in the current combat record';
    }
    const school = resolveSchool(lastAttack, null);
    if (!qualifiesSchool(school)) {
        return `last spell school was ${school || 'unknown'}, not enchantment or illusion`;
    }
    return null;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const playerName = playerStats.name;

    let refusalReason = null;
    if (action.autoTrigger === true) {
        // Auto lane (postCastRiderService.triggerBewitchingMagic): the trigger ran
        // inside this caster's own cast resolution and already gated school + spell
        // slot + action casting time, so the cast fact is authoritative here.
        if (!qualifiesSchool(resolveSchool(null, action))) {
            refusalReason = 'last spell cast was not an enchantment or illusion spell';
        }
    } else {
        // Manual lane: gate on the campaign lastAttack stamp — the spell-save /
        // spell-cast lanes now carry spellSchool (damageRollback / handleNpcSaveDamage).
        refusalReason = await manualRefusalReason(playerName, campaignName);
    }

    if (refusalReason) {
        return bewitchingRefusal(action, playerName, campaignName, refusalReason);
    }

    const cs = await getCombatContext(campaignName);
    const eligibleTargets = cs?.creatures?.filter(c => c.name !== playerName) || [];
    const saveDc = 8 + (playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0) + (playerStats.proficiency || 0);

    return {
        type: 'modal',
        modalName: 'stepsOfTheFeyTaunt',
        payload: {
            mode: 'bewitchingMagic',
            title: 'Bewitching Magic',
            targets: eligibleTargets,
            action,
            playerStats,
            campaignName,
            saveDc,
            featureName: 'Bewitching Magic',
            // CLA-037: unlimited free rider — no uses counter, no freeCastCountKey.
            unlimited: true,
        },
    };
}
