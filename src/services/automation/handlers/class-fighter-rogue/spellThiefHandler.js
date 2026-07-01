import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { createSaveListener, buildSaveDc } from '../../common/savePrompt.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
const SPELL_THIEF_BLOCK_KEY = 'spellThiefBlocked';
const SPELL_THIEF_STOLEN_KEY = 'spellThiefStolen';
const SPELL_THIEF_BLOCKED_LIST_KEY = '_spellThiefBlockedList';
const SPELL_THIEF_STOLEN_LIST_KEY = '_spellThiefStolenList';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}



function getBlockedSpellKey(casterName, spellName) {
    return `${SPELL_THIEF_BLOCK_KEY}_${casterName}_${spellName}`;
}

function getStolenSpellKey(casterName, spellName) {
    return `${SPELL_THIEF_STOLEN_KEY}_${casterName}_${spellName}`;
}

async function addBlockedSpell(playerName, casterName, spellName, campaignName) {
    await setRuntimeValue(playerName, getBlockedSpellKey(casterName, spellName), true, campaignName);
    const list = getRuntimeValue(playerName, SPELL_THIEF_BLOCKED_LIST_KEY, campaignName);
    const entries = list ? JSON.parse(list) : [];
    if (!entries.some(e => e.casterName === casterName && e.spellName === spellName)) {
        entries.push({ casterName, spellName });
        await setRuntimeValue(playerName, SPELL_THIEF_BLOCKED_LIST_KEY, JSON.stringify(entries), campaignName);
    }
}

async function addStolenSpell(playerName, casterName, spellName, campaignName) {
    await setRuntimeValue(playerName, getStolenSpellKey(casterName, spellName), true, campaignName);
    const list = getRuntimeValue(playerName, SPELL_THIEF_STOLEN_LIST_KEY, campaignName);
    const entries = list ? JSON.parse(list) : [];
    if (!entries.some(e => e.casterName === casterName && e.spellName === spellName)) {
        entries.push({ casterName, spellName });
        await setRuntimeValue(playerName, SPELL_THIEF_STOLEN_LIST_KEY, JSON.stringify(entries), campaignName);
    }
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Spell Thief';

    const usesKey = getRuntimeUsesKey(featureName);
    const storedUses = getRuntimeValue(playerName, usesKey);
    const currentUses = storedUses != null ? Number(storedUses) : 1;

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

    const cs = await getCombatContext(campaignName);
    const lastAttack = cs?.lastAttack || null;

    const casterName = action.casterName || (lastAttack?.attackerName) || action.targetName || 'unknown creature';
    const spellName = action.spellName || (lastAttack?.attackName) || 'unknown spell';

    const saveDc = buildSaveDc(auto, playerStats);

    const { promptId } = createSaveListener(campaignName, {
        targetName: casterName,
        saveType: auto.saveType || 'INT',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — ${casterName} must make INT save (DC ${saveDc}) or lose the spell.`,
        promptId,
    }).catch((e) => { console.error("[spellThief] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        const isSuccessful = event.detail.success;

        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

        if (!isSuccessful) {
            await addBlockedSpell(playerName, casterName, spellName, campaignName);
            await addStolenSpell(playerName, casterName, spellName, campaignName);

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
                targetName: casterName,
                saveDc,
                saveType: auto.saveType || 'INT',
                success: false,
                description: `${casterName} failed INT save. Spell negated. ${playerName} steals ${spellName} for 8 hours. ${casterName} cannot cast ${spellName} for 8 hours.`,
            }).catch((e) => { console.error("[spellThief] Error:", e); });

            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                rollType: `save-${auto.type}`,
                targetName: casterName,
                saveDc,
                saveType: auto.saveType || 'INT',
                success: true,
                description: `${casterName} succeeded on INT save. ${featureName} has no effect.`,
            }).catch((e) => { console.error("[spellThief] Error:", e); });
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            targetName: casterName,
            description: `${casterName} must make an INT saving throw (DC ${saveDc}) or the spell is negated and ${playerName} steals knowledge of it for 8 hours.`,
            automation: auto,
            casterName,
            spellName,
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
