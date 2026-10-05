// @improved-by-ai
// CLA-130 bug(b) lock: Find Steed must route through the data-driven
// summon_spirit lane (CLA-127 Primal Companion / SP-015 summon_spirit picker
// template) so a cast produces a combatant tracker card + a `summons` log row
// + a `Summoned (source)` target effect — never a silent log-only cast.
// 2024 uses the Otherworldly Steed stat block (AC 12 + slot level, HP scales);
// 5e uses the chosen-form animal blocks (statistics of the chosen form —
// scale:false, byte-shape twin of Animate Objects / Giant Insect).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells2024 from '../../../../../public/data/2024/spells.json' with { type: 'json' };
import spells5e from '../../../../../public/data/spells.json' with { type: 'json' };
import realMonsters from '../../../../../public/data/monsters.json' with { type: 'json' };

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
    default: { get: vi.fn(), set: vi.fn() },
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

import { handle, confirmSummonSpirit } from './summonSpiritHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';

const CAMPAIGN = 'test-campaign';

const findSteed2024 = spells2024.find(s => s.index === 'find-steed');
const findSteed5e = spells5e.find(s => s.index === 'find-steed');

function paladinStats(overrides = {}) {
    return {
        name: 'ElderPaladin',
        level: 20,
        proficiency: 6,
        abilities: [{ name: 'Charisma', bonus: 4 }],
        spellAbilities: { toHit: 11, saveDc: 19, modifier: 5 },
        ...overrides,
    };
}

function actionFor(spellRow, overrides = {}) {
    return {
        name: 'Find Steed',
        automation: spellRow.automation,
        spell: { ...spellRow },
        ...overrides,
    };
}

describe('CLA-130 Find Steed summon lane (defect b)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const store = { targetEffects: [] };
        getRuntimeValue.mockImplementation((_entity, key) => (key in store ? store[key] : null));
        setRuntimeValue.mockImplementation((_entity, key, value) => { store[key] = value; });
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'ElderPaladin', initiative: '15', initiativeBonus: 3 }],
        });
        loadMonsters.mockResolvedValue(realMonsters);
    });

    describe('data routing (both rulesets)', () => {
        it('2024 Find Steed declares summon_spirit automation with the Otherworldly Steed block', () => {
            expect(findSteed2024.automation?.type).toBe('summon_spirit');
            expect(findSteed2024.automation.variants).toHaveLength(1);
            expect(findSteed2024.automation.variants[0].monsterIndex).toBe('otherworldly-steed');
        });

        it('5e Find Steed declares summon_spirit automation with choose-a-form variants', () => {
            expect(findSteed5e.automation?.type).toBe('summon_spirit');
            expect(findSteed5e.automation.scale).toBe(false);
            const names = findSteed5e.automation.variants.map(v => v.name);
            expect(names).toEqual(expect.arrayContaining(['Warhorse', 'Riding Horse', 'Mastiff']));
        });

        it('every Find Steed variant monsterIndex resolves to a real monsters.json block', () => {
            const rows = [findSteed2024, findSteed5e];
            for (const row of rows) {
                for (const v of row.automation.variants) {
                    expect(realMonsters.find(m => m.index === v.monsterIndex),
                        `monsters.json missing ${v.monsterIndex}`).toBeTruthy();
                }
            }
        });

        it('Otherworldly Steed block scales AC with slot and carries the caster-fold Hooves row', () => {
            const steed = realMonsters.find(m => m.index === 'otherworldly-steed');
            expect(steed.armor_class).toBe(12);
            expect(steed.armor_class_scales_with_slot).toBe(true);
            expect(steed.ability_scores.int).toBe(6); // intelligent mount
            expect(steed.actions[0].attack_bonus).toBeNull(); // caster spell-attack fold
        });
    });

    describe('2024 single-variant cast (auto-summon, no chooser)', () => {
        it('spawns the Otherworldly Steed with folded caster stats + summons log + Summoned te', async () => {
            const combatSummary = getCombatSummary(CAMPAIGN);
            const action = actionFor(findSteed2024, { metaCtx: { slotLevel: 2, freeCastUsed: true } });

            const result = await handle(action, paladinStats(), CAMPAIGN);

            const steed = combatSummary.creatures.find(c => c.name?.startsWith('Otherworldly Steed'));
            expect(steed).toBeDefined();
            expect(steed.ac).toBe(14);            // armor_class 12 + slot 2
            expect(steed.maxHp).toBe(20);          // base 20 + 10×(2−2)
            expect(steed.currentHp).toBe(20);
            expect(steed.initiative).toBe('14.9'); // caster init − 0.1
            expect(steed.summonedBy).toBe('ElderPaladin');
            expect(steed.summonSource).toBe('spell');
            // Caster-fold lane (§86): null attack_bonus backfills spell attack +11.
            expect(steed.actions.find(a => a.name === 'Hooves').attack_bonus).toBe(11);

            const te = getRuntimeValue('campaign', 'targetEffects').find(e => e.target === steed.name);
            expect(te).toMatchObject({ effect: 'summoned', source: 'ElderPaladin', summonSource: 'spell' });
            // RAW: Find Steed is Instantaneous / non-Concentration — the lane's
            // noConcentration flag skips addConcentration entirely (steed survives
            // a Long Rest); the lane's te marker label stays '1_minute' (display,
            // zero duration consumers — documented residual).
            expect(te.duration).toBe('1_minute');

            const logged = addEntry.mock.calls.find(c => c[1]?.type === 'summons');
            expect(logged).toBeTruthy();
            expect(logged[1]).toMatchObject({ characterName: 'ElderPaladin', summonName: 'Otherworldly Steed' });
            expect(logged[1].description).toContain('ElderPaladin casts Find Steed (slot level 2)');
            expect(logged[1].summonedCreatures[0]).toBe(steed.name);
            expect(addConcentration).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });

        it('scales AC and HP with the slot level used (2024 ladder)', async () => {
            const combatSummary = getCombatSummary(CAMPAIGN);
            const action = actionFor(findSteed2024, { metaCtx: { slotLevel: 5, freeCastUsed: true } });

            await handle(action, paladinStats(), CAMPAIGN);

            const steed = combatSummary.creatures.find(c => c.name?.startsWith('Otherworldly Steed'));
            expect(steed.ac).toBe(12 + 5);
            expect(steed.maxHp).toBe(20 + 10 * (5 - 2));
        });
    });

    describe('5e multi-variant cast (chooser picker)', () => {
        it('opens the summonSpirit chooser then spawns the chosen form un-scaled', async () => {
            const modal = await handle(actionFor(findSteed5e, { metaCtx: { slotLevel: 2, freeCastUsed: true } }), paladinStats(), CAMPAIGN);
            expect(modal.type).toBe('modal');
            expect(modal.modalName).toBe('summonSpirit');

            const combatSummary = getCombatSummary(CAMPAIGN);
            const result = await confirmSummonSpirit(actionFor(findSteed5e), paladinStats(), CAMPAIGN, 'Warhorse');
            expect(result.type).toBe('popup');

            const warhorse = combatSummary.creatures.find(c => c.name?.startsWith('Warhorse'));
            expect(warhorse).toBeDefined();
            expect(warhorse.ac).toBe(11);    // statistics of the chosen form (scale:false)
            expect(warhorse.maxHp).toBe(19);
            expect(warhorse.summonedBy).toBe('ElderPaladin');

            const te = getRuntimeValue('campaign', 'targetEffects').find(e => e.target === warhorse.name);
            expect(te).toMatchObject({ effect: 'summoned', source: 'ElderPaladin' });
            const logged = addEntry.mock.calls.find(c => c[1]?.type === 'summons');
            expect(logged[1]).toMatchObject({ characterName: 'ElderPaladin', summonName: 'Otherworldly Steed' });
        });
    });

    describe('unpaid-slot guard (SP-005 backstop)', () => {
        it('refuses an unpaid lv2 slot cast with zero spawn + summon_refused log', async () => {
            const combatSummary = getCombatSummary(CAMPAIGN);
            const action = actionFor(findSteed2024, { metaCtx: { slotLevel: 2, slotConsumed: false } });

            const result = await handle(action, paladinStats(), CAMPAIGN);

            expect(combatSummary.creatures.some(c => c.name?.startsWith('Otherworldly Steed'))).toBe(false);
            const refused = addEntry.mock.calls.find(c => c[1]?.automationType === 'summon_refused');
            expect(refused).toBeTruthy();
            expect(result.type).toBe('popup');
        });
    });
});
