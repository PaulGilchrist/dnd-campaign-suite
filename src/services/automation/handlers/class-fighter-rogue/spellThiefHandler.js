import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { createSaveListener, buildSaveDc } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
const SPELL_THIEF_BLOCK_KEY = 'spellThiefBlocked';
const SPELL_THIEF_STOLEN_KEY = 'spellThiefStolen';
const SPELL_THIEF_BLOCKED_LIST_KEY = '_spellThiefBlockedList';
const SPELL_THIEF_STOLEN_LIST_KEY = '_spellThiefStolenList';
const SPELL_THIEF_CASTER_BLOCK_KEY = '_spellThiefCasterBlock';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}



function getBlockedSpellKey(casterName, spellName) {
    return `${SPELL_THIEF_BLOCK_KEY}_${casterName}_${spellName}`;
}

function getStolenSpellKey(casterName, spellName) {
    return `${SPELL_THIEF_STOLEN_KEY}_${casterName}_${spellName}`;
}

async function addBlockedSpell(thiefName, casterName, spellName, campaignName) {
    await setRuntimeValue(thiefName, getBlockedSpellKey(casterName, spellName), true, campaignName);
    const list = getRuntimeValue(thiefName, SPELL_THIEF_BLOCKED_LIST_KEY, campaignName);
    const entries = list ? JSON.parse(list) : [];
    if (!entries.some(e => e.casterName === casterName && e.spellName === spellName)) {
        entries.push({ casterName, spellName });
        await setRuntimeValue(thiefName, SPELL_THIEF_BLOCKED_LIST_KEY, JSON.stringify(entries), campaignName);
    }

    const casterList = getRuntimeValue(casterName, SPELL_THIEF_CASTER_BLOCK_KEY, campaignName);
    const casterEntries = casterList ? JSON.parse(casterList) : [];
    if (!casterEntries.some(e => e.thiefName === thiefName && e.spellName === spellName)) {
        casterEntries.push({ thiefName, spellName });
        await setRuntimeValue(casterName, SPELL_THIEF_CASTER_BLOCK_KEY, JSON.stringify(casterEntries), campaignName);
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

    const { promise } = createSaveListener(campaignName, {
        targetName: casterName,
        saveType: auto.saveType || 'INT',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — ${casterName} must make INT save (DC ${saveDc}) or lose the spell.`,
    }).catch((e) => { console.error("[spellThief] Error:", e); });

    const saveResult = await promise;
    const success = saveResult.success;

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    addEntry(campaignName, {
        type: 'roll',
        name: featureName,
        characterName: playerName,
        rollType: 'save-damage',
        targetName: casterName,
        saveDc,
        saveType: auto.saveType || 'INT',
        saveResult: success ? 'success' : 'failure',
        total: saveResult.total ?? 0,
        rolls: [saveResult.roll ?? 0],
        bonus: saveResult.saveBonus ?? 0,
        formula: `1d20${saveResult.saveBonus !== 0 ? '+' + saveResult.saveBonus : ''}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[spellThief] Error:", e); });

    if (!success) {
        await addBlockedSpell(playerName, casterName, spellName, campaignName);
        await addStolenSpell(playerName, casterName, spellName, campaignName);

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${casterName} failed INT save (DC ${saveDc}). Spell negated. ${playerName} steals ${spellName} for 8 hours. ${casterName} cannot cast ${spellName} for 8 hours.`,
        }).catch((e) => { console.error("[spellThief] Error:", e); });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    } else {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${casterName} succeeded on INT save (DC ${saveDc}). ${featureName} has no effect.`,
        }).catch((e) => { console.error("[spellThief] Error:", e); });
    }

    const resultDescription = success
        ? `${casterName} succeeded on INT save (DC ${saveDc}). ${featureName} has no effect.`
        : `${casterName} failed INT save (DC ${saveDc}). Spell negated. ${playerName} steals ${spellName} for 8 hours.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: resultDescription,
            automation: auto,
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
