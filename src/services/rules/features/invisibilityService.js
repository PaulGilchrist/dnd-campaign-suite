import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';
import { addEntry } from '../../ui/logService.js';

const INVISIBILITY_BUFF_NAME = 'Invisibility';
const GREATER_INVISIBILITY_BUFF_NAME = 'GreaterInvisibility';

/**
 * Remove Invisibility buff and invisible condition from a target.
 * Used by invisibilityHandler, invisibilityService, and restRules.
 */
export function endInvisibility(targetName, campaignName, reason) {
    const key = `_activeInvisibility_${targetName}`;
    const casterName = getRuntimeValue('campaign', key, campaignName);
    if (!casterName) return;

    const activeBuffs = getActiveBuffs(targetName, campaignName);
    const filtered = activeBuffs.filter(b => b.name !== INVISIBILITY_BUFF_NAME);

    // fix#349 #1382 commit-ordering: conditions-validate moved BEFORE the first
    // store write (validate-first idiom, sibling wardingBondService.js:36-43 —
    // fix#1427(c)/fix#5 refuse-shape: validation gates precede every write,
    // "ZERO write/log/state on BOTH legs — no half-baked state"; also
    // massHealingWordService.js:143-152 which nulls before any heal write).
    // Pre-fix the throw below landed AFTER the :20 activeBuffs commit, so an
    // abort left the buff stripped while the `_activeInvisibility_` latch stayed
    // armed — a partial-removal state (buff gone, invisible condition and latch
    // left behind) that callers without a retry path never reconcile. Post-fix
    // an abort mutates NOTHING: latch armed ⟺ inputs intact, so the retry (or
    // the GM repairing the store) composes the FULL removal budget atomically.
    const conditions = (() => {
        const x = getRuntimeValue(targetName, 'activeConditions', campaignName);
        if (x == null) { console.error('[invisibilityService] Missing array:', x); throw new Error('Expected array, got ' + x); }
        return x;
    })();
    const condFiltered = conditions.filter(c => String(c).toLowerCase() !== 'invisible');

    if (filtered.length !== activeBuffs.length) {
        setRuntimeValue(targetName, 'activeBuffs', filtered, campaignName);
    }
    if (condFiltered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', condFiltered, campaignName);
    }

    setRuntimeValue('campaign', key, null, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: 'Invisibility',
        description: `Invisibility ends for ${targetName}: ${reason}.`,
    }).catch((e) => { console.error("[invisibilityService:log-error]", e); });
}

/**
 * End Invisibility early for the invisible creature if they take a hostile action
 * (make an attack roll, deal damage, or cast a spell).
 * Called from the relevant hooks/services when such actions occur.
 */
export function endInvisibilityOnHostileAction(invisibleName, campaignName) {
    endInvisibility(invisibleName, campaignName, 'target made a hostile action (attack roll, dealt damage, or cast a spell)');
}

/**
 * Remove GreaterInvisibility buff and invisible condition from a target.
 */
export function endGreaterInvisibility(targetName, campaignName, reason) {
    const key = `_activeGreaterInvisibility_${targetName}`;
    const casterName = getRuntimeValue('campaign', key, campaignName);
    if (!casterName) return;

    const activeBuffs = getActiveBuffs(targetName, campaignName);
    const filtered = activeBuffs.filter(b => b.name !== GREATER_INVISIBILITY_BUFF_NAME);

    // fix#349 validate-first — same ordering law as endInvisibility above:
    // the throw must precede every store write, never follow a committed
    // buff-strip with the latch still armed.
    const conditions = (() => {
        const x = getRuntimeValue(targetName, 'activeConditions', campaignName);
        if (x == null) { console.error('[invisibilityService] Missing array:', x); throw new Error('Expected array, got ' + x); }
        return x;
    })();
    const condFiltered = conditions.filter(c => String(c).toLowerCase() !== 'invisible');

    if (filtered.length !== activeBuffs.length) {
        setRuntimeValue(targetName, 'activeBuffs', filtered, campaignName);
    }
    if (condFiltered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', condFiltered, campaignName);
    }

    setRuntimeValue('campaign', key, null, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: 'Greater Invisibility',
        description: `Greater Invisibility ends for ${targetName}: ${reason}.`,
    }).catch((e) => { console.error("[invisibilityService:log-error]", e); });
}

// #1382 dead-export delete: endGreaterInvisibilityOnHostileAction removed —
// ZERO callers repo-wide AND anti-RAW: Greater Invisibility (concentration,
// up to 1 minute) does NOT end on a hostile action — only Invisibility does
// (endInvisibilityOnHostileAction above serves that rule). The LIVE greater
// removal lane is endGreaterInvisibility called DIRECT with its own reasons:
// rests (restRules-shortRest.js:420, restRules-longRest.js) and initiative
// rolls (useInitiativeEffects.js). Wiring the forwarder in would wrongly break
// the buff on attack — reported-gap verdict: NO unmet live need, already
// correct elsewhere (#1184 keep-vs-stub law: delete, not queue).
