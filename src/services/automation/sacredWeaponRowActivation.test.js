// CLA-301 regression — fingerprint-delegation lane at the service level (row-activation pair #2001).
// The production row is public/data/2024/classes.json → Paladin → Oath of Devotion lv3
// "Sacred Weapon" with automation {type:'temp_buff', effect:'sacred_weapon'} (verified on disk —
// the pairing note guessed "Cleric"; it is Paladin). A row click (CharActions.jsx
// renderFeatureActionRow:88-95 → handleAutomationAction → useCharActionsAutomation.js:448)
// dispatches through the REAL executeHandler (index.js:704): resolveHandler falls through to
// HANDLER_MAP.temp_buff (index.js:309) and buffHandler's EFFECT_DELEGATES fingerprint
// (buffHandler.js:59-72, sacred_weapon at :65, applied at handle():159-162 BEFORE any generic
// write) hands off to the dedicated sacredWeaponHandler — NOT the generic free-activation
// temp_buff path. The dedicated handler spends Channel Divinity and opens the
// 'sacredWeaponDamageType' picker (live: useCharActionsAutomation.js:316 → SacredWeaponModal,
// confirm :15 applyDamageTypeChoice; cancel: CharActionModals.SecondaryModals.jsx:745
// cancelSacredWeapon). The picker is an adjudication prompt — it waits indefinitely; no timers.
//
// ── RowActivation PAIR seam map (with inspiringSmiteRowActivation.test.js #2000) — PAIR CLOSED ──
// Shared spine (both files): verbatim-disk feature row → REAL executeHandler (index.js:704) →
// REAL handler → modal-event-or-popup assertions; mocked useRuntimeState/expirations/logService;
// campaign test-campaign. CD-spend semantics differ by RAW: inspiring smite spends at modal
// confirm; sacred weapon spends at row click and REFUNDS on picker cancel (CLA-301 refund pair).
// #2000 (inspiring smite): UNIQUE-TYPE routing lane — auto.type resolves straight through
// HANDLER_MAP, no fingerprint needed.
// This file (#2001, sacred weapon): FINGERPRINT-delegation lane — generic type 'temp_buff' +
// effect 'sacred_weapon' must beat the generic temp_buff path via buffHandler's
// effect-delegation branch; modal is the damage-type picker ('sacredWeaponDamageType'), plus
// the downstream confirm/cancel legs (applyDamageTypeChoice/cancelSacredWeapon, expirations,
// ability_use log). Row is pinned VERBATIM from disk and built through the REAL builder +
// wrapper: buildAttackInfo dispatches type 'temp_buff' to tempHandlers.temp_buff, whose
// options passthrough (automationInfoBuilder.js:50, temp.js CLA-301 comment) is what keeps
// the picker's Normal/Radiant choices alive.
// Cited, not re-pinned (non-overlap): handler internals (handle toggle-off / zero-charge /
// class_specific fallback / replace-without-duplicate) in sacredWeaponHandler.test.js; builder
// key units in automationInfoBuilder/temp.test.js; passive-marker collection in
// automationCollector.sacredWeapon.test.js (fallThrough, automationCollector.js:79); bucket
// tables in automationService.interactive.test.js + automationRouter lanes (temp_buff →
// specialActions, automationRouter.js:243); modal UI in SacredWeaponModal.test.jsx;
// attack-bonus consumption display in CharActions.sacredWeapon2024.test.jsx and
// combat/steps/features/sacredWeapon.test.js. NOTE: 'temp_buff' is NOT in
// INTERACTIVE_HANDLER_TYPES — this row's live click lane is the CharActions feature row
// (hasAutomation gate), not the CharSpecialActions isInteractiveAutomation gate.
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
    KEY: 'pendingExpirations',
}));

vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ─────────────────────────────────────────────────────

import { executeHandler } from './index.js';
import { applyDamageTypeChoice, cancelSacredWeapon } from './handlers/class-cleric-paladin/sacredWeaponHandler.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../rules/effects/expirations.js';
import { addEntry } from '../ui/logService.js';
import { buildAttackInfo } from '../combat/automation/automationInfoBuilder.js';
import { mergeAutomationSpecialActions } from '../rules/rules-helpers.js';

const campaignName = 'test-campaign';
const playerName = 'TestPaladin';

// Verbatim disk features (public/data/2024/classes.json) — no hand-authored automations.
const classes2024 = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'));

function findDiskFeature(className, featureName) {
    const cls = classes2024.find(c => c.name === className);
    let found = null;
    const walk = (node) => {
        if (found || !node) return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (typeof node !== 'object') return;
        if (node.name === featureName && node.automation) { found = node; return; }
        Object.values(node).forEach(walk);
    };
    walk(cls);
    if (!found) {
        throw new Error(`disk feature ${className}/${featureName} missing from public/data/2024/classes.json`);
    }
    return found;
}

// Sacred Weapon row exactly as production builds it: collector's buildAttackInfo
// (automationCollector.js:150) stamps the automation info (generic temp_buff builder with
// CLA-301 options passthrough), then mergeAutomationSpecialActions (rules-helpers.js:21-30)
// wraps it as { name, description, automation: info, hasAutomation }.
function makeRowEntry(playerStats) {
    const feature = findDiskFeature('Paladin', 'Sacred Weapon');
    const info = buildAttackInfo(feature, playerStats);
    const stats = { ...playerStats, automation: { passives: [], specialActions: [info] }, specialActions: [] };
    mergeAutomationSpecialActions(stats);
    return stats.specialActions[0];
}

// 2024 Paladin gets Sacred Weapon at lv3 (disk feature.level) — class_levels[2] is the real
// getMaxCharges path, not the handler's || 2 fallback.
function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 3,
        automation: { passives: [] },
        class: { class_levels: [undefined, undefined, { level: 3, channel_divinity: 3 }] },
        abilities: [{ name: 'Charisma', bonus: 5 }],
        ...overrides,
    };
}

function mockRuntime(map = {}) {
    useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === playerName && prop in map) return map[prop];
        return undefined;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Sacred Weapon row activation → fingerprint delegation (CLA-301, pair #2001)', () => {
    it('disk row through the real builder opens the damage-type picker with both disk options and spends CD 3→2 before returning', async () => {
        mockRuntime({ activeBuffs: [], channelDivinityCharges: 3 });
        const playerStats = makePlayerStats();
        const row = makeRowEntry(playerStats);

        // Builder truth (CLA-301): the generic temp_buff builder must preserve the disk
        // Normal/Radiant options or the picker has nothing to offer.
        expect(row.automation.type).toBe('temp_buff');
        expect(row.automation.effect).toBe('sacred_weapon');
        expect(row.automation.options).toEqual([
            { name: 'Normal Damage Type', damageType: 'normal' },
            { name: 'Radiant Damage', damageType: 'Radiant' },
        ]);

        const result = await executeHandler(row, playerStats, campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('sacredWeaponDamageType');
        expect(result.payload.action).toBe(row);
        expect(result.payload.campaignName).toBe(campaignName);
        expect(result.payload.action.automation.options).toHaveLength(2);
        // CD spent BEFORE the picker returns (CLA-301 refund pairs with this write)
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'channelDivinityCharges', 2, campaignName);
        // Generic temp_buff path never grants the buff un-typed while the picker is open
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(playerName, 'activeBuffs', expect.anything(), campaignName);
    });

    it('disk row click at 0 Channel Divinity refuses through the dispatcher — zero writes, no expiry, no log', async () => {
        mockRuntime({ activeBuffs: [], channelDivinityCharges: 0 });
        const playerStats = makePlayerStats();
        const row = makeRowEntry(playerStats);

        const result = await executeHandler(row, playerStats, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('fingerprint matrix: temp_buff WITHOUT the sacred_weapon effect stays on the generic toggle path (disk Reckless Attack foil)', async () => {
        // Same disk file, same type, different effect → no EFFECT_DELEGATES hit → instant
        // generic toggle. Arity note: executeHandler receives no mapName/characters — the
        // generic temp_buff lane ignores both.
        const playerStats = makePlayerStats({ level: 2, class: { class_levels: [{ level: 2 }] } });
        const feature = findDiskFeature('Barbarian', 'Reckless Attack');
        const info = buildAttackInfo(feature, playerStats);
        expect(info.type).toBe('temp_buff');
        expect(info.effect).toBe('advantage_attacks_advantage_against');
        mockRuntime({ activeBuffs: [] });

        const result = await executeHandler({ name: feature.name, description: feature.description, automation: info, hasAutomation: true }, playerStats, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Reckless Attack activated');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            playerName,
            'activeBuffs',
            [expect.objectContaining({ name: 'Reckless Attack', effect: 'advantage_attacks_advantage_against' })],
            campaignName,
        );
        // Delegation is effect-keyed: the foil touches no Channel Divinity, no picker, no clock
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(playerName, 'channelDivinityCharges', expect.anything(), campaignName);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('picker confirm writes the typed buff, registers the 100-round expiry and logs ability_use (2/3 post-spend)', async () => {
        mockRuntime({ activeBuffs: [], channelDivinityCharges: 2 });
        const playerStats = makePlayerStats();
        const row = makeRowEntry(playerStats);

        const result = await applyDamageTypeChoice(row, playerStats, campaignName, 'Radiant Damage');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Radiant');
        expect(result.payload.description).toContain('bright light in a 20-foot radius');
        expect(result.payload.description).toContain('Channel Divinity: 2/3');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            playerName,
            'activeBuffs',
            [expect.objectContaining({ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Radiant', duration: '10_minutes' })],
            campaignName,
        );
        expect(addExpiration).toHaveBeenCalledWith({ attackerName: playerName, targetName: playerName, effects: [{ type: 'remove_active_buff', buffName: 'Sacred Weapon' }], campaignName, rounds: 100 });
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({ type: 'ability_use', abilityName: 'Sacred Weapon' }));
    });

    it('picker cancel refunds the pre-spent charge against the real lv3 max and touches no buff/expiry state', async () => {
        mockRuntime({ channelDivinityCharges: 1 });
        const playerStats = makePlayerStats();

        await cancelSacredWeapon(makeRowEntry(playerStats), playerStats, campaignName);

        // max = class_levels[2].channel_divinity = 3 (real data, not the || 2 fallback)
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'channelDivinityCharges', 2, campaignName);
        // Zero-write guard on the rest of the state: cancel refunds the CD only.
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(addExpiration).not.toHaveBeenCalled();
    });
});
