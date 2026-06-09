import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getLastAttackRoll, getLastAbilityCheck } from '../../../hooks/useMetamagic.js';
import { automationInfoPopup } from '../../shared/popupResponse.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

function handleAttackRoll(action, playerStats, campaignName, bonus) {
    const auto = action.automation;

    const attackEvent = getLastAttackRoll(playerStats.name);
    if (!attackEvent || isStale(attackEvent)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent attack roll found. This feature can only be used shortly after an attack roll.`,
                automation: auto,
            },
        };
    }

    const { d20, bonus: atkBonus, targetAc, hit, effectiveAc } = attackEvent;
    const ac = effectiveAc ?? targetAc;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + atkBonus;
    const modifiedHit = ac != null ? (modifiedD20 + atkBonus >= ac) : null;

    let description = `<b>${action.name}</b><br/>`;
    description += `Bonus: +${bonus}<br/>`;
    description += `Attack roll: d20(${d20}) + ${atkBonus} = ${d20 + atkBonus} vs AC ${ac != null ? ac : '—'} → <b>${hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `Modified: d20(${modifiedD20}) + ${atkBonus} = ${modifiedTotal} vs AC ${ac != null ? ac : '—'} → <b>${modifiedHit == null ? 'N/A' : modifiedHit ? 'HIT' : 'MISS'}</b><br/>`;

    if (hit === true) {
        description += `<br/><i>Attack already hit — no effect.</i>`;
    } else if (hit === false && modifiedHit === true) {
        description += `<br/><i>Miss turned into a hit!</i>`;
    } else if (hit === false && modifiedHit === false) {
        description += `<br/><i>Still a miss.</i>`;
    }

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
    };
}

function handleAbilityCheck(action, playerStats, _campaignName, bonus) {
    const auto = action.automation;

    const checkEvent = getLastAbilityCheck(playerStats.name);
    if (!checkEvent || isStale(checkEvent)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent ability check found. This feature can only be used shortly after an ability check.`,
                automation: auto,
            },
        };
    }

    const { d20, bonus: checkBonus, checkName } = checkEvent;
    const originalTotal = d20 + checkBonus;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + checkBonus;

    const description = `<b>${action.name}</b><br/>` +
        `Bonus: +${bonus}<br/>` +
        `${checkName}: d20(${d20}) + ${checkBonus} = ${originalTotal}` +
        ` → Modified: d20(${modifiedD20}) + ${checkBonus} = <b>${modifiedTotal}</b>`;

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
    };
}

function getBardicDieSize(playerStats) {
    if (!playerStats.class?.class_levels) return 0;
    const classLevel = playerStats.class.class_levels.find(cl => cl.level === playerStats.level);
    return classLevel?.bardic_die || 0;
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const bardicDieSize = getBardicDieSize(playerStats);

    if (bardicDieSize > 0 && auto.bonusExpression === 'bardic_inspiration_die') {
        const usesMax = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
            ?? (playerStats.proficiency || 0);

        if (usesMax > 0) {
            const usesUsed = Number(getRuntimeValue(playerName, 'bardicInspirationUses', campaignName) ?? 0);
            if (usesUsed >= usesMax) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
                        automation: auto,
                    },
                };
            }
        }

        const biDieRoll = Math.floor(Math.random() * bardicDieSize) + 1;

        const attackEvent = getLastAttackRoll(playerName);
        const abilityEvent = getLastAbilityCheck(playerName);

        const attackFresh = attackEvent && !isStale(attackEvent) && attackEvent.hit === false;
        const abilityFresh = abilityEvent && !isStale(abilityEvent);

        if (!attackFresh && !abilityFresh) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `No recent failed ability check or attack roll found. ${action.name} can only be used shortly after a failure.`,
                    automation: auto,
                },
            };
        }

        let result;
        if (attackFresh) {
            result = handleAttackRoll(action, playerStats, campaignName, biDieRoll);
        } else {
            result = handleAbilityCheck(action, playerStats, campaignName, biDieRoll);
        }

        if (usesMax > 0) {
            const usesUsed = Number(getRuntimeValue(playerName, 'bardicInspirationUses', campaignName) ?? 0);
            await setRuntimeValue(playerName, 'bardicInspirationUses', usesUsed + 1, campaignName);
        }

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name}: rolled 1d${bardicDieSize} (${biDieRoll}).`,
            biDieRoll,
            biDieSize: bardicDieSize,
            timestamp: Date.now(),
        }).catch(() => {});

        return result;
    }

    if (auto.bonus != null) {
        const bonus = Number(auto.bonus);

        const attackEvent = getLastAttackRoll(playerName);
        const abilityEvent = getLastAbilityCheck(playerName);

        const attackFresh = attackEvent && !isStale(attackEvent) && attackEvent.hit === false;
        const abilityFresh = abilityEvent && !isStale(abilityEvent);

        if (attackFresh) {
            return handleAttackRoll(action, playerStats, campaignName, bonus);
        }
        if (abilityFresh) {
            return handleAbilityCheck(action, playerStats, campaignName, bonus);
        }
    }

    return automationInfoPopup(action);
}
