import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { createSaveListener, buildSaveDc } from '../../common/savePrompt.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const SPELL_THIEF_BLOCK_KEY = 'spellThiefBlocked';
const SPELL_THIEF_STOLEN_KEY = 'spellThiefStolen';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

function getRuntimeRestTimestampKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'RestTimestamp';
}

function getBlockedSpellKey(casterName, spellName) {
    return `${SPELL_THIEF_BLOCK_KEY}_${casterName}_${spellName}`;
}

function getStolenSpellKey(casterName, spellName) {
    return `${SPELL_THIEF_STOLEN_KEY}_${casterName}_${spellName}`;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Spell Thief';

    const usesKey = getRuntimeUsesKey(featureName);
    const restTimestampKey = getRuntimeRestTimestampKey(featureName);
    const lastRestTimestamp = getRuntimeValue(playerName, restTimestampKey, campaignName);
    const now = Date.now();

    let currentUses = 1;
    if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
        currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? 1);
    } else if (!lastRestTimestamp) {
        currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? 1);
    }

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} has no uses remaining. Recharges after a Long Rest.`,
                automation: auto,
            },
        };
    }

    const saveDc = buildSaveDc(auto, playerStats);

    const { promptId } = createSaveListener(campaignName, {
        targetName: action.targetName || playerName,
        saveType: auto.saveType || 'INT',
        saveDc,
    });

    const targetName = action.targetName || 'Target';

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — ${targetName} must make INT save (DC ${saveDc}) or lose the spell.`,
        promptId,
    }).catch((e) => { console.error("[spellThief] Error:", e); throw e; });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        const isSuccessful = event.detail.success;

        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

        if (!isSuccessful) {
            const casterName = action.casterName || targetName;
            const spellName = action.spellName || 'unknown spell';
            const blockedKey = getBlockedSpellKey(casterName, spellName);
            const stolenKey = getStolenSpellKey(casterName, spellName);

            await setRuntimeValue(playerName, blockedKey, true, campaignName);
            await setRuntimeValue(playerName, stolenKey, true, campaignName);

            addExpiration(playerName, playerName, [
                { type: 'add_prepared_spell', spellName }
            ], campaignName, 480);

            addExpiration(playerName, playerName, [
                { type: 'remove_prepared_spell', spellName }
            ], campaignName, 480);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'INT',
                success: false,
                description: `${targetName} failed INT save. Spell negated. ${playerName} steals ${spellName} for 8 hours. ${casterName} cannot cast ${spellName} for 8 hours.`,
            }).catch((e) => { console.error("[spellThief] Error:", e); throw e; });

            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'INT',
                success: true,
                description: `${targetName} succeeded on INT save. ${featureName} has no effect.`,
            }).catch((e) => { console.error("[spellThief] Error:", e); throw e; });
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            targetName,
            description: `${targetName} must make an INT saving throw (DC ${saveDc}) or the spell is negated and ${playerName} steals knowledge of it for 8 hours.`,
            automation: auto,
            casterName: action.casterName,
            spellName: action.spellName,
        },
    };
}

export function isBlockedBySpellThief(playerName, casterName, spellName, campaignName) {
    const blockedKey = getBlockedSpellKey(casterName, spellName);
    const blocked = getRuntimeValue(playerName, blockedKey, campaignName);
    return blocked === true;
}

export function hasStolenSpell(playerName, casterName, spellName, campaignName) {
    const stolenKey = getStolenSpellKey(casterName, spellName);
    const stolen = getRuntimeValue(playerName, stolenKey, campaignName);
    return stolen === true;
}
