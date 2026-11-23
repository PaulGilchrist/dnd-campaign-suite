/**
 * Enforcement preset definitions (deferred plan A — "Level 5, one decision
 * at a time").
 *
 * Data, not code: tuning what a preset flips or says never touches the
 * component. The presets are a WRITE-SIDE convenience only — clicking one
 * writes the SAME `enforcement` change-data key through the section's
 * existing debounced lane. Nothing here is ever stored: the active preset is
 * DERIVED by matching the current flag blob against these definitions
 * (`matchPreset`), so any checkbox move after a preset click drops the match
 * and the UI reads Custom, with no extra bookkeeping.
 *
 * The master switch (`mode`) is deliberately absent from every flag map —
 * the section always writes `mode:'on'` alongside a preset (clicking a preset
 * arms enforcement; master-off stays the one-click hard stop).
 */
import { ENFORCEMENT_DEFAULTS } from '../services/combat/canTakeAction.js';

// The 10 sub-flags, in the canonical ENFORCEMENT_DEFAULTS order (mode
// excluded). Exported so the section's copy and tests read one list.
export const ENFORCEMENT_SUB_FLAGS = Object.keys(ENFORCEMENT_DEFAULTS).filter(k => k !== 'mode');

const flags = (on) => Object.fromEntries(ENFORCEMENT_SUB_FLAGS.map(k => [k, on.includes(k)]));

export const ENFORCEMENT_PRESETS = [
    {
        id: 'gentle',
        label: 'Gentle',
        title: 'The table keeps its own bookkeeping — the app assists, never polices the fiction.',
        flagMap: flags(['turnLock', 'actionEconomy', 'movementBudget']),
    },
    {
        id: 'standard',
        label: 'Standard',
        title: 'Everything the referee can check mechanically — except server-side dice.',
        flagMap: flags(ENFORCEMENT_SUB_FLAGS.filter(k => k !== 'serverDice')),
    },
    {
        id: 'strict',
        label: 'Strict',
        title: 'Every switch on, including the server dice oracle — nothing runs on client trust.',
        flagMap: flags(ENFORCEMENT_SUB_FLAGS),
    },
];

export const CUSTOM_PRESET = { id: 'custom', label: 'Custom' };

/** True when `flags` equals a preset's flag map exactly (booleans, all keys). */
function matchesFlagMap(flags, flagMap) {
    return ENFORCEMENT_SUB_FLAGS.every(k => !!flags[k] === flagMap[k]);
}

/**
 * Which preset the given (already defaults-merged) flag blob matches.
 * @returns {{ id: string, label: string }} — the preset, or CUSTOM_PRESET
 *          when no definition matches (a checkbox moved, or nothing was ever
 *          pressed — all-off is Custom, not a preset).
 */
export function matchPreset(flags) {
    const hit = ENFORCEMENT_PRESETS.find(p => matchesFlagMap(flags, p.flagMap));
    return hit || CUSTOM_PRESET;
}

/**
 * The live consequence sentence, derived from the current flags — never
 * stored. Short plain-English verbs, seeded from the users-guide §8 table.
 * The section renders it even under a disarmed master (harmless preview;
 * gate semantics are the master switch's own hint line).
 */
const WILL_COPY = {
    turnLock: 'refuse off-turn actions',
    actionEconomy: 'charge one Action + Bonus Action + Reaction per turn',
    movementBudget: 'clamp token drags to remaining speed',
    tokenMoving: 'move tokens on teleport automations',
    autoEncounters: 'start initiative when a travel event is accepted',
    autoRewards: 'award loot and XP automatically on clear',
    zones: 'run zone and lair effects each round',
    lineOfSight: 'deny attacks without line of sight',
    opportunityAttacks: 'spend reactions on leaving reach',
    serverDice: 'roll AI dice server-side',
};

export function describeConsequences(flags) {
    const on = ENFORCEMENT_SUB_FLAGS.filter(k => !!flags[k]);
    const off = ENFORCEMENT_SUB_FLAGS.filter(k => !flags[k]);
    return {
        will: on.map(k => WILL_COPY[k]),
        willNot: off.map(k => WILL_COPY[k]),
    };
}
