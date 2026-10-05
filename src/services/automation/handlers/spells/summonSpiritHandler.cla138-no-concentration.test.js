// CLA-138: Fey Reinforcements' arm-time "Skip Concentration" choice rides the
// modified-spell stamp (_noConcentrationChoice) set by spellPreparationService.
// summonSpiritHandler must HONOR it: no caster concentration stamp, a hard
// 1-minute (rounds:10) expiry clock, a free-cast log line (never "slot level"),
// and the default path (unstamped) keeps concentration + the 1-hour clock.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { confirmSummonSpirit } from './summonSpiritHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: { get: vi.fn(), set: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../buffs/tempHpService.js', () => ({
    setTempHpOnKey: vi.fn(),
}));

vi.mock('../../../encounters/encounterToInitiative.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getMonsterSaveBonuses: vi.fn(() => ({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })),
    };
});

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'FeyRanger';

const feySpiritTrickster = {
    index: 'fey-spirit-trickster', name: 'Fey Spirit (Trickster)', type: 'fey',
    armor_class: 12, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
    saving_throws: {}, actions: [], reactions: [],
};

function rangerStats() {
    return {
        name: CASTER,
        level: 17,
        proficiency: 6,
        abilities: [{ name: 'Wisdom', bonus: 4 }, { name: 'Charisma', bonus: 0 }],
        spellAbilities: { toHit: 13, saveDc: 17, modifier: 4 },
    };
}

function summonFeyAction(spellOverrides = {}, metaCtx = {}) {
    return {
        name: 'Summon Fey',
        automation: {
            type: 'summon_spirit',
            typeLabel: 'Fey Spirit',
            baseLevel: 4,
            hpPerLevelAbove: 10,
            variants: [{ name: 'Fey Spirit (Trickster)', monsterIndex: 'fey-spirit-trickster' }],
        },
        spell: {
            level: 4,
            concentration: true,
            duration: 'Concentration, up to 1 hour',
            ...spellOverrides,
        },
        metaCtx,
    };
}

describe('CLA-138 summonSpirit honors runtime no-Concentration choice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.dispatchEvent = vi.fn();
        const store = { targetEffects: [] };
        getRuntimeValue.mockImplementation((entity, key) => (key in store && entity === 'campaign' ? store[key] : null));
        setRuntimeValue.mockImplementation((entity, key, value) => { store[key] = value; });
        getCombatSummary.mockReturnValue({
            creatures: [{ name: CASTER, initiative: '15', initiativeBonus: 3, concentration: null }],
        });
        loadMonsters.mockResolvedValue([feySpiritTrickster]);
    });

    it('_noConcentrationChoice: NO caster concentration, rounds:10 expiry clock, free-cast + 1-minute log', async () => {
        const action = summonFeyAction(
            { concentration: false, duration: '1 minute', _noConcentrationChoice: true },
            { freeCastUsed: true }
        );

        const result = await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, 'Fey Spirit (Trickster)');

        expect(result.type).toBe('popup');
        expect(addConcentration).not.toHaveBeenCalled();
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0].rounds).toBe(10);

        const cs = getCombatSummary(CAMPAIGN);
        expect(cs.creatures.find(c => c.name === CASTER).concentration).toBeNull();

        const summonLog = addEntry.mock.calls.find(c => c[1].type === 'summons');
        expect(summonLog).toBeDefined();
        expect(summonLog[1].description).toContain('free cast — no spell slot consumed');
        expect(summonLog[1].description).not.toContain('slot level');
        expect(summonLog[1].description).toContain('does not require Concentration (duration 1 minute)');

        const teWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
        const marker = teWrites[teWrites.length - 1][2].find(te => te.effect === 'summoned');
        expect(marker.duration).toBe('1_minute');
    });

    it('default (no stamp): concentration stamped, spell-duration expiry clock, slot log', async () => {
        const action = summonFeyAction({}, { slotConsumed: true });

        await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, 'Fey Spirit (Trickster)');

        expect(addConcentration).toHaveBeenCalled();
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0].rounds).toBe(600);

        const summonLog = addEntry.mock.calls.find(c => c[1].type === 'summons');
        expect(summonLog[1].description).toContain('slot level 4');
        expect(summonLog[1].description).not.toContain('free cast');
        expect(summonLog[1].description).not.toContain('does not require Concentration');
    });
});
