// @maintained-by-ai
// Owned contract: Initiative.jsx's two INLINE window-event listeners —
//   concentration-result (Initiative.jsx:457-474) and death-save-result
//   (Initiative.jsx:476-494). These listeners are not factory-owned: no lane
//   in createConcentrationHandlers (#833-#835), createCreatureHandlers
//   (#836-#837), createEffectAdderHandlers (#838-#839), createNpcClickHandler
//   (#840-#846) or createRollConditionSaveHandler (#847) dispatches or handles
//   these events, and initiative.test.jsx / initiative.overlays.test.jsx never
//   fire them (verified by grep, 2026-10-19). Dispatch-side contracts live in
//   ConcentrationPromptModal/DeathSavePromptModal tests; this file pins only
//   what the listeners DO with a dispatched event: name matching (exact and
//   "Name " prefix), runtime-store vs combatSummary persistence split,
//   concentration teardown, and no-op honesty on every guard branch.
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import storage from '../../services/ui/storage.js';
import { cleanupConcentrationEffects } from '../../services/combat/concentration/concentrationService.js';

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
    const syncStateStore = new Map();
    return {
        getStore: vi.fn(() => syncStateStore),
        // L5-001: TurnEconomyStrip subscribes via useRuntimeValue; null ⇒ enforcement off.
        useRuntimeValue: vi.fn(() => null),
        useSyncedState: vi.fn((key, prop, defaultValue) => {
            const storeKey = `${key}-${prop}`;
            if (!syncStateStore.has(storeKey)) {
                syncStateStore.set(storeKey, { value: defaultValue, setter: null });
            }
            const entry = syncStateStore.get(storeKey);
            if (!entry.setter) {
                entry.setter = vi.fn((newValue) => {
                    entry.value = newValue;
                });
            }
            return [entry.value, entry.setter];
        }),
        listeners: new Map(),
        getRuntimeValue: vi.fn((_key, _prop, _campaign) => {
            if (_prop === 'currentHitPoints') return 10;
            if (_prop === 'hitPoints') return 10;
            if (_prop === 'activeConditions') return [];
            if (_prop === 'activeBuffs') return [];
            if (_prop === 'inspiringMovementNoOA') return false;
            if (_prop === 'deathSaves') return [false, false, false];
            if (_prop === 'deathFailures') return [false, false, false];
            if (_prop === 'targetEffects') return [];
            if (_prop === 'allFeatures') return [];
            return null;
        }),
        setRuntimeValue: vi.fn((_key, _prop, _value, _campaign) => {}),
        setRuntimeObject: vi.fn(),
    };
});
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({ clearDeathSavePrompt: vi.fn() }));
vi.mock('../../services/npcs/monsterUtils.js', () => ({ getMonsterImageUrl: vi.fn(() => Promise.resolve(null)), getMonsterData: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
    CONDITIONS: [],
}));
vi.mock('../../services/npcs/npcsService.js', () => ({ loadNPCs: vi.fn(() => Promise.resolve({ npcs: [] })) }));
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({ npcToMonsterFormat: vi.fn(() => null), npcHasStatBlock: vi.fn(() => true) }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ expireStaleEffects: vi.fn(), applyTurnStartEffects: vi.fn(), applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/encounters/combatData.js', () => {
    const mock = {
        loadCombatSummary: vi.fn(() => Promise.resolve(null)),
        getCombatSummary: vi.fn(() => null),
        getActiveCreatureName: vi.fn(() => null),
        setCombatSummaryCache: vi.fn(),
    };
    return mock;
});
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({ clearPerRoundMajestyTrackers: vi.fn() }));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    setupCreatures: vi.fn((characters) => characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }))),
    addNpc: vi.fn((cs) => { cs.creatures.push({ name: 'NPC 1', type: 'npc', initiative: '', targetName: null, ac: 10, resistances: [], immunities: [], conditions: [], concentration: null, maxHp: 10, currentHp: 10, saveBonuses: {} }); return 1; }),
    removeNpc: vi.fn(),
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(),
    rollNpcInitiative: vi.fn(() => ({ roll: 15, bonus: 2, total: 17 })),
    renameNpc: vi.fn(() => Promise.resolve()),
    setTarget: vi.fn(),
    clearCombat: vi.fn((characters) => ({ round: 1, creatures: characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null })) })),
    mergeCombatSummaryWithCharacters: vi.fn((initialSummary, characters) => {
        const names = new Set((initialSummary?.creatures ?? []).map(c => c.name));
        const newCreatures = characters.filter(ch => !names.has(ch.name)).map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }));
        return { round: initialSummary?.round ?? 1, creatures: [...(initialSummary?.creatures ?? []), ...newCreatures] };
    }),
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    removeCondition: vi.fn(), addCondition: vi.fn(),
    buildConditionPopup: vi.fn(() => ({ name: 'Test Creature', condition: 'Blinded', type: 'save', rolls: [15], bonus: 2, targetName: 'Test Creature', targetAc: 10, hit: false, success: true, dc: 10 })),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    breakConcentration: vi.fn(() => 'Shield'), addConcentration: vi.fn(),
    buildConcentrationPopup: vi.fn(() => ({ name: 'Test Creature', condition: null, spell: 'Shield', type: 'save', rolls: [15], bonus: 2, targetName: 'Test Creature', targetAc: 10, hit: false, success: true, dc: 10 })),
    cleanupConcentrationEffects: vi.fn(),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logInitiativeRoll: vi.fn(), logConditionEvent: vi.fn(), logConcentrationSave: vi.fn(),
    logConditionSave: vi.fn(), logHpChange: vi.fn(), logNpcThreshold: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
vi.mock('./CreatureCard.jsx', () => ({ default: ({ creature }) => (
    <div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type}`}>
        <span>{creature.name}</span>
    </div>
) }));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => (<div data-testid="effect-adder"><span>{targetName}</span></div>) }));

describe('Initiative window-event listeners', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        props = {
            characters: [
                { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } },
                { name: 'Bob', computedStats: { hitPoints: 15, currentHitPoints: 15, armorClass: 14 } },
            ],
            campaignName: 'test-campaign',
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: 'test-map',
        };
    });

    // Mount the container with a loaded combat summary and wait until the
    // listeners have a non-null combatSummary closure (cards rendered).
    const renderWithSummary = async (summary, ...cardNames) => {
        vi.mocked(loadCombatSummary).mockResolvedValue(summary);
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => {
            for (const name of cardNames) {
                expect(screen.queryByTestId(`creature-card-${name}`)).toBeInTheDocument();
            }
        });
    };

    const dispatchEvent = async (event, detail) => {
        await act(async () => {
            window.dispatchEvent(new CustomEvent(event, { detail }));
        });
    };

    const latestStoredSummary = () => {
        const calls = storage.set.mock.calls.filter(([key]) => key === 'combatSummary');
        return calls[calls.length - 1]?.[1];
    };

    const writeCounts = () => ({
        storage: storage.set.mock.calls.length,
        runtime: setRuntimeValue.mock.calls.length,
        cleanup: cleanupConcentrationEffects.mock.calls.length,
    });

    describe('death-save-result', () => {
        it('restores a player via the runtime store without stamping HP into combatSummary', async () => {
            await renderWithSummary({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] }, 'Alice');

            await dispatchEvent('death-save-result', { targetName: 'Alice', restoredToHp: 5 });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'currentHitPoints', 5, 'test-campaign');
            expect(latestStoredSummary().creatures.find(c => c.name === 'Alice').currentHp).toBeUndefined();
        });

        it('restores an NPC by prefix-matched full name and persists currentHp in combatSummary', async () => {
            await renderWithSummary(
                { round: 1, creatures: [{ name: 'Goblin 1', type: 'npc', currentHp: 10 }] },
                'Goblin 1'
            );

            await dispatchEvent('death-save-result', { targetName: 'Goblin', restoredToHp: 3 });

            expect(setRuntimeValue).toHaveBeenCalledWith('Goblin 1', 'currentHitPoints', 3, 'test-campaign');
            expect(latestStoredSummary().creatures.find(c => c.name === 'Goblin 1').currentHp).toBe(3);
        });

        it.each([
            ['no restoredToHp (save succeeded)', { targetName: 'Goblin 1' }],
            ['no creature matches the target', { targetName: 'Goblin Slayer', restoredToHp: 5 }],
        ])('is ignored when %s', async (_label, detail) => {
            await renderWithSummary(
                { round: 1, creatures: [{ name: 'Goblin 1', type: 'npc', currentHp: 10 }] },
                'Goblin 1'
            );

            const before = writeCounts();
            await dispatchEvent('death-save-result', detail);

            expect(setRuntimeValue).toHaveBeenCalledTimes(before.runtime);
            expect(storage.set).toHaveBeenCalledTimes(before.storage);
        });
    });

    describe('concentration-result', () => {
        const withConcentration = () => ({
            round: 1,
            creatures: [{ name: 'Alice', type: 'player', concentration: { spell: 'Shield', dc: 10 } }],
        });

        it('breaks concentration on a failed save, persisting the cleared summary and cleaning up effects', async () => {
            await renderWithSummary(withConcentration(), 'Alice');

            await dispatchEvent('concentration-result', { targetName: 'Alice', success: false });

            expect(latestStoredSummary().creatures.find(c => c.name === 'Alice').concentration).toBeNull();
            expect(cleanupConcentrationEffects).toHaveBeenCalledWith('Alice', 'Shield', 'test-campaign');
        });

        it.each([
            ['the save succeeds', { targetName: 'Alice', success: true }],
            ['no creature matches the target', { targetName: 'Nobody', success: false }],
        ])('is a no-op when %s', async (_label, detail) => {
            await renderWithSummary(withConcentration(), 'Alice');

            const before = writeCounts();
            await dispatchEvent('concentration-result', detail);

            expect(storage.set).toHaveBeenCalledTimes(before.storage);
            expect(cleanupConcentrationEffects).toHaveBeenCalledTimes(before.cleanup);
        });
    });
});
