// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import storage from '../../services/ui/storage.js';
import { removeNpc, renameNpc, setTarget, setInitiative } from '../../services/encounters/initiativeService.js';

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
    const syncStateStore = new Map();
    return {
        getStore: vi.fn(() => syncStateStore),
        useSyncedState: vi.fn((key, prop, defaultValue) => {
            const storeKey = `${key}-${prop}`;
            if (!syncStateStore.has(storeKey)) {
                syncStateStore.set(storeKey, { value: defaultValue, setter: null });
            }
            const entry = syncStateStore.get(storeKey);
            if (!entry.setter) {
                entry.setter = vi.fn((newValue) => { entry.value = newValue; });
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
            if (_prop === 'targetEffects') return [];
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
    CONDITIONS: [
        { key: 'blinded', label: 'Blinded' }, { key: 'charmed', label: 'Charmed' },
        { key: 'deafened', label: 'Deafened' }, { key: 'frightened', label: 'Frightened' },
        { key: 'grappled', label: 'Grappled' }, { key: 'incapacitated', label: 'Incapacitated' },
        { key: 'invisible', label: 'Invisible' }, { key: 'paralyzed', label: 'Paralyzed' },
        { key: 'petrified', label: 'Petrified' }, { key: 'poisoned', label: 'Poisoned' },
        { key: 'prone', label: 'Prone' }, { key: 'restrained', label: 'Restrained' },
        { key: 'stunned', label: 'Stunned' }, { key: 'unconscious', label: 'Unconscious' },
    ],
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
    getNextCreatureName: vi.fn((cs, active) => { const idx = cs.creatures.findIndex((c) => c.name === active); if (idx < cs.creatures.length - 1) return { newActiveName: cs.creatures[idx + 1].name, roundIncrement: false }; return { newActiveName: cs.creatures[0].name, roundIncrement: true }; }),
    getPreviousCreatureName: vi.fn((cs, active) => { const idx = cs.creatures.findIndex((c) => c.name === active); if (idx > 0) return { newActiveName: cs.creatures[idx - 1].name, roundDecrement: false }; return { newActiveName: cs.creatures[cs.creatures.length - 1].name, roundDecrement: true }; }),
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
vi.mock('./CreatureCard.jsx', () => ({ default: ({ creature, isActive, isLocalhost, onHpChange, onInitiativeChange, onTargetChange, onRemoveNpc, onNameChange }) => (
    <div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type} ${isActive ? 'active' : ''}`}>
        <span>{creature.name}</span>
        <input data-testid={`hp-input-${creature.name}`} type="number" value={creature.currentHp ?? 0} onChange={(e) => onHpChange && onHpChange(creature.name, parseInt(e.target.value) || 0)} />
        <input data-testid={`initiative-input-${creature.name}`} type="number" value={creature.initiative} onChange={(e) => onInitiativeChange && onInitiativeChange(creature.name, e.target.value)} />
        <select data-testid={`target-select-${creature.name}`} value={creature.targetName || ''} onChange={(e) => onTargetChange && onTargetChange(creature.name, e.target.value)}>
            <option value="">— No Target —</option>
        </select>
        {creature.type !== 'player' && isLocalhost && (
            <button data-testid={`npc-remove-${creature.name}`} onClick={() => onRemoveNpc && onRemoveNpc(creature.name)} type="button" title="Remove NPC">X</button>
        )}
        {creature.type !== 'player' && (
            <input data-testid={`name-change-${creature.name}`} value={creature.name} onChange={(e) => onNameChange && onNameChange(creature.name, e.target.value)} />
        )}
    </div>
) }));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => (<div data-testid="effect-adder"><span>{targetName}</span></div>) }));

describe('Initiative - Creature & NPC Handlers', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn(() => true);
        Element.prototype.scrollIntoView = vi.fn();
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

    describe('handleCreatureHpChange', () => {
        it('should call setRuntimeValue for player HP change', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', currentHp: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Alice');
                fireEvent.change(hpInput, { target: { value: '15' } });
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'currentHitPoints', 15, 'test-campaign');
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
        });

        it.each([
            { oldHp: 0, newHp: 5, desc: 'resets death saves when going from <=0 to >0 HP', shouldReset: true },
            { oldHp: -5, newHp: 0, desc: 'does NOT reset death saves when going from negative to 0 HP', shouldReset: false },
            { oldHp: 10, newHp: -3, desc: 'does NOT reset death saves when going from positive to negative HP', shouldReset: false },
        ])('death saves $desc', async ({ oldHp, newHp, shouldReset }) => {
            vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
                if (prop === 'currentHitPoints') return oldHp;
                if (prop === 'hitPoints') return 20;
                if (prop === 'activeConditions') return [];
                if (prop === 'activeBuffs') return [];
                if (prop === 'deathSaves') return [true, false, false];
                if (prop === 'deathFailures') return [false, false, false];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', currentHp: oldHp }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Alice');
                fireEvent.change(hpInput, { target: { value: String(newHp) } });
            });

            if (shouldReset) {
                expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'deathSaves', [false, false, false], 'test-campaign');
                expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'deathFailures', [false, false, false], 'test-campaign');
                expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'isDead', 0, 'test-campaign');
                expect(clearDeathSavePrompt).toHaveBeenCalledWith('test-campaign', 'Alice');
            } else {
                expect(setRuntimeValue).not.toHaveBeenCalledWith('Alice', 'deathSaves', expect.any(Array), 'test-campaign');
                expect(setRuntimeValue).not.toHaveBeenCalledWith('Alice', 'isDead', 0, 'test-campaign');
                expect(clearDeathSavePrompt).not.toHaveBeenCalled();
            }
        });

        it('should update NPC HP directly without setRuntimeValue for currentHitPoints', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Goblin');
                fireEvent.change(hpInput, { target: { value: '5' } });
            });

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'currentHitPoints', expect.any(Number), 'test-campaign');
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
        });

        it('should not change HP when value is the same', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                if (prop === 'hitPoints') return 20;
                if (prop === 'activeConditions') return [];
                if (prop === 'activeBuffs') return [];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', currentHp: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Alice');
                fireEvent.change(hpInput, { target: { value: '10' } });
            });

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Alice', 'currentHitPoints', 10, 'test-campaign');
        });
    });

    describe('handleClear (CLA-100)', () => {
        it('resets the Dread Ambush once-per-combat latch for player creatures', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 2, creatures: [{ name: 'Alice', type: 'player', currentHp: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                fireEvent.click(screen.getByText('Clear'));
            });

            for (const name of ['Alice', 'Bob']) {
                expect(setRuntimeValue).toHaveBeenCalledWith(name, 'dreadAmbushSpeedActive', null, 'test-campaign');
            }
        });
    });

    describe('handleInitiativeChange', () => {
        it('should call setInitiative with combatSummary, creatureName, and value', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', initiative: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const initiativeInput = screen.getByTestId('initiative-input-Alice');
                fireEvent.change(initiativeInput, { target: { value: '18' } });
            });

            expect(setInitiative).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
        });
    });

    describe('handleNameChange', () => {
        it('should call renameNpc when NPC name changes', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            await act(async () => {
                const nameInput = screen.getByTestId('name-change-Goblin');
                fireEvent.change(nameInput, { target: { value: 'Kobold' } });
            });

            expect(renameNpc).toHaveBeenCalled();
        });
    });

    describe('handleTargetChange', () => {
        it('should call setTarget when target select changes to another creature', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const targetSelect = screen.getByTestId('target-select-Alice');
                fireEvent.change(targetSelect, { target: { value: 'Bob' } });
            });

            expect(setTarget).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
        });

        it('should call setTarget when target is an overlay', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const targetSelect = screen.getByTestId('target-select-Alice');
                fireEvent.change(targetSelect, { target: { value: 'overlay-fireball' } });
            });

            expect(setTarget).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
        });
    });

    describe('handleRemoveNpc', () => {
        it('should confirm before removing NPC with HP', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            window.confirm.mockReturnValue(false);
            await act(async () => {
                const removeBtn = screen.getByTestId('npc-remove-Goblin');
                fireEvent.click(removeBtn);
            });

            expect(window.confirm).toHaveBeenCalledWith('Goblin has 5 HP. Remove anyway?');
            expect(removeNpc).not.toHaveBeenCalled();
        });

        it('should confirm before removing NPC with initiative assigned but 0 HP', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 0, initiative: '12' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            window.confirm.mockReturnValue(false);
            await act(async () => {
                const removeBtn = screen.getByTestId('npc-remove-Goblin');
                fireEvent.click(removeBtn);
            });

            expect(window.confirm).toHaveBeenCalledWith('Goblin has initiative assigned. Remove anyway?');
            expect(removeNpc).not.toHaveBeenCalled();
        });

        it('should remove NPC when user confirms', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            window.confirm.mockReturnValue(true);
            await act(async () => {
                const removeBtn = screen.getByTestId('npc-remove-Goblin');
                fireEvent.click(removeBtn);
            });

            expect(removeNpc).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
        });

        it('should not confirm when NPC has 0 HP and no initiative', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 0, initiative: '' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            await act(async () => {
                const removeBtn = screen.getByTestId('npc-remove-Goblin');
                fireEvent.click(removeBtn);
            });

            expect(window.confirm).not.toHaveBeenCalled();
            expect(removeNpc).toHaveBeenCalled();
        });
    });
});
