import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { spendSorceryPoints } from '../../../../hooks/useMetamagic.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { addEntry } from '../../../ui/logService.js';

function getRuntimeKey(playerName, key) {
    return playerName.toLowerCase().replace(/\s+/g, '') + '_' + key;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Clockwork Cavalcade';

    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = playerStats.resources?.sorcery_points?.current ?? maxSP;

    const usesKey = getRuntimeKey(playerName, 'clockworkCavalcadeUses');
    const restKey = getRuntimeKey(playerName, 'clockworkCavalcadeRestTimestamp');

    const lastRest = getRuntimeValue(playerName, restKey, campaignName);
    const now = Date.now();
    let active = false;
    let usesRemaining = 0;
    let usesMax = 1;

    if (lastRest && (now - lastRest) < 86400000) {
        const stored = getRuntimeValue(playerName, usesKey, campaignName);
        usesRemaining = stored != null ? Number(stored) : usesMax;
        active = usesRemaining > 0;
    } else {
        usesRemaining = usesMax;
        active = true;
    }

    if (!active) {
        if (currentSP >= 7) {
            spendSorceryPoints(playerName, 7, campaignName);
            await setRuntimeValue(playerName, restKey, now, campaignName);
            await setRuntimeValue(playerName, usesKey, usesMax, campaignName);
            active = true;
            usesRemaining = usesMax;

            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${playerName} restored Clockwork Cavalcade by spending 7 Sorcery Points.`,
                timestamp: now,
            }).catch(() => {});
        } else {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} has no uses remaining. Recharges on a Long Rest, or you can spend 7 Sorcery Points to restore.`,
                    automation: auto,
                },
            };
        }
    }

    if (usesMax > 0) {
        await setRuntimeValue(playerName, usesKey, usesRemaining - 1, campaignName);
    }

    const description = `<b>${featureName}</b><br/>Action — 30-foot Cube<br/>`
        + `• Heal: Up to 100 HP divided among creatures in range<br/>`
        + `• Repair: Damaged objects repaired instantly<br/>`
        + `• Dispel: Every spell of level 6 and lower ends<br/>`
        + `${usesRemaining > 1 ? (usesRemaining - 1) + ' use' + (usesRemaining - 1 > 1 ? 's' : '') + ' remaining' : 'No uses remaining'}.`;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName}.`,
        timestamp: now,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
        },
    };
}
