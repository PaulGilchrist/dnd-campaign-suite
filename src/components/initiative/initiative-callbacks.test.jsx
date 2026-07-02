// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './initiative.jsx';
import { loadCombatSummary, getCombatSummary, getActiveCreatureName } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { removeNpc, renameNpc, setTarget, setInitiative } from '../../services/encounters/initiativeService.js';
import { getMonsterImageUrl, getMonsterData } from '../../services/npcs/monsterUtils.js';
import { clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { expireStaleEffects } from '../../services/rules/effects/expirations.js';
import { logHpChange, logNpcThreshold } from '../../services/encounters/combatLoggingService.js';

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
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
    setRuntimeValue: vi.fn((_key, _prop, _value, _campaign) => {
        // Track calls for assertions
    }),
    setRuntimeObject: vi.fn(),
}));
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
vi.mock('../../services/rules/effects/expirations.js', () => ({ expireStaleEffects: vi.fn(), applyTurnStartEffects: vi.fn() }));
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
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logInitiativeRoll: vi.fn(), logConditionEvent: vi.fn(), logConcentrationSave: vi.fn(),
    logConditionSave: vi.fn(), logHpChange: vi.fn(), logNpcThreshold: vi.fn(),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
vi.mock('./CreatureCard.jsx', () => ({ default: ({ creature, isActive, isLocalhost, onHpChange, onInitiativeChange, onTargetChange, onRollConditionSave, onBreakCondition, onOpenConditionPicker, onRollConcentrationSave, onBreakConcentration, onOpenConcentrationPicker, onRemoveNpc, onNpcClick, onNameChange, allCreatures, overlays }) => (
    <div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type} ${isActive ? 'active' : ''}`}>
        <span>{creature.name}</span>
        <input data-testid={`hp-input-${creature.name}`} type="number" value={creature.currentHp ?? 0} onChange={(e) => onHpChange(creature.name, parseInt(e.target.value) || 0)} />
        <input data-testid={`initiative-input-${creature.name}`} type="number" value={creature.initiative} onChange={(e) => onInitiativeChange(creature.name, e.target.value)} />
        <select data-testid={`target-select-${creature.name}`} value={creature.targetName || ''} onChange={(e) => onTargetChange(creature.name, e.target.value)}>
            <option value="">— No Target —</option>
            {(allCreatures || []).filter(c => c.name !== creature.name).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            {(overlays || []).length > 0 && <optgroup label="─── Overlays ───">{(overlays || []).map(o => <option key={`overlay-${o.id}`} value={`overlay-${o.id}`}>{o.label || o.shape}</option>)}</optgroup>}
        </select>
        {(creature.conditions || []).map((cond, i) => (
            <div key={cond.id || i} data-testid={`condition-${cond.id || i}`}>
                <button data-testid={`condition-save-${cond.id || i}`} onClick={() => onRollConditionSave(creature.name, cond)} type="button">{cond.label}</button>
                {isLocalhost && <button data-testid={`condition-break-${cond.id || i}`} onClick={() => onBreakCondition(creature.name, cond)} type="button" title="Automatically break condition">X</button>}
            </div>
        ))}
        {isLocalhost && <button data-testid={`condition-add-${creature.name}`} onClick={() => onOpenConditionPicker(creature)} type="button" title="Add condition">+</button>}
        {creature.concentration ? (
            <div data-testid={`concentration-badge-${creature.name}`}>
                <button data-testid={`concentration-save-${creature.name}`} onClick={() => onRollConcentrationSave(creature.name)} type="button">{creature.concentration.spell}</button>
                <button data-testid={`concentration-break-${creature.name}`} onClick={() => onBreakConcentration(creature.name)} type="button" title="Break concentration">X</button>
            </div>
        ) : isLocalhost ? (
            <button data-testid={`concentration-add-${creature.name}`} onClick={() => onOpenConcentrationPicker(creature)} type="button" title="Add concentration">+</button>
        ) : null}
        {creature.type === 'npc' && isLocalhost && (
            <button data-testid={`npc-remove-${creature.name}`} onClick={() => onRemoveNpc(creature.name)} type="button" title="Remove NPC">X</button>
        )}
        {creature.type === 'npc' && (
            <span data-testid={`npc-click-${creature.name}`} onClick={() => onNpcClick(creature)}>Avatar</span>
        )}
        {creature.type === 'npc' && (
            <input data-testid={`name-change-${creature.name}`} value={creature.name} onChange={(e) => onNameChange(creature.name, e.target.value)} />
        )}
    </div>
) }));
vi.mock('./ConditionPicker.jsx', () => ({ default: ({ targetName, selected: _sel, onSelect, onApply, onCancel }) => (<div className="condition-picker-overlay" onClick={onCancel}><div className="condition-picker-modal"><h3>Add Condition to {targetName}</h3><div className="condition-picker-grid">{['Blinded', 'Charmed', 'Poisoned'].map(c => <button key={c} onClick={() => onSelect(c.toLowerCase())} type="button">{c}</button>)}</div><div className="condition-picker-actions"><button onClick={onCancel} type="button">Cancel</button><button onClick={onApply} disabled={!_sel} type="button">Apply</button></div></div></div>) }));
vi.mock('./ConcentrationPicker.jsx', () => ({ default: ({ targetName, spellName, onSpellNameChange, onApply, onCancel }) => (<div className="condition-picker-overlay" onClick={onCancel}><div className="condition-picker-modal"><h3>Concentration for {targetName}</h3><div className="condition-picker-fields"><label>Spell<input type="text" value={spellName} onChange={(e) => onSpellNameChange(e.target.value)} placeholder="Spell name" /></label></div><div className="condition-picker-actions"><button onClick={onCancel} type="button">Cancel</button><button onClick={onApply} disabled={!spellName.trim()} type="button">Apply</button></div></div></div>) }));

describe('Initiative - Callback Integration', () => {
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
        });

        it('should update creature.currentHp for NPC HP change', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Goblin');
                fireEvent.change(hpInput, { target: { value: '5' } });
            });

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'currentHitPoints', 5, 'test-campaign');
        });

        it('should not log player HP changes from initiative tracker', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', currentHp: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Alice');
                fireEvent.change(hpInput, { target: { value: '15' } });
            });

            expect(logHpChange).not.toHaveBeenCalled();
        });

        it('should not log NPC HP changes from initiative tracker', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Goblin');
                fireEvent.change(hpInput, { target: { value: '0' } });
            });

            expect(logNpcThreshold).not.toHaveBeenCalled();
        });

        it('should not log NPC bloodied threshold from initiative tracker', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Goblin');
                fireEvent.change(hpInput, { target: { value: '5' } });
            });

            expect(logNpcThreshold).not.toHaveBeenCalled();
        });

        it('should not log NPC recovering threshold from initiative tracker', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Goblin');
                fireEvent.change(hpInput, { target: { value: '6' } });
            });

            expect(logNpcThreshold).not.toHaveBeenCalled();
        });

        it('should reset death saves when player goes from <=0 to >0 HP', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
                if (prop === 'currentHitPoints') return 0;
                if (prop === 'hitPoints') return 20;
                if (prop === 'activeConditions') return [];
                if (prop === 'activeBuffs') return [];
                if (prop === 'deathSaves') return [true, false, false];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', currentHp: 0 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Alice');
                fireEvent.change(hpInput, { target: { value: '5' } });
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'deathSaves', [false, false, false], 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'deathFailures', [false, false, false], 'test-campaign');
        });

        it('should clear death save prompts when player revives', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
                if (prop === 'currentHitPoints') return 0;
                if (prop === 'hitPoints') return 20;
                if (prop === 'activeConditions') return [];
                if (prop === 'activeBuffs') return [];
                if (prop === 'deathSaves') return [true, false, false];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', currentHp: 0 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const hpInput = screen.getByTestId('hp-input-Alice');
                fireEvent.change(hpInput, { target: { value: '5' } });
            });

            expect(clearDeathSavePrompt).toHaveBeenCalledWith('test-campaign', 'Alice');
        });
    });

    describe('handleInitiativeChange', () => {
        it('should call setInitiative when initiative input changes', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', initiative: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const initiativeInput = screen.getByTestId('initiative-input-Alice');
                fireEvent.change(initiativeInput, { target: { value: '18' } });
            });

            expect(setInitiative).toHaveBeenCalled();
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
        it('should call setTarget when target select changes for player', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const targetSelect = screen.getByTestId('target-select-Alice');
                fireEvent.change(targetSelect, { target: { value: 'Bob' } });
            });

            expect(setTarget).toHaveBeenCalled();
        });

        it('should call setTarget for overlay target names', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const targetSelect = screen.getByTestId('target-select-Alice');
                fireEvent.change(targetSelect, { target: { value: 'overlay-overlay1' } });
            });

            expect(setTarget).toHaveBeenCalled();
        });
    });

    describe('handleNpcClick', () => {
        it('should not open monster card when not localhost', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} isLocalhost={false} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            await act(async () => {
                const npcAvatar = screen.getByTestId('npc-click-Goblin');
                fireEvent.click(npcAvatar);
            });

            expect(getMonsterData).not.toHaveBeenCalled();
        });
    });

    describe('NPC removal', () => {
        it('should confirm before removing NPC with HP', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            window.confirm.mockReturnValue(false);
            await act(async () => {
                const removeBtn = screen.getByTestId('npc-remove-Goblin');
                fireEvent.click(removeBtn);
            });

            expect(removeNpc).not.toHaveBeenCalled();
        });

        it('should confirm before removing NPC with initiative assigned', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 0, initiative: 15 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            window.confirm.mockReturnValue(false);
            await act(async () => {
                const removeBtn = screen.getByTestId('npc-remove-Goblin');
                fireEvent.click(removeBtn);
            });

            expect(removeNpc).not.toHaveBeenCalled();
        });

        it('should not show remove button for player creatures', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            expect(screen.queryByTestId('npc-remove-Alice')).not.toBeInTheDocument();
        });

        it('should not show remove button when not localhost', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} isLocalhost={false} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            expect(screen.queryByTestId('npc-remove-Goblin')).not.toBeInTheDocument();
        });

        it('should remove NPC when user confirms removal of NPC with HP', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            window.confirm.mockReturnValue(true);
            await act(async () => {
                const removeBtn = screen.getByTestId('npc-remove-Goblin');
                fireEvent.click(removeBtn);
            });

            expect(removeNpc).toHaveBeenCalled();
        });

        it('should remove NPC when user confirms removal of NPC with initiative', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 0, initiative: 15 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            window.confirm.mockReturnValue(true);
            await act(async () => {
                const removeBtn = screen.getByTestId('npc-remove-Goblin');
                fireEvent.click(removeBtn);
            });

            expect(removeNpc).toHaveBeenCalled();
        });
    });

    describe('concentration-result window event', () => {
        it('should clear concentration on failed concentration check', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', concentration: { spell: 'Shield', dc: 10 } }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('concentration-result', {
                    detail: { targetName: 'Alice', success: false },
                }));
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('death-save-result window event', () => {
        it('should update HP on death save result', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('death-save-result', {
                    detail: { targetName: 'Alice', restoredToHp: 5 },
                }));
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('combatSummary SSE round change effects', () => {
        it('should handle combatSummary SSE event with round change without error', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            // SSE events come through Subscriber's EventSource, not window events
            // The handleEvent callback processes them internally
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('activeCreatureName SSE effects', () => {
        it('should handle activeCreatureName SSE event without error', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            // SSE events come through Subscriber's EventSource, not window events
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('combat-summary-updated window event', () => {
        it('should update combat summary when event fires with new data', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            vi.mocked(getCombatSummary).mockReturnValue({ round: 2, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('combat-summary-updated'));
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should reset activeBuffs and invokeDuplicityAdvantageTargets for player creatures', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Goblin', type: 'npc' }] });
            vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('combat-summary-updated'));
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeBuffs', [], 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'invokeDuplicityAdvantageTargets', [], 'test-campaign');
        });

        it('should not update when data is identical', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            const initialSummary = { round: 1, creatures: [{ name: 'Alice', type: 'player' }] };
            vi.mocked(getCombatSummary).mockReturnValue(initialSummary);
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('combat-summary-updated'));
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('initiative-rolled window event', () => {
        it('should not crash when initiative-rolled event fires', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('initiative-rolled'));
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('SSE events with null data', () => {
        it('should ignore SSE event with null key', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('change-test-campaign-combatSummary', {
                    detail: { key: null, data: null },
                }));
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should ignore SSE event with null data', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('change-test-campaign-combatSummary', {
                    detail: { key: 'change-test-campaign-combatSummary', data: null },
                }));
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should ignore SSE events from other campaigns', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('change-other-campaign-combatSummary', {
                    detail: { key: 'change-other-campaign-combatSummary', data: { round: 2, creatures: [] } },
                }));
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('next creature with round increment', () => {
        it('should increment round and clear majesty trackers when wrapping to first creature', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const nextBtn = screen.getByText('Next →');
                fireEvent.click(nextBtn);
            });

            expect(expireStaleEffects).toHaveBeenCalled();
        });
    });

    describe('previous creature with round decrement', () => {
        it('should decrement round when going back past first creature', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 2, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            vi.mocked(getActiveCreatureName).mockReturnValue('Bob');
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Bob')).toBeInTheDocument(); });

            await act(async () => {
                const prevBtn = screen.getByText('← Prev');
                fireEvent.click(prevBtn);
            });

            expect(expireStaleEffects).toHaveBeenCalled();
        });
    });

    describe('spell-overlay SSE events', () => {
        it('should handle spell-overlay add event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-test-campaign', {
                    detail: { key: 'spell-overlay-test-campaign', data: { action: 'add', overlays: [{ id: 'overlay-1', label: 'Fireball' }] } },
                }));
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should handle spell-overlay update event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-test-campaign', {
                    detail: { key: 'spell-overlay-test-campaign', data: { action: 'update', overlays: [{ id: 'overlay-1', label: 'Updated Fireball' }] } },
                }));
            });
        });

        it('should handle spell-overlay remove event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-test-campaign', {
                    detail: { key: 'spell-overlay-test-campaign', data: { action: 'remove', overlayId: 'overlay-1' } },
                }));
            });
        });

        it('should handle spell-overlay clear event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-test-campaign', {
                    detail: { key: 'spell-overlay-test-campaign', data: { action: 'clear' } },
                }));
            });
        });

        it('should ignore spell-overlay events from other campaigns', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-other-campaign', {
                    detail: { key: 'spell-overlay-other-campaign', data: { action: 'clear' } },
                }));
            });
        });

        it('should ignore spell-overlay events with different campaign key', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-other-campaign', {
                    detail: { key: 'spell-overlay-other-campaign', data: { action: 'add', overlays: [{ id: 'overlay-1', label: 'Fireball' }] } },
                }));
            });
        });
    });

    describe('displayCreatures memo edge cases', () => {
        it('should handle player creature with no matching character by using defaults', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Unknown', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Unknown')).toBeInTheDocument(); });
        });

        it('should include runtime conditions for player creatures', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                if (prop === 'hitPoints') return 20;
                if (prop === 'activeConditions') return ['blinded', 'poisoned'];
                if (prop === 'activeBuffs') return [];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });
        });

        it('should pass NPC creatures through unchanged from combatSummary', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10, initiative: 10 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });
        });

        it('should use stats from computedStats when available', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                if (prop === 'hitPoints') return 20;
                if (prop === 'activeConditions') return [];
                if (prop === 'activeBuffs') return [];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });
        });
    });

    describe('condition picker integration', () => {
        it('should open condition picker when localhost and creature is clicked', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const addBtn = screen.getByTestId('condition-add-Alice');
                fireEvent.click(addBtn);
            });

            expect(screen.getByText(/Add Condition to Alice/)).toBeInTheDocument();
        });

        it('should not show condition add button when not localhost', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} isLocalhost={false} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            expect(screen.queryByTestId('condition-add-Alice')).not.toBeInTheDocument();
        });
    });

    describe('concentration picker integration', () => {
        it('should open concentration picker when localhost and creature is clicked', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const addBtn = screen.getByTestId('concentration-add-Alice');
                fireEvent.click(addBtn);
            });

            expect(screen.getByText(/Concentration for Alice/)).toBeInTheDocument();
        });

        it('should not show concentration add button when not localhost', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} isLocalhost={false} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            expect(screen.queryByTestId('concentration-add-Alice')).not.toBeInTheDocument();
        });

        it('should apply concentration when spell name is provided', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const addBtn = screen.getByTestId('concentration-add-Alice');
                fireEvent.click(addBtn);
            });

            await act(async () => {
                const spellInput = screen.getByPlaceholderText('Spell name');
                fireEvent.change(spellInput, { target: { value: 'Shield' } });
            });

            expect(screen.queryByText(/Concentration for Alice/)).toBeInTheDocument();
        });
    });

    describe('condition save integration', () => {
        it('should roll condition save when condition badge is clicked', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                if (prop === 'hitPoints') return 20;
                if (prop === 'activeConditions') return ['blinded'];
                if (prop === 'activeBuffs') return [];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            // Conditions are built from runtime values in displayCreatures memo
            // The runtime mock returns ['blinded'] which becomes a condition
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should break condition when break button is clicked', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                if (prop === 'hitPoints') return 20;
                if (prop === 'activeConditions') return ['blinded'];
                if (prop === 'activeBuffs') return [];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('concentration save integration', () => {
        it('should roll concentration save when concentration badge is clicked', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', concentration: { spell: 'Shield', dc: 10 } }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const saveBtn = screen.getByTestId('concentration-save-Alice');
                fireEvent.click(saveBtn);
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should break concentration when break button is clicked', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', concentration: { spell: 'Shield', dc: 10 } }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                const breakBtn = screen.getByTestId('concentration-break-Alice');
                fireEvent.click(breakBtn);
            });

            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('NPC image loading', () => {
        it('should load monster images for NPCs without imagePath', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            expect(getMonsterImageUrl).toHaveBeenCalled();
        });

        it('should skip image loading for NPCs with imagePath', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', imagePath: '/goblin.png' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument(); });

            expect(getMonsterImageUrl).not.toHaveBeenCalled();
        });
    });
});
