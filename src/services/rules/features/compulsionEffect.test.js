// @maintained-by-ai
// compulsionEffect lane — the multi-target CONFIRM side of the Compulsion family:
// gateCompulsion → pendingCompulsion → handleCompulsionConfirm → applyCompulsionEffect
// (wiring into this export is pinned by confirm-payloads.test.js, which mocks it wholesale;
// this file owns its internals). Trigger/action-envelope logic lives in compulsionTrigger.test.js;
// the single-target NPC auto-roll handler lane is compulsionHandler.test.js (split recorded there,
// compelledDuel #24). Charmed-condition clearing / concentration seams are NOT this lane's bytes —
// they ride useInitiativeEffects.concentrationClearing (concentrationClearing2.test.js).
// Disk canon (public/data/spells.json + 2024/spells.json, read 2026-10-20): Compulsion is
// level 4, Wisdom save, Concentration up to 1 minute — the >=1-minute duration is combat-scoped
// per the no-timers policy (no clock here: expiration/condition clear at turn seams).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyCompulsionEffect } from './compulsionService.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addEntry } from '../../ui/logService.js';
import { addExpiration } from '../effects/expirations.js';
import { addCondition } from '../../combat/conditions/conditionSaveService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

describe('applyCompulsionEffect (multi-target confirm lane)', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    // spell row mirrors disk canon: spells.json index 'compulsion' → level 4, WIS, concentration
    const spell = { name: 'Compulsion', level: 4 };
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence' },
        proficiency: 4,
    };
    const combatContext = { creatures: [{ name: 'Goblin' }, { name: 'Orc' }, { name: 'Troll' }] };

    // Deterministic per-target save outcomes: listed targets fail, everyone else succeeds.
    const seedSaves = (failures = []) => {
        createSaveListener.mockImplementation((_campaign, config) => ({
            promptId: `prompt-${config.targetName}`,
            promise: Promise.resolve({ success: !failures.includes(config.targetName) }),
        }));
    };

    beforeEach(() => {
        vi.resetAllMocks();
        // explicit re-seed of factory behavior destroyed by resetAllMocks
        addEntry.mockResolvedValue({});
        getCombatContext.mockResolvedValue(combatContext);
        seedSaves();
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['empty array', []],
        ['non-array string', 'Goblin'],
    ])('returns null and touches no collaborator for %s targetNames', async (_label, targetNames) => {
        const result = await applyCompulsionEffect(spell, playerStats, campaignName, mapName, targetNames);

        expect(result).toBeNull();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(addCondition).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it.each([
        ['spellAbilities.saveDc wins over 8+proficiency', playerStats, 15],
        ['8 + proficiency when spellAbilities is missing', { name: 'Wizard', proficiency: 3 }, 11],
        ['8 + proficiency when spellAbilities lacks saveDc', { name: 'Wizard', spellAbilities: {}, proficiency: 4 }, 12],
        ['default proficiency 2 on empty stats', {}, 10],
    ])('derives DC $2: $1', async (_label, stats, expectedDc) => {
        await applyCompulsionEffect(spell, stats, campaignName, mapName, ['Goblin']);

        // exact envelope — no objectContaining slack on the WIS save-or-suck contract
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
            targetName: 'Goblin',
            saveType: 'WIS',
            saveDc: expectedDc,
            dcSuccess: 'none',
            advantage: false,
            disadvantage: false,
            condition: 'charmed',
        });
    });

    it('single failed save: pins every log entry, condition write, expiration and popup', async () => {
        seedSaves(['Goblin']);

        const result = await applyCompulsionEffect(spell, playerStats, campaignName, mapName, ['Goblin']);

        expect(addEntry).toHaveBeenCalledTimes(4);
        const [castLog, saveLog, conditionLog, summaryLog] = addEntry.mock.calls.map(c => c[1]);
        expect(castLog).toEqual({
            type: 'ability_use',
            characterName: 'Wizard',
            abilityName: 'Compulsion',
            description: 'Wizard casts Compulsion on Goblin! Goblin must make a WIS save (DC 15) or become Charmed.',
            promptId: 'prompt-Goblin',
            timestamp: expect.any(Number),
        });
        expect(saveLog).toEqual({
            type: 'save_result',
            characterName: 'Wizard',
            rollType: 'save-compulsion',
            targetName: 'Goblin',
            saveDc: 15,
            saveType: 'WIS',
            success: false,
            description: 'Goblin failed on WIS save against Compulsion (DC 15).',
            timestamp: expect.any(Number),
        });
        expect(conditionLog).toEqual({
            type: 'condition',
            action: 'applied',
            characterName: 'Goblin',
            condition: 'Charmed',
            reason: 'Compulsion spell',
            note: 'Goblin is Charmed by Wizard. As a bonus action on each of its turns, Goblin must use its movement to travel to the nearest space that is furthest away from Wizard.',
            timestamp: expect.any(Number),
        });
        expect(summaryLog).toEqual({
            type: 'ability_use',
            characterName: 'Wizard',
            abilityName: 'Compulsion',
            description: 'Compulsion cast: 1 of 1 target(s) affected. Targets: Goblin. 0 succeeded on WIS save.',
            timestamp: expect.any(Number),
        });

        expect(addCondition).toHaveBeenCalledWith({
            combatSummary: combatContext,
            creatureName: 'Goblin',
            conditionDef: { key: 'charmed', label: 'Charmed' },
            dc: 15,
            ability: 'WIS',
            getRuntimeValue,
            setRuntimeValue,
            campaignName,
            playerStats,
        });

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Wizard',
            targetName: 'Goblin',
            effects: [{ type: 'charmed', condition: 'charmed' }],
            campaignName,
        });

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Compulsion',
                description: '1 of 1 target(s) affected by Compulsion and became Charmed.',
            },
        });
    });

    it('all saves succeed: no charm is written and the popup reports zero affected', async () => {
        const result = await applyCompulsionEffect(spell, playerStats, campaignName, mapName, ['Goblin']);

        expect(addCondition).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        // success leg never re-reads combat context
        expect(getCombatContext).not.toHaveBeenCalled();

        // cast + save + summary only — no condition entry
        expect(addEntry).toHaveBeenCalledTimes(3);
        expect(addEntry.mock.calls.map(c => c[1].type)).toEqual(['ability_use', 'save_result', 'ability_use']);
        expect(addEntry.mock.calls[1][1]).toEqual({
            type: 'save_result',
            characterName: 'Wizard',
            rollType: 'save-compulsion',
            targetName: 'Goblin',
            saveDc: 15,
            saveType: 'WIS',
            success: true,
            description: 'Goblin succeeded on WIS save against Compulsion (DC 15).',
            timestamp: expect.any(Number),
        });
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Compulsion',
                description: '0 of 1 target(s) affected by Compulsion and became Charmed.',
            },
        });
    });

    it('processes targets sequentially with independent saves and exact partial counts', async () => {
        seedSaves(['Goblin', 'Troll']);

        const result = await applyCompulsionEffect(spell, playerStats, campaignName, mapName, ['Goblin', 'Orc', 'Troll']);

        expect(createSaveListener).toHaveBeenCalledTimes(3);
        expect(createSaveListener.mock.calls.map(([, cfg]) => cfg.targetName)).toEqual(['Goblin', 'Orc', 'Troll']);

        const saveLogs = addEntry.mock.calls.filter(c => c[1].type === 'save_result').map(c => c[1]);
        expect(saveLogs.map(l => [l.targetName, l.success])).toEqual([
            ['Goblin', false],
            ['Orc', true],
            ['Troll', false],
        ]);

        expect(addCondition.mock.calls.map(c => c[0].creatureName)).toEqual(['Goblin', 'Troll']);
        expect(addExpiration.mock.calls.map(c => c[0].targetName)).toEqual(['Goblin', 'Troll']);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Compulsion',
                description: '2 of 3 target(s) affected by Compulsion and became Charmed.',
            },
        });
        const summary = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.description.startsWith('Compulsion cast:'));
        expect(summary.description).toBe('Compulsion cast: 2 of 3 target(s) affected. Targets: Goblin, Orc, Troll. 1 succeeded on WIS save.');
    });

    it('every log rejection is caught: enforcement still completes and each catch arm logs once', async () => {
        addEntry.mockRejectedValue(new Error('Log failed'));
        seedSaves(['Goblin']);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await applyCompulsionEffect(spell, playerStats, campaignName, mapName, ['Goblin']);

        // a broken log service must never block the charm write or the popup
        expect(addCondition).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Compulsion',
                description: '1 of 1 target(s) affected by Compulsion and became Charmed.',
            },
        });

        const arms = consoleError.mock.calls.map(c => String(c[0]));
        expect(arms.sort()).toEqual([
            '[compulsionService] Error logging cast:',
            '[compulsionService] Error logging condition:',
            '[compulsionService] Error logging save:',
            '[compulsionService] Error logging summary:',
        ]);
    });
});
