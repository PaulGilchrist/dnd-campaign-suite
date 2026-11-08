import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getAbilityModifier } from '../../shared/abilityLookup.js';
import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

// Bucket write with drain-to-evict (backlog 2026-11-03 CJ: after a full sweep
// the two aggregate save-prompt keys persisted in change-data as
// `pendingSavePrompts:{}` / `pendingSaveListenerPrompts:[]` — honest rows
// until Admin Clear, but cosmetic dust that the concentration lane never
// leaves: there, the last answered prompt DELETEs its key outright). Every
// lane that can EMPTY one of these buckets writes through here: the last row
// evicts the key entirely (deleteRuntimeKey → server DELETE + null echo →
// applyStoreUpdate removes it on every mounted tab) instead of POSTing
// `{}` / `[]`. Buckets that still hold rows keep the exact broadcast-POST
// behaviour (per-promptId object / id array, 38382ce16).
const SAVE_PROMPT_BUCKETS = new Set(['pendingSavePrompts', 'pendingSaveListenerPrompts']);

export function setSavePromptBucket(campaignName, key, nextValue) {
    if (!SAVE_PROMPT_BUCKETS.has(key)) {
        console.error('[savePrompt] setSavePromptBucket called with a non-bucket key', { key });
        return;
    }
    const isEmpty = Array.isArray(nextValue)
        ? nextValue.length === 0
        : !nextValue || Object.keys(nextValue).length === 0;
    if (isEmpty) {
        deleteRuntimeKey('campaign', key, campaignName);
        return;
    }
    setRuntimeValue('campaign', key, nextValue, campaignName);
}

export function buildSaveDc(auto, playerStats) {
    if (!playerStats) {
        console.error('[buildSaveDc] playerStats is null/undefined');
        return 10;
    }
    if (auto.saveDc === 'ability') {
        let ability = auto.saveAbility || 'CON';
        if (Array.isArray(ability)) ability = ability[0];
        const abilityBonus = getAbilityModifier(playerStats.abilities, ability);
        const prof = playerStats.proficiency || 0;
        return 8 + abilityBonus + prof;
     }
    if (auto.saveDc === 'spell_save_dc') {
        if (playerStats.spellAbilities?.saveDc != null) {
            return playerStats.spellAbilities.saveDc;
        }
        const prof = playerStats.proficiency || 0;
        const spellMod = playerStats.spellAbilities?.modifier ?? getAbilityModifier(playerStats.abilities, 'CHA');
        return 8 + spellMod + prof;
    }
    if (typeof auto.saveDc === 'number') return auto.saveDc;
    console.error(`[buildSaveDc] Spell "${auto.type || 'unknown'}" has no saveDc defined. Expected 'spell_save_dc', 'ability', or a number.`);
    return 10;
 }

function buildPromptPayload(config) {
    return {
        targetName: config.targetName,
        attackerName: config.attackerName || null,
        saveType: config.saveType || 'CON',
        saveDc: config.saveDc,
        dcSuccess: config.dcSuccess,
        advantage: config.advantage || false,
        disadvantage: config.disadvantage || false,
        condition: config.condition || null,
        // CLA-034: the condition(s) this save is rolled against (e.g. ['frightened']
        // from a Fear Ray) — threaded so conditional_advantage passives can key on
        // the SAVE's own condition instead of unrelated active conditions.
        saveConditions: config.saveConditions || null,
        damageFormula: config.damageFormula || null,
        damageType: config.damageType || null,
        rawDamage: config.rawDamage || 0,
        sourceName: config.sourceName || null,
        secondaryFormula: config.secondaryFormula || null,
        secondaryDamageType: config.secondaryDamageType || null,
        secondaryRawDamage: config.secondaryRawDamage || 0,
        isSpellDamage: config.isSpellDamage === true,
    };
}

function resolveSaveOutcome(promptData, detail) {
    const pd = promptData || {};
    return {
        attackerName: pd.attackerName || detail.attackerName || 'Unknown',
        targetName: pd.targetName || detail.targetName || 'Unknown',
        saveType: pd.saveType || detail.saveType || 'CON',
        saveDc: pd.saveDc || detail.saveDc || 0,
        success: detail.success,
        roll: detail.roll ?? 0,
        saveBonus: detail.saveBonus ?? 0,
        total: detail.total ?? 0,
        advantage: pd.advantage,
        disadvantage: pd.disadvantage,
        dcSuccess: pd.dcSuccess,
        sourceName: pd.sourceName,
        condition: pd.condition,
        damageFormula: pd.damageFormula,
        damageType: pd.damageType,
        rawDamage: pd.rawDamage,
    };
}

function logSaveOutcome(campaignName, config, detail) {
    const fields = resolveSaveOutcome(config, detail);
    const rollDetail = describeSaveRoll({ roll: fields.roll, saveBonus: fields.saveBonus, total: fields.total, advantage: fields.advantage, disadvantage: fields.disadvantage, success: fields.success, dcSuccess: fields.dcSuccess });

    const description = `${fields.targetName} ${fields.success ? 'succeeded' : 'failed'} ${fields.saveType} save (DC ${fields.saveDc}, ${rollDetail})`;

    const entry = buildSaveResultEntry({
        characterName: fields.attackerName,
        targetName: fields.targetName,
        saveDc: fields.saveDc,
        saveType: fields.saveType,
        success: fields.success,
        roll: fields.roll,
        total: fields.total,
        saveBonus: fields.saveBonus,
        description,
        sourceName: fields.sourceName,
        condition: fields.condition,
        damageFormula: fields.damageFormula,
        damageType: fields.damageType,
        rawDamage: fields.rawDamage,
    });

    return addEntry(campaignName, entry).catch((e) => { console.error('[savePrompt] Error logging save result:', e); });
}

export function createSaveListener(campaignName, config) {
    const promptId = utils.guid();

    const payload = buildPromptPayload(config);

    const pendingSaves = getRuntimeValue('campaign', 'pendingSavePrompts') || {};
    pendingSaves[promptId] = { promptId, campaignName, ...payload };
    setRuntimeValue('campaign', 'pendingSavePrompts', pendingSaves, campaignName);

    const listenerPrompts = getRuntimeValue('campaign', 'pendingSaveListenerPrompts', campaignName) || []; // fix#339 (#1520-family): read/write symmetric channel vocabulary per fix#153/#198 — reader is arity-2 (useRuntimeState.js:63), scope = SSE-mirrored active-campaign store until #1520
    listenerPrompts.push(promptId);
    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', listenerPrompts, campaignName);

    sendSavePrompt(campaignName, { promptId, ...payload });

    const promise = new Promise((resolve) => {
        const handler = (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('save-result', handler);
            window.removeEventListener('save-dismissed', onDismissed);
            // Spread before deleting (playbook §41): in-place mutation of the
            // stored reference made setRuntimeValue's valuesEqual(new===old)
            // skip the broadcast POST, leaving a stale row server-side.
            const saves = { ...(getRuntimeValue('campaign', 'pendingSavePrompts') || {}) };
            delete saves[promptId];
            setSavePromptBucket(campaignName, 'pendingSavePrompts', saves);
            resolve(event.detail);
         };
        window.addEventListener('save-result', handler);
        // Dismiss detaches the save-result listener WITHOUT resolving the
        // promise (dismiss-softlock family, 2026-11-05): before this, every
        // dismissed prompt leaked `handler` on window forever, and a stray
        // late echo for the swept promptId could resurrect a phantom
        // resolution. Fire-and-forget `.promise` consumers keep the original
        // never-resolves doctrine untouched.
        const onDismissed = (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('save-dismissed', onDismissed);
            window.removeEventListener('save-result', handler);
        };
        window.addEventListener('save-dismissed', onDismissed);
     });

    const saveResultPromise = promise.then(async (detail) => {
        // Lanes that stamp their OWN attributed save_result row (the turn-END
        // repeat-save family) opt out of the generic row here — one roll, one
        // save_result row (bug-save-result-rows-attribute-character-unknown:
        // the generic row + the lane's provenance row used to double-stamp).
        // Default undefined = every other lane's single-row behavior unchanged.
        if (config.suppressOutcomeLog !== true) {
            await logSaveOutcome(campaignName, config, detail);
        }
        return detail;
    });

    saveResultPromise.finally(() => {
        const saves = { ...(getRuntimeValue('campaign', 'pendingSavePrompts') || {}) };
        delete saves[promptId];
        setSavePromptBucket(campaignName, 'pendingSavePrompts', saves);
    });

    return { promptId, promise: saveResultPromise };
}

// Dismiss hygiene (backlog 2026-11-03 save-prompt-queue-dismiss-orphan):
// createSaveListener registers the promptId in the campaign pendingSavePrompts
// bucket (and pendingSaveListenerPrompts). Those rows are only pruned by the
// save-result resolution path — a DISMISSED save never resolves its `.promise`
// (the queue's un-rolled Dismiss broadcasts a separate `save-dismissed` event
// instead, 2026-11-05, which only detaches listeners and lets modal
// producers opt into a refusal outcome — resolving with a falsy success
// would read as "save failed → damage" to the fire-and-forget consumers),
// so nothing else swept them and every ghost prompt leaked an orphan row
// the Admin clear had to keep absorbing. Dismiss drops the prompt from both
// buckets itself — surviving rows write through the broadcast-POST, the FINAL
// row evicts its bucket key outright (drain-to-evict, setSavePromptBucket) — so
// peers and server truth match the drained UI and no `{}` / `[]` dust
// outlives the queue. Idempotent: absent ids write nothing (no pointless
// POST/DELETE churn).
export function dropPendingSavePrompt(campaignName, promptId) {
    if (!promptId) return;
    const saves = getRuntimeValue('campaign', 'pendingSavePrompts') || {}; // fix#339 (#1520-family): read/write symmetric channel vocabulary per fix#153/#198
    if (Object.prototype.hasOwnProperty.call(saves, promptId)) {
        const nextSaves = { ...saves };
        delete nextSaves[promptId];
        setSavePromptBucket(campaignName, 'pendingSavePrompts', nextSaves);
    }
    const listenerIds = getRuntimeValue('campaign', 'pendingSaveListenerPrompts', campaignName) || []; // fix#339 sibling read
    if (Array.isArray(listenerIds) && listenerIds.includes(promptId)) {
        setSavePromptBucket(campaignName, 'pendingSaveListenerPrompts', listenerIds.filter(id => id !== promptId));
    }
}

// Dismiss-hygiene log row (save-dismissed sweep family, 2026-11-05): every
// modal-parking producer that opts into `save-dismissed` must leave an honest
// campaign-log trace when the GM abandons an un-rolled prompt — same row
// vocabulary as saveOnlyHandler/CharReactions (`automation` +
// automationDetail 'save_dismissed', zero fabricated roll rows). Sites with
// their own refusal helper (DivineSparkModal's refuse(), saveOnlyRefusal)
// keep logging through it; this is the shared home for the sites that have
// none.
export function logSaveDismissed(campaignName, { casterName, abilityName, targetName, saveDc, saveType, logPrefix }) {
    return addEntry(campaignName, {
        type: 'automation',
        automationType: 'save_dismissed',
        automationDetail: 'save_dismissed',
        characterName: casterName,
        abilityName,
        targetName,
        saveDc,
        saveType,
        reason: 'save was dismissed — no effect',
        description: `${targetName}'s ${saveType} save (DC ${saveDc}) against ${abilityName} was dismissed before rolling — no effect.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error(`${logPrefix || '[savePrompt]'} Error logging dismissed save:`, e); });
}

function describeSaveRoll({ roll, saveBonus, total, advantage, disadvantage, success, dcSuccess }) {
    let rollDetail = `rolled ${roll}${saveBonus !== 0 ? ' +' + saveBonus : ''} = ${total}`;
    if (advantage && disadvantage) {
        rollDetail += ' (advantage & disadvantage cancel)';
    } else if (advantage) {
        rollDetail += ' (advantage)';
    } else if (disadvantage) {
        rollDetail += ' (disadvantage)';
    }
    if (success && dcSuccess !== undefined && dcSuccess !== null) {
        const successLabel = dcSuccess === 0 ? 'none' : (dcSuccess === 0.5 ? 'half' : 'full');
        rollDetail += ` — ${successLabel} success`;
    }
    return rollDetail;
}

function buildSaveResultEntry({ characterName, targetName, saveDc, saveType, success, roll, total, saveBonus, description, sourceName, condition, damageFormula, damageType, rawDamage }) {
    const entry = {
        type: 'save_result',
        characterName,
        targetName,
        saveDc,
        saveType,
        success,
        roll,
        total,
        saveBonus,
        description,
    };

    if (sourceName && sourceName !== characterName) {
        entry.sourceName = sourceName;
    }
    if (condition) {
        entry.condition = condition;
    }
    if (damageFormula) {
        entry.damageFormula = damageFormula;
    }
    if (damageType) {
        entry.damageType = damageType;
    }
    if (rawDamage) {
        entry.rawDamage = rawDamage;
    }

    return entry;
}
