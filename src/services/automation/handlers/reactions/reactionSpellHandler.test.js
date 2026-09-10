// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyWarCasterReaction } from './reactionSpellHandler.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ round: 1 }),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((range) => (range === 'Self' ? null : 120)),
}));

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'TestCleric';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 10,
        spellAbilities: {
            spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Always', level: 1, range: '30 feet' },
                { name: 'Shield', casting_time: '1 reaction', prepared: 'Always', level: 1, range: 'Self' },
                { name: 'Fireball', casting_time: '1 action', prepared: 'Always', level: 3, range: '150 feet', area_of_effect: { shape: 'sphere', size: '20-foot-radius' } },
                { name: 'Mage Armor', casting_time: '1 bonus action', prepared: 'Always', level: 1, range: 'Touch' },
            ],
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Reactive Spell',
        automation: { type: 'reaction_spell', ...overrides.automation },
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────

describe('reactionSpellHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReset().mockReturnValue(null);
        useRuntimeState.setRuntimeValue.mockReset().mockResolvedValue(undefined);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
        isWithinRange.mockReset().mockResolvedValue(true);
    });

    describe('handle — return structure', () => {
        it('returns popup with automation_info type and correct payload fields', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            const result = await handle(action, ps, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.trigger).toBe('opportunity_attack_reaction');
            expect(result.payload.automation).toEqual(action.automation);
            expect(result.payload.name).toBe('Reactive Spell');
        });
    });

    describe('handle — spell eligibility filtering', () => {
        it('includes 1 action spells and excludes reaction and bonus action spells', async () => {
            const ps = makePlayerStats();
            const result = await handle(makeAction(), ps, campaignName);

            const spellNames = result.payload.eligibleSpells.map(s => s.name);
            expect(spellNames).toContain('Burning Hands');
            expect(spellNames).not.toContain('Shield');
            expect(spellNames).not.toContain('Mage Armor');
        });

        it('includes spells with casting_time "Action" (capitalized)', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Cure Wounds', casting_time: 'Action', prepared: 'Always', level: 1 },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.eligibleSpells.map(s => s.name)).toContain('Cure Wounds');
        });

        it('excludes spells with casting_time other than 1 action or Action', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Haste', casting_time: '1 bonus action', prepared: 'Always', level: 3 },
                { name: 'Castigate', casting_time: '1 minute', prepared: 'Always', level: 5 },
                { name: 'Shield', casting_time: '1 reaction', prepared: 'Always', level: 1 },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.eligibleSpells).toHaveLength(0);
        });

        it('excludes unprepared spells and includes prepared ones', async () => {
            // Excludes unprepared (string false)
            const ps1 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Not Prepared', level: 1 },
            ] } });
            let result = await handle(makeAction(), ps1, campaignName);
            expect(result.payload.eligibleSpells).toHaveLength(0);

            // Excludes unprepared (boolean false)
            const ps2 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: false, level: 1 },
            ] } });
            result = await handle(makeAction(), ps2, campaignName);
            expect(result.payload.eligibleSpells).toHaveLength(0);

            // Includes prepared
            const ps3 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Prepared', level: 1 },
            ] } });
            result = await handle(makeAction(), ps3, campaignName);
            expect(result.payload.eligibleSpells).toHaveLength(1);

            // Includes always
            const ps4 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Always', level: 1 },
            ] } });
            result = await handle(makeAction(), ps4, campaignName);
            expect(result.payload.eligibleSpells).toHaveLength(1);
        });

        it('handles null or missing spellAbilities/spells gracefully', async () => {
            expect((await handle(makeAction(), makePlayerStats({ spellAbilities: null }), campaignName)).payload.eligibleSpells).toHaveLength(0);
            expect((await handle(makeAction(), makePlayerStats({ spellAbilities: {} }), campaignName)).payload.eligibleSpells).toHaveLength(0);
            expect((await handle(makeAction(), null, campaignName)).payload.eligibleSpells).toHaveLength(0);
        });
    });

    describe('handle — single-target filtering', () => {
        it('excludes multi-target spells (AoE or maxTargets > 1) and includes single-target spells', async () => {
            // Excludes AoE
            const ps1 = makePlayerStats();
            let result = await handle(makeAction(), ps1, campaignName);
            expect(result.payload.eligibleSpells.find(s => s.name === 'Fireball')).toBeUndefined();
            expect(result.payload.hasWarnings).toBe(true);

            // Excludes maxTargets > 1
            const ps2 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Acid Splash', casting_time: '1 action', prepared: 'Always', level: 1, automation: { maxTargets: 2 } },
            ] } });
            result = await handle(makeAction(), ps2, campaignName);
            expect(result.payload.eligibleSpells).toHaveLength(0);
            expect(result.payload.hasWarnings).toBe(true);

            // Includes single-target without area or maxTargets
            const ps3 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Always', level: 1 },
            ] } });
            result = await handle(makeAction(), ps3, campaignName);
            expect(result.payload.eligibleSpells).toHaveLength(1);
            expect(result.payload.hasWarnings).toBe(false);

            // Includes maxTargets <= 1
            const ps4 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Magic Missile', casting_time: '1 action', prepared: 'Always', level: 1, automation: { maxTargets: 1 } },
            ] } });
            result = await handle(makeAction(), ps4, campaignName);
            expect(result.payload.eligibleSpells).toHaveLength(1);
            expect(result.payload.hasWarnings).toBe(false);
        });
    });

    describe('handle — spell data structure', () => {
        it('includes name, level, casting_time, range and derived fields with correct defaults', async () => {
            const ps = makePlayerStats();
            const result = await handle(makeAction(), ps, campaignName);

            const spell = result.payload.eligibleSpells.find(s => s.name === 'Burning Hands');
            expect(spell.name).toBe('Burning Hands');
            expect(spell.level).toBe(1);
            expect(spell.casting_time).toBe('1 action');
            expect(spell.range).toBe('30 feet');
            expect(spell.isSingleTarget).toBe(true);
            expect(spell.hasAreaOfEffect).toBe(false);
            expect(spell.maxTargets).toBe(1);
        });

        it('defaults level to 0 and maxTargets to 1 when not specified', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Cantrip', casting_time: '1 action', prepared: 'Always' },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.eligibleSpells[0].level).toBe(0);
            expect(result.payload.eligibleSpells[0].maxTargets).toBe(1);
        });
    });

    describe('handle — description content', () => {
        it('describes the trigger behavior and lists available spells', async () => {
            const ps = makePlayerStats();
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.description).toContain('leaves your reach');
            expect(result.payload.description).toContain('Burning Hands');
        });

        it('lists excluded multi-target spells in the description', async () => {
            const ps = makePlayerStats();
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.hasWarnings).toBe(true);
            expect(result.payload.description).toContain('Excluded');
            expect(result.payload.description).toContain('Fireball');
        });

        it('reports no spells when spellAbilities.spells is empty or none match', async () => {
            // Empty spell list
            const ps1 = makePlayerStats({ spellAbilities: { spells: [] } });
            let result = await handle(makeAction(), ps1, campaignName);
            expect(result.payload.eligibleSpells).toHaveLength(0);
            expect(result.payload.description).toContain('No spells');
            expect(result.payload.hasWarnings).toBe(false);

            // No matching spells (all wrong casting time)
            const ps2 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Shield', casting_time: '1 reaction', prepared: 'Always' },
                { name: 'Mage Armor', casting_time: '1 bonus action', prepared: 'Always' },
            ] } });
            result = await handle(makeAction(), ps2, campaignName);
            expect(result.payload.description).toContain('No spells');
            expect(result.payload.hasWarnings).toBe(false);
        });

        it('includes no warning section when all spells are eligible', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Always', level: 1 },
                { name: 'Magic Missile', casting_time: '1 action', prepared: 'Always', level: 1 },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.hasWarnings).toBe(false);
            expect(result.payload.description).not.toContain('Excluded');
        });
    });

    describe('handle — once-per-round latch (FT-099)', () => {
        it('refuses at the row click when the latch is stamped this round — picker never opens, zero spend', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((_c, key) => {
                if (key === '_Reactive_Spell_usedRound') return 1;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.eligibleSpells).toBeUndefined();
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('already used this round');
            const refusalLog = logService.addEntry.mock.calls.find(c => c[1]?.automationType === 'reactive_spell_refused');
            expect(refusalLog).toBeTruthy();
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses without an armed target', async () => {
            getTargetFromAttacker.mockReturnValueOnce(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.eligibleSpells).toBeUndefined();
            expect(result.payload.description).toContain('requires a target');
            const refusalLog = logService.addEntry.mock.calls.find(c => c[1]?.automationType === 'reactive_spell_refused');
            expect(refusalLog).toBeTruthy();
        });

        it('excludes Self-target spells from eligibility', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Armor of Agathys', casting_time: '1 action', prepared: 'Always', level: 1, range: 'Self' },
                { name: 'Fire Bolt', casting_time: '1 action', prepared: 'Always', level: 0, range: '120 feet' },
            ] } });

            const result = await handle(makeAction(), ps, campaignName);

            const names = result.payload.eligibleSpells.map(s => s.name);
            expect(names).toEqual(['Fire Bolt']);
            expect(result.payload.hasWarnings).toBe(true);
        });
    });

    describe('applyWarCasterReaction', () => {
        beforeEach(() => {
            useRuntimeState.getRuntimeValue.mockImplementation((_c, key) => {
                if (key === 'warCasterReactions') return [];
                return null;
            });
        });

        it('stamps the round latch awaited before recording, stores reaction, and returns ok', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Burning Hands', level: 3, range: '120 feet' };

            const result = await applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);

            expect(result).toEqual({ ok: true });
            const latchCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === '_Reactive_Spell_usedRound');
            expect(latchCall).toBeTruthy();
            expect(latchCall[0]).toBe(playerName);
            expect(latchCall[2]).toBe(1);
            const storedCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'warCasterReactions');
            const latchIdx = useRuntimeState.setRuntimeValue.mock.calls.indexOf(latchCall);
            const storedIdx = useRuntimeState.setRuntimeValue.mock.calls.indexOf(storedCall);
            expect(latchIdx).toBeLessThan(storedIdx);
            expect(storedCall[2]).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    targetName: 'Goblin',
                    spellName: 'Burning Hands',
                    spellData,
                    characterName: playerName,
                }),
            ]));
        });

        it('returns ok:true on success', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Burning Hands', level: 3, range: '120 feet' };

            const result = await applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);

            expect(result).toEqual({ ok: true });
        });

        it('appends to existing reactions without mutating the stored array', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Fireball', level: 3, range: '150 feet' };
            const existing = [{ targetName: 'Orc', spellName: 'Magic Missile' }];

            useRuntimeState.getRuntimeValue.mockImplementation((_c, key) => (key === 'warCasterReactions' ? existing : null));

            await applyWarCasterReaction('Goblin', 'Fireball', spellData, ps, campaignName);

            const storedCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'warCasterReactions');
            expect(storedCall[2]).toHaveLength(2);
            expect(existing).toHaveLength(1);
        });

        it('refuses on the same-round latch with zero spend and a refused log', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Burning Hands', level: 3, range: '120 feet' };

            useRuntimeState.getRuntimeValue.mockImplementation((_c, key) => {
                if (key === '_Reactive_Spell_usedRound') return 1;
                return null;
            });

            const result = await applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);

            expect(result.ok).toBe(false);
            expect(result.refused).toContain('already used this round');
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ automationType: 'reactive_spell_refused' }),
            );
        });

        it('refuses when the leaving creature is out of the spell range — no latch, no log spend', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Fire Bolt', level: 0, range: '120 feet' };

            isWithinRange.mockResolvedValueOnce(false);

            const result = await applyWarCasterReaction('Goblin', 'Fire Bolt', spellData, ps, campaignName);

            expect(result.ok).toBe(false);
            expect(result.refused).toContain('out of range');
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ automationType: 'reactive_spell_refused' }),
            );
        });

        it('logs an ability_use entry', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Burning Hands', level: 3, range: '120 feet' };

            await applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);

            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'War Caster - Reactive Spell',
                    description: 'War Caster Reactive Spell: Casting Burning Hands as a reaction on Goblin.',
                }),
            );
        });
    });
});
