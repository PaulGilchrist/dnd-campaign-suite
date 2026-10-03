// SP-008: Aura of Life RAW — "your Hit Point maximums can't be reduced"
// while in the aura. The shared hp-max-drain core (MA-1489 attack lane +
// MA-1547 save lane) must refuse honestly while the target's
// auraOfLifeHpMaxProtected flag is set, logging hp_max_reduce_blocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const logs = [];
const registered = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: (_campaign, target, effect, source, extra) => { registered.push({ target, effect, source, extra }); },
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

import { applyHpMaxReduce } from './hpMaxReduceService.js';

const CAMPAIGN = 'test-campaign';
const TARGET = { name: 'ElderPaladin', type: 'player' };
const SPECTER = { name: 'Specter 1', type: 'monster' };

function call(damage) {
    return applyHpMaxReduce({
        attackName: 'Life Drain',
        target: TARGET,
        damage,
        combatSummary: { creatures: [] },
        characters: [],
        campaignName: CAMPAIGN,
        attackerName: SPECTER.name,
        logEntry: (entry) => logs.push(entry),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    logs.length = 0;
    registered.length = 0;
    runtimeStore['ElderPaladin.hitPoints'] = 40;
    runtimeStore['ElderPaladin.currentHitPoints'] = 30;
});

describe('SP-008 Aura of Life blocks HP max reduction', () => {
    it('drain is refused while auraOfLifeHpMaxProtected is set — max untouched, honest block log', async () => {
        runtimeStore['ElderPaladin.auraOfLifeHpMaxProtected'] = true;

        const result = await call(10);

        expect(result).toBeNull();
        expect(runtimeStore['ElderPaladin.hitPoints']).toBe(40);
        expect(runtimeStore['ElderPaladin.hpMaxReduction']).toBeUndefined();
        expect(registered).toHaveLength(0);
        const blocked = logs.find(l => l.automationType === 'hp_max_reduce_blocked');
        expect(blocked).toBeTruthy();
        expect(blocked.characterName).toBe('ElderPaladin');
        expect(blocked.description).toMatch(/Aura of Life/);
    });

    it('drain proceeds normally when the flag is false (byte-identical legacy lane)', async () => {
        runtimeStore['ElderPaladin.auraOfLifeHpMaxProtected'] = false;

        const result = await call(10);

        expect(result).toEqual({ baseMax: 40, reduced: 10, max: 30 });
        expect(runtimeStore['ElderPaladin.hitPoints']).toBe(30);
        expect(runtimeStore['ElderPaladin.hpMaxReduction']).toBe(10);
        expect(logs.find(l => l.automationType === 'hp_max_reduce_blocked')).toBeFalsy();
    });

    it('zero-damage application keeps its legacy zero log even when protected', async () => {
        runtimeStore['ElderPaladin.auraOfLifeHpMaxProtected'] = true;

        const result = await call(0);

        expect(result).toBe('zero');
        expect(logs.find(l => l.automationType === 'hp_max_reduce_blocked')).toBeFalsy();
    });
});
