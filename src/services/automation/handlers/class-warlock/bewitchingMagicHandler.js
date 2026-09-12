import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';

function bewitchingRefusal(action, auto) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name || 'Bewitching Magic',
            description: 'Bewitching Magic requires that your last spell cast was an enchantment or illusion spell.',
            automation: auto,
        },
    };
}

function passesBewitchingGate(lastAttack, playerName, action) {
    if (!lastAttack) return false;
    if (lastAttack.attackerName !== playerName) return false;
    // Check spell school is enchantment or illusion
    const school = (lastAttack.spellSchool || action.school || lastAttack.damageSchool || '').toLowerCase();
    return school === 'enchantment' || school === 'illusion';
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const freeCastCountKey = '_Steps_of_the_Fey_freeCastCount';
    const usesMax = evaluateAutoExpression('CHA modifier_min_1', playerStats) || 1;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? usesMax);

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);

    if (!passesBewitchingGate(lastAttack, playerName, action)) {
        return bewitchingRefusal(action, auto);
    }

    const cs = await getCombatContext(campaignName);

    // All checks passed — open the Steps of the Fey modal
    const eligibleTargets = cs?.creatures?.filter(c => c.name !== playerName) || [];
    const saveDc = 8 + (playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0) + (playerStats.proficiency || 0);

    return {
        type: 'modal',
        modalName: 'stepsOfTheFeyTaunt',
        payload: {
            mode: 'stepsOfTheFey',
            title: 'Bewitching Magic',
            targets: eligibleTargets,
            action,
            playerStats,
            campaignName,
            saveDc,
            featureName: 'Bewitching Magic',
            newCount: currentCount,
            freeCastCountKey,
        },
    };
}
