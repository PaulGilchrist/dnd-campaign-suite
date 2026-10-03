// @improved-by-ai
// @cleaned-by-ai
// CLA-037: Bewitching Magic is an unlimited free Misty Step rider. These tests
// flip the old pins that bound it to the Steps of the Fey uses counter
// (_Steps_of_the_Fey_freeCastCount) — the handler must never read or write it.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './bewitchingMagicHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { addEntry } = await import('../../../ui/logService.js');

const campaignName = 'test-campaign';
const playerName = 'TestWarlock';

const goblinCreature = { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 };
const warlockCreature = { name: playerName, type: 'player', currentHp: 20, maxHp: 20 };

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        proficiency: 3,
        abilities: [{ name: 'Charisma', bonus: 2 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Bewitching Magic',
        automation: { type: 'bewitching_magic', casting_time: 'passive' },
        ...overrides,
    };
}

function setupManualAttack(lastAttack) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'lastAttack') return lastAttack;
        return null;
    });
    getCombatContext.mockResolvedValue({ creatures: [goblinCreature, warlockCreature] });
}

function stepsCounterReads() {
    return getRuntimeValue.mock.calls.filter(c => String(c[1]).includes('Steps_of_the_Fey'));
}

function refusalEntries() {
    return addEntry.mock.calls
        .map(c => c[1])
        .filter(e => e && e.automationDetail === 'bewitching_magic_refused');
}

describe('bewitchingMagicHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('manual lane: lastAttack gate', () => {
        it('refuses when no lastAttack exists and logs the refusal', async () => {
            setupManualAttack(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('enchantment or illusion');
            expect(refusalEntries().length).toBe(1);
            expect(refusalEntries()[0].reason).toContain('no qualifying spell cast');
        });

        it('refuses when attacker is not the warlock and logs the refusal', async () => {
            setupManualAttack({ attackerName: 'Goblin', spellSchool: 'enchantment' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(refusalEntries()[0].reason).toContain('no qualifying spell cast');
        });

        it('refuses when spell school is not enchantment or illusion and logs the school', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'evocation' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(refusalEntries()[0].reason).toContain('evocation');
        });

        it('refuses when no school is stamped anywhere and logs unknown school', async () => {
            setupManualAttack({ attackerName: playerName });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(refusalEntries()[0].reason).toContain('unknown');
        });

        it('does NOT gate on lastAttack when autoTrigger is set (school comes from action)', async () => {
            setupManualAttack(null);

            const result = await handle(makeAction({ autoTrigger: true, school: 'Illusion' }), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
            expect(getRuntimeValue).not.toHaveBeenCalledWith('campaign', 'lastAttack', campaignName);
        });

        it('auto lane still refuses a non-qualifying school carried on the action', async () => {
            setupManualAttack(null);

            const result = await handle(makeAction({ autoTrigger: true, school: 'Transmutation' }), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(refusalEntries()[0].reason).toContain('not an enchantment or illusion');
        });
    });

    describe('school field resolution', () => {
        it('uses lastAttack.spellSchool as primary source', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'enchantment', damageSchool: 'evocation' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
        });

        it('falls back to lastAttack.damageSchool when spellSchool is absent', async () => {
            setupManualAttack({ attackerName: playerName, damageSchool: 'enchantment' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
        });

        it('is case-insensitive for school comparison', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'ENCHANTMENT' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
        });
    });

    describe('modal return: unlimited free rider (CLA-037)', () => {
        it('returns bewitchingMagic modal with unlimited flag and no uses counter keys', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'illusion' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stepsOfTheFeyTaunt');
            expect(result.payload.mode).toBe('bewitchingMagic');
            expect(result.payload.unlimited).toBe(true);
            expect(result.payload.freeCastCountKey).toBeUndefined();
            expect(result.payload.newCount).toBeUndefined();
        });

        it('never reads or writes the Steps of the Fey free-cast counter', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'illusion' });

            await handle(makeAction(), makePlayerStats(), campaignName, 'map');
            await handle(makeAction({ autoTrigger: true, school: 'Enchantment' }), makePlayerStats(), campaignName, 'map');

            expect(stepsCounterReads().length).toBe(0);
        });

        it('filters out the warlock from eligible targets', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'enchantment' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.payload.targets.length).toBe(1);
            expect(result.payload.targets[0].name).toBe('Goblin');
        });

        it('handles getCombatContext returning null gracefully', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'enchantment' });
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.targets).toEqual([]);
        });
    });

    describe('save DC calculation', () => {
        it('calculates save DC with proficiency and CHA bonus', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'enchantment' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.payload.saveDc).toBe(13); // 8 + 2 (CHA) + 3 (prof)
        });

        it('defaults proficiency to 0 when missing', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'enchantment' });

            const result = await handle(makeAction(), makePlayerStats({ proficiency: undefined }), campaignName, 'map');

            expect(result.payload.saveDc).toBe(10); // 8 + 2 (CHA) + 0 (no prof)
        });

        it('defaults CHA bonus to 0 when missing', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'enchantment' });

            const result = await handle(makeAction(), makePlayerStats({ abilities: [] }), campaignName, 'map');

            expect(result.payload.saveDc).toBe(11); // 8 + 0 (no CHA) + 3 (prof)
        });

        it('defaults to 8 when both proficiency and CHA bonus are missing', async () => {
            setupManualAttack({ attackerName: playerName, spellSchool: 'enchantment' });

            const result = await handle(makeAction(), makePlayerStats({ proficiency: undefined, abilities: [] }), campaignName, 'map');

            expect(result.payload.saveDc).toBe(8);
        });
    });
});
