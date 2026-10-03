// SP-008: Aura of Life expiry cleanup leg — when the remove_active_buff
// expiration for 'Aura of Life' fires (rounds:100 clock expiry OR the
// concentration-break seam running clearPendingExpirations), the buff, the
// aura_of_life te badge, the auraOfLifeHpMaxProtected flag and the
// turn-start heal entry must ALL be purged together — previously the te
// badge persisted after the buff purge ("badge lies").
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const logs = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
    setRuntimeObject: (name, obj) => { for (const [k, v] of Object.entries(obj)) runtimeStore[`${name}.${k}`] = v; return Promise.resolve(); },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (_campaign, entry) => { logs.push(entry); return Promise.resolve(); },
}));

import { clearExpirationEffects } from './clearExpirationEffects.js';

const CAMPAIGN = 'test-campaign';
const CLERIC = 'Divine_Cleric';
const TARGET = 'ElderPaladin';

function seedAura(target) {
    runtimeStore[`${target}.activeBuffs`] = [
        { name: 'Aura of Life', effect: 'aura_of_life', duration: 'Concentration, up to 10 minutes', sourceCharacter: CLERIC, resistanceTypes: ['Necrotic'] },
        { name: 'Bless', effect: 'bless', sourceCharacter: CLERIC },
    ];
    runtimeStore[`${target}.auraOfLifeHpMaxProtected`] = true;
    runtimeStore[`${target}.turnStartEffects`] = [
        { type: 'aura_of_life_turn_start_heal', name: 'Aura of Life' },
        { type: 'heroism_temp_hp', name: 'Heroism' },
    ];
}

const AURA_EXPIRATION_EFFECTS = [
    { type: 'remove_active_buff', buffName: 'Aura of Life' },
    { type: 'aura_of_life_hp_protection_end' },
];

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    logs.length = 0;
});

describe('SP-008 Aura of Life expiry cleanup leg', () => {
    it('buff expiry strips buff, te badge, HP-max flag and turn-start heal together', () => {
        seedAura(TARGET);
        runtimeStore['campaign.targetEffects'] = [
            { target: TARGET, effect: 'aura_of_life', source: CLERIC, duration: 'concentration' },
            { target: 'OtherAlly', effect: 'aura_of_life', source: CLERIC, duration: 'concentration' },
        ];

        clearExpirationEffects(AURA_EXPIRATION_EFFECTS, TARGET, CLERIC, CAMPAIGN);

        const buffs = runtimeStore[`${TARGET}.activeBuffs`] || [];
        expect(buffs.find(b => b.name === 'Aura of Life')).toBeFalsy();
        expect(buffs.find(b => b.name === 'Bless')).toBeTruthy();
        expect(runtimeStore[`${TARGET}.auraOfLifeHpMaxProtected`]).toBe(false);
        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes.find(te => te.target === TARGET && te.effect === 'aura_of_life')).toBeFalsy();
        expect(tes.find(te => te.target === 'OtherAlly')).toBeTruthy();
        const tse = runtimeStore[`${TARGET}.turnStartEffects`] || [];
        expect(tse.find(e => e.type === 'aura_of_life_turn_start_heal')).toBeFalsy();
        expect(tse.find(e => e.type === 'heroism_temp_hp')).toBeTruthy();
    });

    it('te from a DIFFERENT source on the same target is collateral-safe', () => {
        seedAura(TARGET);
        runtimeStore['campaign.targetEffects'] = [
            { target: TARGET, effect: 'aura_of_life', source: 'OtherCaster', duration: 'concentration' },
        ];

        clearExpirationEffects(AURA_EXPIRATION_EFFECTS, TARGET, CLERIC, CAMPAIGN);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
    });

    it('remove_aura_of_life_buff legacy type purges the same set', () => {
        seedAura(TARGET);
        runtimeStore['campaign.targetEffects'] = [
            { target: TARGET, effect: 'aura_of_life', source: CLERIC, duration: 'concentration' },
        ];

        clearExpirationEffects([{ type: 'remove_aura_of_life_buff', buffName: 'Aura of Life' }], TARGET, CLERIC, CAMPAIGN);

        expect((runtimeStore[`${TARGET}.activeBuffs`] || []).find(b => b.name === 'Aura of Life')).toBeFalsy();
        expect(runtimeStore[`${TARGET}.auraOfLifeHpMaxProtected`]).toBe(false);
        expect((runtimeStore['campaign.targetEffects'] || []).find(te => te.effect === 'aura_of_life')).toBeFalsy();
        expect((runtimeStore[`${TARGET}.turnStartEffects`] || []).find(e => e.type === 'aura_of_life_turn_start_heal')).toBeFalsy();
    });

    it('no aura state present → cleanup never throws', () => {
        expect(() => clearExpirationEffects(AURA_EXPIRATION_EFFECTS, TARGET, CLERIC, CAMPAIGN)).not.toThrow();
    });
});
