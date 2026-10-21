// @maintained-by-ai
// SP-008: Aura of Life expiry cleanup leg — when the remove_active_buff
// expiration for 'Aura of Life' fires (rounds:100 clock expiry OR the
// concentration-break seam running clearPendingExpirations), the buff, the
// aura_of_life te badge, the auraOfLifeHpMaxProtected flag and the
// turn-start heal entry must ALL be purged together — previously the te
// badge persisted after the buff purge ("badge lies").
//
// Aura-family lane map: damage/service internals live in
// auraDamageService.test.js (#1284) and applyAuraDamage consumer shapes in
// applyAuraDamage.test.js (#1282) — this file owns EXPIRATION CLEAR only.
// #1287 folded its remove_aura_of_life_buff + aura_of_life_hp_protection_end
// expiry tests in here (stronger merged-write pin); handler is called
// DIRECTLY so unconditional wrapper writes cannot mask broken dispatch.
// logService is mocked inert: the Aura of Life expiry handlers emit no
// addEntry (the apply-side logs in auraOfLifeHandler) — mock isolates the
// import graph only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
    setRuntimeObject: (name, obj) => { for (const [k, v] of Object.entries(obj)) runtimeStore[`${name}.${k}`] = v; return Promise.resolve(); },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: () => Promise.resolve(),
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

// Exact production payload registered by auraOfLifeHandler (rounds clock +
// concentration-break seam both flush this pair through clearPendingExpirations).
const AURA_EXPIRATION_EFFECTS = [
    { type: 'remove_active_buff', buffName: 'Aura of Life' },
    { type: 'aura_of_life_hp_protection_end' },
];

beforeEach(() => {
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
});

describe('SP-008 Aura of Life expiry cleanup leg', () => {
    it('buff expiry strips buff, te badge, HP-max flag and turn-start heal together', () => {
        seedAura(TARGET);
        runtimeStore['campaign.targetEffects'] = [
            { target: TARGET, effect: 'aura_of_life', source: CLERIC, duration: 'concentration' },
            { target: 'OtherAlly', effect: 'aura_of_life', source: CLERIC, duration: 'concentration' },
        ];

        clearExpirationEffects(AURA_EXPIRATION_EFFECTS, TARGET, CLERIC, CAMPAIGN);

        // Only the expired aura is purged from each list — co-existing
        // Bless / Heroism buffs, another target's te badge survive intact.
        expect(runtimeStore[`${TARGET}.activeBuffs`]).toEqual([
            { name: 'Bless', effect: 'bless', sourceCharacter: CLERIC },
        ]);
        expect(runtimeStore[`${TARGET}.auraOfLifeHpMaxProtected`]).toBe(false);
        expect(runtimeStore['campaign.targetEffects']).toEqual([
            { target: 'OtherAlly', effect: 'aura_of_life', source: CLERIC, duration: 'concentration' },
        ]);
        expect(runtimeStore[`${TARGET}.turnStartEffects`]).toEqual([
            { type: 'heroism_temp_hp', name: 'Heroism' },
        ]);
    });

    it('te from a DIFFERENT source on the same target is collateral-safe', () => {
        seedAura(TARGET);
        runtimeStore['campaign.targetEffects'] = [
            { target: TARGET, effect: 'aura_of_life', source: 'OtherCaster', duration: 'concentration' },
        ];

        clearExpirationEffects(AURA_EXPIRATION_EFFECTS, TARGET, CLERIC, CAMPAIGN);

        // te purge is triple-scoped (effect+target+source): OtherCaster's
        // badge stands. The buff-list purge is name-scoped (single aura
        // entry per target model), so the buff itself still goes.
        expect(runtimeStore['campaign.targetEffects']).toEqual([
            { target: TARGET, effect: 'aura_of_life', source: 'OtherCaster', duration: 'concentration' },
        ]);
        expect(runtimeStore[`${TARGET}.activeBuffs`]).toEqual([
            { name: 'Bless', effect: 'bless', sourceCharacter: CLERIC },
        ]);
    });

    it('remove_aura_of_life_buff legacy type purges the same set', () => {
        seedAura(TARGET);
        runtimeStore['campaign.targetEffects'] = [
            { target: TARGET, effect: 'aura_of_life', source: CLERIC, duration: 'concentration' },
        ];

        // No second aura_of_life_hp_protection_end leg here: this is the
        // ONLY pin that the cleanup itself (not the pair's flag leg) drops
        // the HP-max protection flag.
        clearExpirationEffects([{ type: 'remove_aura_of_life_buff', buffName: 'Aura of Life' }], TARGET, CLERIC, CAMPAIGN);

        expect(runtimeStore[`${TARGET}.activeBuffs`]).toEqual([
            { name: 'Bless', effect: 'bless', sourceCharacter: CLERIC },
        ]);
        expect(runtimeStore[`${TARGET}.auraOfLifeHpMaxProtected`]).toBe(false);
        expect(runtimeStore['campaign.targetEffects']).toEqual([]);
        expect(runtimeStore[`${TARGET}.turnStartEffects`]).toEqual([
            { type: 'heroism_temp_hp', name: 'Heroism' },
        ]);
    });

    it('empty runtime baseline → no-op: never throws, no spurious campaign write', () => {
        expect(() => clearExpirationEffects(AURA_EXPIRATION_EFFECTS, TARGET, CLERIC, CAMPAIGN)).not.toThrow();
        // removeTargetEffectsIfChanged write-gate: unchanged length means
        // the campaign store is never overwritten (no needless SSE broadcast).
        expect(runtimeStore['campaign.targetEffects']).toBeUndefined();
        // Per-target guard reads resolve to clean empty arrays downstream.
        expect(runtimeStore[`${TARGET}.activeBuffs`]).toEqual([]);
        expect(runtimeStore[`${TARGET}.turnStartEffects`]).toEqual([]);
        expect(runtimeStore[`${TARGET}.auraOfLifeHpMaxProtected`]).toBe(false);
    });
});
