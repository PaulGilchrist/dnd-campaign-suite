import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
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

    let usesRemaining;

    const stored = getRuntimeValue(playerName, usesKey, campaignName);
    usesRemaining = stored != null ? Number(stored) : 1;
    const active = usesRemaining > 0;

    if (!active) {
        if (currentSP >= 7) {
            spendSorceryPoints(playerName, 7, campaignName);
            await setRuntimeValue(playerName, usesKey, 1, campaignName);
            usesRemaining = 1;

            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${playerName} restored Clockwork Cavalcade by spending 7 Sorcery Points.`,
            }).catch((e) => { console.error("[clockworkCavalcade] Error:", e); });
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

    await setRuntimeValue(playerName, usesKey, usesRemaining - 1, campaignName);

    const description = `Action — 30-foot Cube<br/>`
        + `• Heal: Up to 100 HP divided among creatures in range<br/>`
        + `• Repair: Damaged objects repaired instantly<br/>`
        + `• Dispel: Every spell of level 6 and lower ends<br/>`
        + `${usesRemaining > 1 ? (usesRemaining - 1) + ' use' + (usesRemaining - 1 > 1 ? 's' : '') + ' remaining' : 'No uses remaining'}.`;

    addEntry(campaignName, {
        type: 'summons',
        characterName: playerName,
        summonName: featureName,
        description: `<b>${featureName}</b><br/>Action — 30-foot Cube<br/>`
            + `• Heal: Up to 100 HP divided among creatures in range<br/>`
            + `• Repair: Damaged objects repaired instantly<br/>`
            + `• Dispel: Every spell of level 6 and lower ends<br/>`
            + `${usesRemaining > 1 ? (usesRemaining - 1) + ' use' + (usesRemaining - 1 > 1 ? 's' : '') + ' remaining' : 'No uses remaining'}.`,
        summonedCreatures: ['spirits of order'],
    }).catch((e) => { console.error("[clockworkCavalcade] Error:", e); });

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
