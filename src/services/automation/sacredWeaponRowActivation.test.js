// CLA-301 regression — row-activation routing at the service level.
// A clickable "Sacred Weapon:" row (automation type 'temp_buff', effect
// 'sacred_weapon') dispatched through the REAL executeHandler dispatcher must
// reach the dedicated sacredWeaponHandler via buffHandler's effect-delegation
// branch (vow_of_enmity precedent) — NOT the generic free-activation temp_buff
// path. The dedicated handler spends Channel Divinity, opens the
// 'sacredWeaponDamageType' picker (options preserved by the temp_buff info
// builder), registers a 100-round expiration and logs ability_use.
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

const campaignName = 'test-campaign';
const playerName = 'TestPaladin';

// Row entry shape produced by tempHandlers.temp_buff (info builder) and
// wrapped by mergeAutomationSpecialActions — the builder output IS the row
// automation. CLA-301: the builder must preserve options for the picker.
function makeRowEntry() {
    return {
        name: 'Sacred Weapon',
        description: 'Expend one use of Channel Divinity…',
        hasAutomation: true,
        automation: {
            type: 'temp_buff',
            name: 'Sacred Weapon',
            effect: 'sacred_weapon',
            duration: '10_minutes',
            action: 'action',
            recharge: 'long_rest',
            casting_time: '1 action',
            resourceCost: 'channel_divinity',
            options: [
                { name: 'Normal Damage Type', damageType: 'normal' },
                { name: 'Radiant Damage', damageType: 'Radiant' },
            ],
            hasAutomation: true,
        },
    };
}

function makePlayerStats() {
    return {
        name: playerName,
        level: 20,
        automation: { passives: [] },
        class: { class_levels: [{ level: 20, channel_divinity: 3 }] },
        abilities: [{ name: 'Charisma', bonus: 5 }],
    };
}

function mockCharges(charges) {
    useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === playerName && prop === 'activeBuffs') return [];
        if (key === playerName && prop === 'channelDivinityCharges') return charges;
        return undefined;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Sacred Weapon row activation → dedicated handler routing (CLA-301)', () => {
    it('row click reaches the dedicated handler: spends CD and opens the damage-type picker', async () => {
        mockCharges(3);

        const result = await executeHandler(makeRowEntry(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('sacredWeaponDamageType');
        expect(result.payload.action.automation.options).toHaveLength(2);
        expect(result.payload.campaignName).toBe(campaignName);
        // CD spent BEFORE the picker returns (3 → 2)
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'channelDivinityCharges', 2, campaignName);
        // Generic temp_buff path never grants the buff un-typed
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(playerName, 'activeBuffs', expect.anything(), campaignName);
    });

    it('row click at 0 Channel Divinity refuses with a popup — no CD write, no buff, no modal', async () => {
        mockCharges(0);

        const result = await executeHandler(makeRowEntry(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('picker confirm persists damageTypeChoice, registers the 100-round expiry and logs ability_use', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === playerName && prop === 'activeBuffs') return [];
            if (key === playerName && prop === 'channelDivinityCharges') return 2;
            return undefined;
        });

        const result = await applyDamageTypeChoice(makeRowEntry(), makePlayerStats(), campaignName, 'Radiant Damage');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Radiant');
        expect(result.payload.description).toContain('bright light in a 20-foot radius');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            playerName,
            'activeBuffs',
            [expect.objectContaining({ effect: 'sacred_weapon', damageTypeChoice: 'Radiant', duration: '10_minutes' })],
            campaignName,
        );
        expect(addExpiration).toHaveBeenCalledWith({ attackerName: playerName, targetName: playerName, effects: [{ type: 'remove_active_buff', buffName: 'Sacred Weapon' }], campaignName, rounds: 100 });
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({ type: 'ability_use', abilityName: 'Sacred Weapon' }));
    });

    it('picker cancel refunds the pre-spent Channel Divinity charge', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === playerName && prop === 'channelDivinityCharges') return 1;
            return undefined;
        });

        await cancelSacredWeapon(makeRowEntry(), makePlayerStats({ class: { class_levels: { 2: { channel_divinity: 3 } } } }), campaignName);

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'channelDivinityCharges', 2, campaignName);
    });

    it('generic temp_buff features are unaffected by the sacred_weapon delegation', async () => {
        const ps = makePlayerStats();
        const action = {
            name: 'Bear Strength',
            hasAutomation: true,
            automation: {
                type: 'temp_buff',
                name: 'Bear Strength',
                effect: 'temp_hp_buff_generic_test',
                duration: '1_minute',
                casting_time: '1 bonus action',
                hasAutomation: true,
            },
        };
        useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === playerName && prop === 'activeBuffs') return [];
            return undefined;
        });

        const result = await executeHandler(action, ps, campaignName, null);

        // Generic handleBuff path: instant toggle popup, no CD spend, no picker modal
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Bear Strength activated');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Bear Strength' })]), campaignName);
    });
});
