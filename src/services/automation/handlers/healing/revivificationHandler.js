import { getRuntimeValue, setRuntimeValue, setRuntimeBatch } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import storage from '../../../ui/storage.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const storedRage = getRuntimeValue(playerName, 'ragePoints', campaignName);
    const currentRage = storedRage != null ? Number(storedRage) : 0;
    if (currentRage <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Rage remaining to power Revivification.',
                automation: auto,
            },
        };
    }

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat active.',
                automation: auto,
            },
        };
    }

    const target = getTargetFromAttacker(cs, playerName);
    if (!target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Select a target in the combat tracker first.',
                automation: auto,
            },
        };
    }

    const targetHp = target.type === 'player'
        ? (getRuntimeValue(target.name, 'currentHitPoints', campaignName) ?? 0)
        : (target.currentHp ?? 0);

    if (targetHp > 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${target.name} is not at 0 Hit Points.`,
                automation: auto,
            },
        };
    }

    const healAmount = playerStats.level || 1;

    await setRuntimeValue(playerName, 'ragePoints', currentRage - 1, campaignName);

    if (target.type === 'player') {
        // Resurrection always lifts the bucket from 0 to positive, so it must
        // carry the app-wide death-state reset — the same merged one-POST idiom
        // the HoUoM resurrection commit (handOfUltimateMercyHandler
        // .applyResurrectionHeal, 7d64885e3) and the sheet-revive lane commit,
        // and the CLA-092 heal choke (applyHealing.js) performs for its
        // oldHp<=0 -> newHp>0 transition. The old currentHitPoints-only write
        // left isDead:1 + stale death-save arrays on a living creature
        // (bug-revivification-handler-leaves-isdead-stuck), so every downstream
        // death gate (isCreatureDead, Revivify corpse census) still read the
        // resurrected ally as a corpse. One setRuntimeBatch POST writes the
        // whole set.
        setRuntimeBatch(target.name, {
            currentHitPoints: healAmount,
            deathSaves: [false, false, false],
            deathFailures: [false, false, false],
            isDead: 0,
        }, campaignName);
    } else {
        target.currentHp = healAmount;
        const summary = cs;
        if (summary) {
            storage.set('combatSummary', summary, campaignName);
        }
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    // Log-family parity (2026-11-14 resurrection log-family split): this revive
    // writer used to commit `type:'heal'` — an unregistered log type that fell
    // back to GenericEntry and escaped every hp_change-keyed HP audit. It now
    // rides the hp_change heal-family field set (revivifyService.js:105 twin).
    const maxHp = target.type === 'player'
        ? (getRuntimeValue(target.name, 'hitPoints', campaignName) ?? target.maxHp)
        : target.maxHp;
    addEntry(campaignName, {
        type: 'hp_change',
        characterName: playerName,
        targetName: target.name,
        delta: healAmount - targetHp,
        currentHp: healAmount,
        maxHp,
        isHealing: (healAmount - targetHp) > 0,
        sourceName: playerName,
        note: action.name,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[revivification] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${playerName} uses Revivification to save ${target.name}, setting their Hit Points to ${healAmount} and expending 1 Rage.`,
            automation: auto,
        },
    };
}
