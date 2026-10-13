// H3 (§17): turn-END zone-damage repeat consumer — enforcement gating, RAW
// half-on-save, latch, PC prompt lane, honest skip on unresolvable dice.
import { applyZoneRepeatTurnEnd, isZonesEnforced, ZONE_REPEAT_LATCH_KEY } from './zoneRepeatTurnEndService.js';

const store = {};
const storeKey = (who, key) => `${who}::${key}`;

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((who, key) => store[`${who}::${key}`] ?? null),
    setRuntimeValue: vi.fn(async (who, key, value) => { store[`${who}::${key}`] = value; }),
    getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('../../dice/diceRoller.js', () => ({ rollExpression: vi.fn(() => ({ total: 12 })) }));
const logs = [];
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(async (c, e) => { logs.push(e); }) }));
vi.mock('../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => ({
        round: 3,
        creatures: [
            { name: 'Goblin 1', type: 'monster', currentHp: 30, maxHp: 30, saveBonuses: { con: -1 } },
            { name: 'Rakan', type: 'player' },
            { name: 'Corpse', type: 'monster', currentHp: 0, maxHp: 4 },
        ],
    })),
    setCombatSummaryCache: vi.fn(),
}));
const listenerCalls = [];
vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn((campaignName, config) => {
        listenerCalls.push(config);
        return { promise: Promise.resolve({ roll: 8, saveBonus: 2, success: false }) };
    }),
}));
const storageSets = [];
vi.mock('../../ui/storage.js', () => ({
    default: { set: vi.fn((key, value) => { storageSets.push({ key, value }); }) },
}));

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../dice/diceRoller.js';

const ARMED_TE = { target: 'Goblin 1', effect: 'lair_insect_cloud', source: 'Black Dragon', dc: 13, repeatTurnEnd: true, duration: '1 minute' };
const STAMP = { saveDc: 13, saveType: 'Constitution', radiusFt: 20, repeatTurnEnd: true, damage: '2d6', affectedNames: ['Goblin 1'] };

function seed({ enforcement, tes = [ARMED_TE], stamp = STAMP, latch = null } = {}) {
    Object.keys(store).forEach(k => delete store[k]);
    store[storeKey('campaign', 'enforcement')] = enforcement;
    store[storeKey('campaign', 'targetEffects')] = tes;
    if (stamp) store[storeKey('Black Dragon', '_lair_insect_cloud_Black_Dragon')] = stamp;
    if (latch) store[storeKey('Goblin 1', ZONE_REPEAT_LATCH_KEY)] = latch;
}

beforeEach(() => {
    logs.length = 0;
    listenerCalls.length = 0;
    storageSets.length = 0;
    vi.mocked(setRuntimeValue).mockClear();
    vi.mocked(rollExpression).mockClear();
    vi.mocked(rollExpression).mockReturnValue({ total: 12 });
});

describe('enforcement gate (L1–4 parity)', () => {
    it('no enforcement flag ⇒ zero engagement: no rolls, no writes, no logs', async () => {
        seed({ enforcement: undefined });
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Goblin 1');
        expect(r).toEqual({ handled: false });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(storageSets).toHaveLength(0);
        expect(logs).toHaveLength(0);
    });

    it('master on but zones off ⇒ still zero', async () => {
        seed({ enforcement: { mode: 'on', zones: false } });
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Goblin 1');
        expect(r).toEqual({ handled: false });
        expect(storageSets).toHaveLength(0);
    });

    it('isZonesEnforced needs BOTH mode on AND zones true', () => {
        seed({ enforcement: { mode: 'on', zones: true } });
        expect(isZonesEnforced('test-campaign')).toBe(true);
        seed({ enforcement: { mode: 'off', zones: true } });
        expect(isZonesEnforced('test-campaign')).toBe(false);
    });

    it('zones live but no repeatTurnEnd te ⇒ handled:false, no damage', async () => {
        seed({ enforcement: { mode: 'on', zones: true }, tes: [{ ...ARMED_TE, repeatTurnEnd: false }] });
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Goblin 1');
        expect(r).toEqual({ handled: false });
        expect(storageSets).toHaveLength(0);
    });
});

describe('NPC inline save + untyped zone damage', () => {
    it('failed save: full 2d6 through the combatSummary lane + logs', async () => {
        seed({ enforcement: { mode: 'on', zones: true } });
        vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1, +(-1) = 0 < DC 13 ⇒ fail
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Goblin 1');
        expect(r.handled).toBe(true);
        expect(r.results[0]).toMatchObject({ success: false, raw: 12, damage: 12, newHp: 18 });
        expect(storageSets[0].value.creatures.find(c => c.name === 'Goblin 1').currentHp).toBe(18);
        expect(logs.map(l => l.type)).toEqual(['save_result', 'hp_change']);
        expect(logs[0].rollType).toBe('zone-repeat-save');
        vi.spyOn(Math, 'random').mockRestore();
    });

    it('successful save: HALF damage (RAW insect cloud)', async () => {
        seed({ enforcement: { mode: 'on', zones: true } });
        vi.spyOn(Math, 'random').mockReturnValue(0.99); // d20 = 20 + (-1) ≥ 13 ⇒ success
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Goblin 1');
        expect(r.results[0]).toMatchObject({ success: true, raw: 12, damage: 6, newHp: 24 });
        vi.spyOn(Math, 'random').mockRestore();
    });

    it('dead victims are skipped', async () => {
        seed({ enforcement: { mode: 'on', zones: true }, tes: [{ ...ARMED_TE, target: 'Corpse' }] });
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Corpse');
        expect(r.results).toHaveLength(0);
        expect(storageSets).toHaveLength(0);
    });

    it('no dice anywhere (te descriptor + stamp stripped) ⇒ honest skip, loud error, no damage', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        seed({ enforcement: { mode: 'on', zones: true }, stamp: null });
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Goblin 1');
        expect(r.results).toHaveLength(0);
        expect(err).toHaveBeenCalledWith(expect.stringContaining('lacks dice'));
        expect(storageSets).toHaveLength(0);
        err.mockRestore();
    });
});

describe('round latch (no intra-round doubles)', () => {
    it('same effect + same round ⇒ second call is a no-op', async () => {
        seed({ enforcement: { mode: 'on', zones: true }, latch: { lair_insect_cloud: 3 } });
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Goblin 1');
        expect(r.results).toHaveLength(0);
        expect(storageSets).toHaveLength(0);
    });

    it('prior-round latch does NOT block a new round; tick stamps the new round', async () => {
        seed({ enforcement: { mode: 'on', zones: true }, latch: { lair_insect_cloud: 2 } });
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Goblin 1');
        expect(r.results).toHaveLength(1);
        expect(store[storeKey('Goblin 1', ZONE_REPEAT_LATCH_KEY)]).toEqual({ lair_insect_cloud: 3 });
        vi.spyOn(Math, 'random').mockRestore();
    });
});

describe('PC lane — players roll their own saves', () => {
    it('PC victim gets the queued save-listener prompt (dc_success half), damage on the fail it returns', async () => {
        seed({
            enforcement: { mode: 'on', zones: true },
            tes: [{ ...ARMED_TE, target: 'Rakan' }],
        });
        store[storeKey('Rakan', 'currentHitPoints')] = 20;
        store[storeKey('Rakan', 'hitPoints')] = 40;
        const r = await applyZoneRepeatTurnEnd('test-campaign', 'Rakan');
        expect(listenerCalls[0]).toMatchObject({ saveType: 'CON', saveDc: 13, dcSuccess: 'half' });
        // listener stub returns roll 8 + 2 = 10 < 13 ⇒ fail ⇒ full 12
        expect(r.results[0]).toMatchObject({ success: false, damage: 12, newHp: 8 });
        expect(setRuntimeValue).toHaveBeenCalledWith('Rakan', 'currentHitPoints', 8, 'test-campaign');
    });
});
