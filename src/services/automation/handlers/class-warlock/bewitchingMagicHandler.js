import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const freeCastCountKey = '_Steps_of_the_Fey_freeCastCount';
    const usesMax = evaluateAutoExpression('CHA modifier_min_1', playerStats) || 1;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? usesMax);

    // Get combat context
    const cs = await getCombatContext(campaignName);
    console.log('[bewitchingMagic] cs.lastAttack exists:', !!cs?.lastAttack, 'cs:', JSON.stringify(cs).substring(0, 500));

    // Check lastAttack exists
    if (!cs?.lastAttack) {
        console.log('[bewitchingMagic] FAIL: no lastAttack');
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

    // Check attacker is the warlock
    if (cs.lastAttack.attackerName !== playerName) {
        console.log('[bewitchingMagic] FAIL: attackerName mismatch:', cs.lastAttack.attackerName, '!==', playerName);
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

    // Check spell school is enchantment or illusion
    const school = (cs.lastAttack.spellSchool || action.school || cs.lastAttack.damageSchool || '').toLowerCase();
    console.log('[bewitchingMagic] spellSchool check:', 'spellSchool=', cs.lastAttack.spellSchool, 'action.school=', action.school, 'damageSchool=', cs.lastAttack.damageSchool, 'resolved=', school);
    if (school !== 'enchantment' && school !== 'illusion') {
        console.log('[bewitchingMagic] FAIL: school not enchantment/illusion, resolved to:', school);
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

    // All checks passed — open the Steps of the Fey modal
    const eligibleTargets = cs.creatures?.filter(c => c.name !== playerName) || [];
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
