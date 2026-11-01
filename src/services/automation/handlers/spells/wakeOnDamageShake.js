// Shared factory for the wake-on-damage "shake someone awake" spell pair
// (sleepShakeHandler.js #1957–#1959 / hypnoticPatternShake.js #1926). Both
// handlers drive this module from thin config wrappers — behavior-neutral
// extraction of the twin logic (exact shared runs :17-28, :58-68, :73-82);
// spell names, modal key, condition sets and log prefixes are config, not
// forks. Mirrors the createMassHealSpellTrigger(config) idiom of
// rules/features/massHealSpellFactory.js. Dependency-neutral on purpose:
// imports EXACTLY what both lanes already imported, so every existing
// strict-mock test suite keeps intercepting the same module identities.
//
// Pinned quirks preserved verbatim (ledger #1957 player-path phantom-log
// asymmetry vs the monster-path correct gate — documented do-not-fix):
// - player path logs a condition-removed entry for EVERY removalCondition
//   missing from the filtered array (even ones that were never present);
// - creature path logs only conditions actually seen beforehand, and only
//   for awakenConditions (a hypno speed_zero strip logs nothing).
//
// Config shape:
//   defaultFeatureName   — action.name fallback AND the ability_use log's
//                          abilityName + final popup name (hardcoded literals
//                          in both originals)
//   modalName            — modal routing key ('sleepShake' / 'hypnoticPatternShake')
//   awakenConditions     — lowercase condition keys that mark a "shakeable"
//                          target (target filter + creature-path log set, in order)
//   removalConditions    — lowercase keys stripped from activeConditions
//                          (player-path log loop set, in order)
//   conditionReason      — reason string on condition-removed log entries
//   logTag               — '[…]' console.error prefix for addEntry rejections
//   slumberPhrase        — noun phrase in the ability_use description
//                          ('magical slumber' / 'hypnotic stupor')
//   spellName            — spell named in the closing popup description
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

export function createWakeOnDamageShake(config) {
    const {
        defaultFeatureName,
        modalName,
        awakenConditions,
        removalConditions,
        conditionReason,
        logTag,
        slumberPhrase,
        spellName,
    } = config;

    const capitalize = (cond) => cond.charAt(0).toUpperCase() + cond.slice(1);

    async function handle(action, playerStats, campaignName, _mapName) {
        const auto = action.automation;
        const playerName = playerStats.name;
        const featureName = action.name || defaultFeatureName;

        const rangeFt = auto.range ? parseInt(auto.range.match(/(\d+)/)?.[1] || '5', 10) : 5;

        const positions = _mapName ? await resolveMapPositions(campaignName, _mapName, playerName) : null;

        const combatSummary = await getCombatContext(campaignName);
        if (!combatSummary?.creatures) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: 'No combat context found.',
                    automation: auto,
                },
            };
        }

        const eligibleTargets = [];
        for (const c of combatSummary.creatures) {
            if (c.name === playerName) continue;
            if (rangeFt > 0 && positions) {
                const inRange = await isWithinRange(playerName, c.name, rangeFt);
                if (!inRange) continue;
            }
            eligibleTargets.push(c);
        }

        const awakeTargets = combatSummary.creatures.filter(c => {
            if (c.name === playerName) return false;
            if (c.type === 'player') {
                const conditions = getRuntimeValue(c.name, 'activeConditions', campaignName) || [];
                const condArray = Array.isArray(conditions) ? conditions : [];
                return condArray.some(cond => awakenConditions.includes(String(cond).toLowerCase()));
            }
            return (c.conditions || []).some(cond => awakenConditions.includes(String(cond.key).toLowerCase()));
        });

        const targets = awakeTargets.length > 0 ? awakeTargets : eligibleTargets;

        if (targets.length === 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: 'No eligible targets within range.',
                    automation: auto,
                },
            };
        }

        return {
            type: 'modal',
            modalName,
            payload: {
                attackerName: playerName,
                campaignName,
                targets: targets.map(t => t.name),
                rangeFeet: rangeFt,
                featureName,
                automation: auto,
            },
        };
    }

    function shakeConditionEntry(campaignName, targetName, condition) {
        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition,
            reason: conditionReason,
            timestamp: Date.now(),
        }).catch((e) => { console.error(`${logTag} Error:`, e); });
    }

    async function shakeOutPlayer(targetName, campaignName) {
        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const condArray = Array.isArray(conditions) ? conditions : [];
        const filtered = condArray.filter(c => !removalConditions.includes(String(c).toLowerCase()));
        if (filtered.length !== condArray.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
            for (const cond of removalConditions) {
                if (!filtered.some(f => String(f).toLowerCase() === cond)) {
                    shakeConditionEntry(campaignName, targetName, capitalize(cond));
                }
            }
        }
    }

    function shakeOutCreature(targetName, campaignName) {
        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const condArray = Array.isArray(conditions) ? conditions : [];
        const filtered = condArray.filter(c => !removalConditions.includes(String(c).toLowerCase()));
        if (filtered.length !== condArray.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        }
        for (const cond of awakenConditions) {
            if (condArray.some(c => String(c).toLowerCase() === cond)) {
                shakeConditionEntry(campaignName, targetName, capitalize(cond));
            }
        }
    }

    async function handleConfirm(action, playerStats, campaignName, _mapName, targetName) {
        if (!targetName) return null;

        const playerName = playerStats.name;

        const combatSummary = await getCombatContext(campaignName);
        const creature = combatSummary?.creatures?.find(c => c.name === targetName);

        if (creature?.type === 'player') {
            await shakeOutPlayer(targetName, campaignName);
        } else if (creature) {
            shakeOutCreature(targetName, campaignName);
        }

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: defaultFeatureName,
            description: `${playerName} used an action to shake ${targetName} out of its ${slumberPhrase}.`,
            targetName,
            timestamp: Date.now(),
        }).catch((e) => { console.error(`${logTag} Error:`, e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: defaultFeatureName,
                description: `${targetName} is no longer affected by ${spellName}.`,
            },
        };
    }

    return { handle, handleConfirm };
}
