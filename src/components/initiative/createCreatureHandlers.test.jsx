// @maintained-by-ai
// Base lane for createCreatureHandlers.js: HP store writes, death-save resets, initiative/name/
// target/remove/add/clear contracts, plus the one component-level smoke that proves real Initiative
// wires GM inputs to these handlers (only face in this suite that does — CreatureCard.*.test.jsx
// render the card directly; initiative.test.jsx covers Clear/render/+NPC titles only).
// Lane split vs createCreatureHandlers.sp069.test.js (#836): hypno-break wiring is THEIRS
// exclusively — no hypno asserts here (breakHypnoticPatternOnDamage is a bare stub).
// The sp069 header complements this file: base HP store writes / death-save resets / NPC
// remove-name-target stay here ("complemented, not duplicated — keep as-is").
// Filtered remove payload literal is pinned in #825's lane — cited, not recomputed here.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import storage from '../../services/ui/storage.js';
import { removeNpc, renameNpc, setTarget, setInitiative, addNpc, clearCombat } from '../../services/encounters/initiativeService.js';
import { setSessionPhase } from '../../services/combat/sessionService.js';
import { autoAwardCombatRewards } from '../../services/items/autoRewardService.js';
import { maybeGrantThiefsReflexesSecondTurn } from '../../services/combat/thiefsReflexesService.js';
import { vanishSummonAtZeroHp } from '../../services/combat/summons/summonedCreatureService.js';
import { sweepNewCombatClocks } from '../../services/rules/effects/zoneDurationClock.js';

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
    const syncStateStore = new Map();
    return {
        getStore: vi.fn(() => syncStateStore),
        // L5-001: TurnEconomyStrip subscribes via useRuntimeValue; null ⇒ enforcement off.
        useRuntimeValue: vi.fn(() => null),
        // useLootHandlers subscribes to cross-tab loot-draft echoes via addStorageChangeListener.
        addStorageChangeListener: vi.fn(() => () => {}),
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
        getRuntimeValue: vi.fn((_key, _prop, _campaign) => null),
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
    isBareNpcPlaceholder: (c) => c.type === 'npc' && !c.monsterIndex && /^NPC \d+$/.test(c.name || ''),
    addNpc: vi.fn((cs) => { cs.creatures.push({ name: 'NPC 1', type: 'npc', initiative: '', targetName: null, ac: 10, maxHp: 10, currentHp: 10 }); return 1; }),
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
// Factory + component boundaries: session phase, auto-rewards, thieves' reflexes, summons,
// zone clocks (drainRoundWrapClocks is navigationHandlers'), hypno (sp069 lane owns asserts).
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    maybeGrantThiefsReflexesSecondTurn: vi.fn(),
    isSecondTurnEntry: vi.fn(() => false),
}));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({
    vanishSummonAtZeroHp: vi.fn(),
    stripSummonedFromCombatSummary: vi.fn((cs) => cs),
}));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({
    sweepNewCombatClocks: vi.fn(() => Promise.resolve()),
    drainRoundWrapClocks: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({ breakHypnoticPatternOnDamage: vi.fn(() => false) }));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
vi.mock('./CreatureCard.jsx', () => ({ default: ({ creature, isActive, isLocalhost, onHpChange, onInitiativeChange, onRemoveNpc }) => (
    <div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type} ${isActive ? 'active' : ''}`}>
        <span>{creature.name}</span>
        <input data-testid={`hp-input-${creature.name}`} type="number" value={creature.currentHp ?? 0} onChange={(e) => onHpChange && onHpChange(creature.name, parseInt(e.target.value) || 0)} />
        <input data-testid={`initiative-input-${creature.name}`} type="number" value={creature.initiative} onChange={(e) => onInitiativeChange && onInitiativeChange(creature.name, e.target.value)} />
        {creature.type !== 'player' && isLocalhost && (
            <button data-testid={`npc-remove-${creature.name}`} onClick={() => onRemoveNpc && onRemoveNpc(creature.name)} type="button" title="Remove NPC">X</button>
        )}
    </div>
) }));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => (<div data-testid="effect-adder"><span>{targetName}</span></div>) }));

const campaignName = 'test-campaign';

function makeHandlers(creatures, overrides = {}) {
    const combatSummary = { round: 1, creatures };
    const setCombatSummary = vi.fn();
    const setActiveCreatureName = vi.fn();
    const characters = [
        { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } },
        { name: 'Bob', computedStats: { hitPoints: 15, currentHitPoints: 15, armorClass: 14 } },
    ];
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary,
        setActiveCreatureName,
        characters,
        numOfNpc: creatures.filter((c) => c.type === 'npc').length,
        isLocalhost: true,
        ...overrides,
    });
    return { handlers, combatSummary, setCombatSummary, setActiveCreatureName, characters };
}

beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    Element.prototype.scrollIntoView = vi.fn();
    // Deterministic runtime reads: player oldHp lane default 10 (mirrors real store warm state).
    getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 10;
        if (prop === 'hitPoints') return 20;
        return null;
    });
});

describe('handleCreatureHpChange — store writes per lane', () => {
    it.each([
        { desc: 'player reduction writes runtime HP, card untouched', name: 'Alice', type: 'player', oldHp: 20, newHp: 15, mode: 'runtime' },
        { desc: 'player revived from 0 resets all death-save state', name: 'Alice', type: 'player', oldHp: 0, newHp: 5, mode: 'revive' },
        { desc: 'player dropped to 0 keeps death-save state', name: 'Alice', type: 'player', oldHp: -5, newHp: 0, mode: 'no-revive' },
        { desc: 'unchanged value hits the delta guard — zero writes', name: 'Alice', type: 'player', oldHp: 10, newHp: 10, mode: 'noop' },
        { desc: 'NPC reduction mutates the card, not the runtime store', name: 'Goblin', type: 'npc', oldHp: 10, newHp: 5, mode: 'card' },
        { desc: 'non-summon NPC dropped to 0 just mutates the card', name: 'Goblin', type: 'npc', oldHp: 3, newHp: 0, mode: 'card' },
        { desc: 'spell-summon zeroed at GM input vanishes (SP-114)', name: 'Sprite', type: 'npc', oldHp: 7, newHp: 0, summonedBy: 'Alice', summonSource: 'spell', mode: 'vanish' },
    ])('$desc', ({ name, type, oldHp, newHp, summonedBy, summonSource, mode }) => {
        getRuntimeValue.mockImplementation((_key, prop) => (prop === 'currentHitPoints' ? oldHp : null));
        const { handlers, combatSummary, setCombatSummary } = makeHandlers([
            { name, type, currentHp: oldHp, ...(summonedBy ? { summonedBy, summonSource } : {}) },
        ]);

        handlers.handleCreatureHpChange(name, newHp);

        if (mode === 'noop') {
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
            return;
        }

        expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, campaignName);
        if (type === 'player') {
            expect(setRuntimeValue).toHaveBeenCalledWith(name, 'currentHitPoints', newHp, campaignName);
            expect(combatSummary.creatures[0].currentHp).toBe(oldHp);
        } else {
            expect(combatSummary.creatures[0].currentHp).toBe(newHp);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({
                creatures: expect.arrayContaining([expect.objectContaining({ name, currentHp: newHp })]),
            }));
        }
        if (mode === 'revive') {
            expect(setRuntimeValue).toHaveBeenCalledWith(name, 'deathSaves', [false, false, false], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(name, 'deathFailures', [false, false, false], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(name, 'isDead', 0, campaignName);
            expect(clearDeathSavePrompt).toHaveBeenCalledWith(campaignName, name);
        }
        if (mode === 'no-revive') {
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(clearDeathSavePrompt).not.toHaveBeenCalled();
        }
        if (mode === 'vanish') {
            expect(vanishSummonAtZeroHp).toHaveBeenCalledWith(combatSummary.creatures[0], combatSummary, campaignName);
        } else {
            expect(vanishSummonAtZeroHp).not.toHaveBeenCalled();
        }
    });
});

describe('handleCreatureHpChange — max-HP edit lane (#854, onChange third arg)', () => {
    it.each([
        { desc: 'clamp down: current follows new base max', oldHp: 8, newHp: 5, newMax: 5, expectedCurrent: 5 },
        { desc: 'no clamp needed: current passes through, delta-0 no longer swallows the max write', oldHp: 3, newHp: 3, newMax: 5, expectedCurrent: 3 },
    ])('$desc — persists on card and broadcasts', ({ oldHp, newHp, newMax, expectedCurrent }) => {
        const { handlers, combatSummary, setCombatSummary } = makeHandlers([
            { name: 'Goblin', type: 'npc', currentHp: oldHp, maxHp: 10 },
        ]);

        handlers.handleCreatureHpChange('Goblin', newHp, newMax);

        expect(combatSummary.creatures[0].currentHp).toBe(expectedCurrent);
        expect(combatSummary.creatures[0].maxHp).toBe(newMax);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, campaignName);
        expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({
            creatures: [expect.objectContaining({ name: 'Goblin', currentHp: expectedCurrent, maxHp: newMax })],
        }));
    });

    it('two-arg current-HP edit leaves maxHp untouched', () => {
        const { handlers, combatSummary } = makeHandlers([
            { name: 'Goblin', type: 'npc', currentHp: 8, maxHp: 10 },
        ]);

        handlers.handleCreatureHpChange('Goblin', 4);

        expect(combatSummary.creatures[0].currentHp).toBe(4);
        expect(combatSummary.creatures[0].maxHp).toBe(10);
    });

    it('player lane ignores a max payload — runtime HP writes only, card max untouched', () => {
        const { handlers, combatSummary } = makeHandlers([
            { name: 'Alice', type: 'player', currentHp: 10, maxHp: 20 },
        ]);

        handlers.handleCreatureHpChange('Alice', 12, 15);

        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'currentHitPoints', 12, campaignName);
        expect(combatSummary.creatures[0].maxHp).toBe(20);
    });
});

describe('handleInitiativeChange', () => {
    it('stamps initiative, opens the encounter phase, checks Thief\'s Reflexes, persists', () => {
        const { handlers, combatSummary, setCombatSummary, characters } = makeHandlers([
            { name: 'Alice', type: 'player', currentHp: 20, initiative: 10 },
        ]);

        handlers.handleInitiativeChange('Alice', '18');

        expect(setInitiative).toHaveBeenCalledWith(combatSummary, 'Alice', '18');
        expect(setSessionPhase).toHaveBeenCalledWith({ campaignName, phase: 'encounter', changedBy: 'initiative tracker', reason: 'initiative recorded for Alice' });
        expect(maybeGrantThiefsReflexesSecondTurn).toHaveBeenCalledWith(combatSummary, 'Alice', campaignName, characters);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, campaignName);
        expect(setCombatSummary).toHaveBeenCalledTimes(1);
    });
});

describe('handleNameChange', () => {
    it('delegates rename payload, persists optimistically and after resolve', async () => {
        const campaignNpcs = [{ name: 'Goblin' }];
        const setNpcImages = vi.fn();
        const { handlers, combatSummary, setCombatSummary } = makeHandlers(
            [{ name: 'Goblin', type: 'npc', currentHp: 10 }],
            { campaignNpcs, setNpcImages },
        );

        handlers.handleNameChange('Goblin', 'Kobold');

        expect(renameNpc).toHaveBeenCalledWith({ combatSummary, oldName: 'Goblin', newName: 'Kobold', campaignNpcs, setNpcImages, campaignName });
        expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, campaignName);
        await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(2));
        expect(setCombatSummary).toHaveBeenCalledTimes(2);
    });

    // bug-player-clients-can-hijack-initiative: tracker authorship is GM-only.
    // isLocalhost:false (the LAN player lane) keeps the card target-select product
    // lane open but must never stamp initiative or rename combatants.
    describe('LAN client (isLocalhost:false)', () => {
        it('initiative stamp and rename stay inert — zero persistence', () => {
            const { handlers, setCombatSummary } = makeHandlers(
                [{ name: 'Goblin', type: 'npc', currentHp: 10 }],
                { isLocalhost: false },
            );

            handlers.handleInitiativeChange('Goblin', '18');
            handlers.handleNameChange('Goblin', 'Kobold');

            expect(setInitiative).not.toHaveBeenCalled();
            expect(renameNpc).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
        });

        it('target select — the player interaction lane — still persists', () => {
            const { handlers, combatSummary } = makeHandlers(
                [{ name: 'Alice', type: 'player', currentHp: 20 }],
                { isLocalhost: false },
            );

            handlers.handleTargetChange('Alice', 'Goblin');

            expect(setTarget).toHaveBeenCalledWith(combatSummary, 'Alice', 'Goblin');
            expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, campaignName);
        });
    });
});

describe('handleTargetChange', () => {
    it.each([
        { desc: 'creature target', overlays: [], target: 'Bob', accepted: true },
        { desc: 'overlay target with matching id', overlays: [{ id: 'fireball' }], target: 'overlay-fireball', accepted: true },
        { desc: 'overlay target with unknown id is rejected', overlays: [], target: 'overlay-fireball', accepted: false },
        { desc: 'empty target clears', overlays: [], target: '', accepted: true },
    ])('$desc', ({ overlays, target, accepted }) => {
        const { handlers, combatSummary, setCombatSummary } = makeHandlers(
            [{ name: 'Alice', type: 'player', currentHp: 20 }],
            { overlays },
        );

        handlers.handleTargetChange('Alice', target);

        if (accepted) {
            expect(setTarget).toHaveBeenCalledWith(combatSummary, 'Alice', target);
        } else {
            expect(setTarget).not.toHaveBeenCalled();
        }
        expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, campaignName);
        expect(setCombatSummary).toHaveBeenCalledTimes(1);
    });
});

describe('handleRemoveNpc', () => {
    it.each([
        { desc: 'alive NPC declined — exact HP warning, not removed', name: 'Goblin', type: 'npc', currentHp: 5, initiative: '', confirmed: false, msg: 'Goblin has 5 HP. Remove anyway?', removed: false },
        { desc: '0-HP NPC with initiative declined — exact initiative warning', name: 'Goblin', type: 'npc', currentHp: 0, initiative: '12', confirmed: false, msg: 'Goblin has initiative assigned. Remove anyway?', removed: false },
        { desc: 'confirmed removal runs removeNpc and persists', name: 'Goblin', type: 'npc', currentHp: 5, initiative: '', confirmed: true, msg: 'Goblin has 5 HP. Remove anyway?', removed: true },
        { desc: '0-HP NPC without initiative removes without asking', name: 'Goblin', type: 'npc', currentHp: 0, initiative: '', confirmed: false, msg: null, removed: true },
        { desc: 'player is guarded — never prompted, never removed', name: 'Alice', type: 'player', currentHp: 5, initiative: '12', confirmed: true, msg: null, removed: false },
    ])('$desc', ({ name, type, currentHp, initiative, confirmed, msg, removed }) => {
        window.confirm = vi.fn(() => confirmed);
        const { handlers, combatSummary, setCombatSummary } = makeHandlers([
            { name, type, currentHp, initiative },
        ]);

        handlers.handleRemoveNpc(name);

        if (msg) {
            expect(window.confirm).toHaveBeenCalledWith(msg);
        } else {
            expect(window.confirm).not.toHaveBeenCalled();
        }
        if (removed) {
            expect(removeNpc).toHaveBeenCalledWith(combatSummary, name);
            expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, campaignName);
            expect(setCombatSummary).toHaveBeenCalledTimes(1);
        } else {
            expect(removeNpc).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
        }
    });
});

describe('handleAddNpc', () => {
    // Guarded spawn lane (bug-initiative-concurrent-npc-spawn-lost-update): fresh
    // read → clone → merge → append → POST with baseVersion → ack-publish. The prop
    // mirror must stay pristine until the write is accepted.
    it('spawns the auto-named NPC onto the fresh-board clone and persists it with a baseVersion stamp', async () => {
        const { handlers, combatSummary, setCombatSummary } = makeHandlers([
            { name: 'Alice', type: 'player', currentHp: 20 },
        ]);

        await handlers.handleAddNpc();

        expect(window.confirm).toHaveBeenCalledWith('Add NPC with placeholder AC 10 / HP 10? Edit on the card.');
        // Mutated a CLONE — the shared mirror keeps its pristine single-creature bytes.
        expect(combatSummary.creatures.map(c => c.name)).toEqual(['Alice']);
        expect(addNpc).toHaveBeenCalledTimes(1);
        const base = addNpc.mock.calls[0][0];
        expect(base).not.toBe(combatSummary);
        expect(base.creatures.map(c => c.name)).toEqual(['Alice', 'Bob', 'NPC 1']);
        expect(base.boardVersion).toBe(1); // fresh read (null mock ⇒ mirror, unversioned → base 0)
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({
            creatures: expect.arrayContaining([expect.objectContaining({ name: 'NPC 1', type: 'npc' })]),
        }), campaignName, { baseVersion: 0 });
        expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({
            creatures: expect.arrayContaining([expect.objectContaining({ name: 'NPC 1', type: 'npc' })]),
        }));
    });

    // Owner decision 2026-10-24: the +NPC lane stamps placeholder AC 10 / HP 10 — the
    // confirm must name BOTH defaults and the card-edit remedy before any write runs.
    it('confirm copy names AC 10, HP 10 as placeholders and points at the card', () => {
        const { handlers } = makeHandlers([{ name: 'Alice', type: 'player', currentHp: 20 }]);

        handlers.handleAddNpc();

        const msg = window.confirm.mock.calls[0][0];
        expect(msg).toMatch(/AC 10/);
        expect(msg).toMatch(/HP 10/);
        expect(msg).toMatch(/placeholder/i);
        expect(msg).toMatch(/edit on the card/i);
    });

    it('declined confirm spawns nothing — zero writes', async () => {
        window.confirm = vi.fn(() => false);
        const { handlers, combatSummary, setCombatSummary } = makeHandlers([
            { name: 'Alice', type: 'player', currentHp: 20 },
        ]);

        await handlers.handleAddNpc();

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(addNpc).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(combatSummary.creatures.map(c => c.name)).toEqual(['Alice']);
    });

    it('accepted confirm runs addNpc with the ac:10/maxHp:10/currentHp:10 contract intact', async () => {
        const { handlers, setCombatSummary } = makeHandlers([
            { name: 'Alice', type: 'player', currentHp: 20 },
        ]);

        await handlers.handleAddNpc();

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(addNpc).toHaveBeenCalledTimes(1);
        expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({
            creatures: expect.arrayContaining([
                expect.objectContaining({ name: 'NPC 1', ac: 10, maxHp: 10, currentHp: 10 }),
            ]),
        }));
    });
});

describe('handleClear', () => {
    // QA backlog: house NAMED canon (Factions/Notes/character-delete name their
    // target + irreversibility) — the Clear confirm must state what it does.
    it('confirm copy names the action, its scope, and irreversibility', () => {
        const { handlers } = makeHandlers([{ name: 'Alice', type: 'player', currentHp: 20 }]);

        handlers.handleClear();

        expect(window.confirm).toHaveBeenCalledWith(
            'Clear combat status for all creatures? This resets initiative and removes all monsters from the board. This action is irreversible.'
        );
    });

    it('confirmed: fresh summary, active creature, exploration phase, CLA-100 player latches, closing roster rewards', () => {
        const cleared = {
            round: 1,
            creatures: [
                { name: 'Alice', type: 'player' },
                { name: 'Bob', type: 'player' },
                { name: 'NPC 1', type: 'npc' },
            ],
        };
        clearCombat.mockReturnValue(cleared);
        const { handlers, setCombatSummary, setActiveCreatureName, characters } = makeHandlers([
            { name: 'Alice', type: 'player', currentHp: 20 },
            { name: 'Goblin', type: 'npc', currentHp: 5 },
        ], { numOfNpc: 1 });

        handlers.handleClear();

        expect(clearCombat).toHaveBeenCalledWith(characters, 1, expect.any(Function));
        expect(storage.set).toHaveBeenCalledWith('combatSummary', cleared, campaignName);
        expect(setCombatSummary).toHaveBeenCalledWith(cleared);
        expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Alice', campaignName);
        expect(setActiveCreatureName).toHaveBeenCalledWith('Alice');
        expect(setSessionPhase).toHaveBeenCalledWith({ campaignName, phase: 'exploration', changedBy: 'initiative tracker', reason: 'combat cleared' });
        // CLA-100: Dread Ambush latch resets for players only.
        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'dreadAmbushSpeedActive', null, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'dreadAmbushSpeedActive', null, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(sweepNewCombatClocks).toHaveBeenCalledWith(campaignName);
        // L5 §10.3: rewards are computed from the CLOSING roster (Goblin included), not the cleared one.
        expect(autoAwardCombatRewards).toHaveBeenCalledWith(expect.objectContaining({
            campaignName,
            combatSummary: expect.objectContaining({
                creatures: expect.arrayContaining([expect.objectContaining({ name: 'Goblin' })]),
            }),
        }));
    });

    it('declined: nothing is cleared or written', () => {
        window.confirm = vi.fn(() => false);
        const { handlers, setCombatSummary, setActiveCreatureName } = makeHandlers([
            { name: 'Alice', type: 'player', currentHp: 20 },
        ]);

        handlers.handleClear();

        expect(clearCombat).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(setActiveCreatureName).not.toHaveBeenCalled();
    });
});

describe('no-combat guards', () => {
    it('every guarded handler writes nothing without a combat summary', () => {
        const { setCombatSummary } = makeHandlers([]);
        const handlers = createCreatureHandlers({
            combatSummary: null,
            campaignName,
            campaignNpcs: [],
            setNpcImages: vi.fn(),
            overlays: [],
            setCombatSummary,
            setActiveCreatureName: vi.fn(),
            characters: [],
            numOfNpc: 0,
            isLocalhost: true,
        });

        handlers.handleCreatureHpChange('Goblin', 5);
        handlers.handleInitiativeChange('Goblin', '12');
        handlers.handleNameChange('Goblin', 'Kobold');
        handlers.handleTargetChange('Goblin', 'Alice');
        handlers.handleRemoveNpc('Goblin');
        handlers.handleAddNpc();
        // unknown creature in a live summary is also inert
        const live = makeHandlers([{ name: 'Goblin', type: 'npc', currentHp: 10 }]);
        live.handlers.handleCreatureHpChange('Nobody', 5);

        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(live.setCombatSummary).not.toHaveBeenCalled();
        expect(removeNpc).not.toHaveBeenCalled();
        expect(addNpc).not.toHaveBeenCalled();
        expect(setInitiative).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('Initiative wiring (smoke)', () => {
    it('GM HP + initiative input on a real card reach the store; declined removal does not', async () => {
        window.confirm = vi.fn(() => false);
        vi.mocked(loadCombatSummary).mockResolvedValue({
            round: 1,
            creatures: [
                { name: 'Alice', type: 'player', currentHp: 10, initiative: '', targetName: null },
                { name: 'Goblin', type: 'npc', currentHp: 5, initiative: '', targetName: null },
            ],
        });
        const props = {
            characters: [
                { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 10, armorClass: 15 } },
            ],
            campaignName,
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: 'test-map',
        };
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByTestId('creature-card-Goblin')).toBeInTheDocument(); });

        await act(async () => {
            fireEvent.change(screen.getByTestId('hp-input-Alice'), { target: { value: '15' } });
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'currentHitPoints', 15, campaignName);

        await act(async () => {
            fireEvent.change(screen.getByTestId('initiative-input-Alice'), { target: { value: '18' } });
        });
        expect(setInitiative).toHaveBeenCalled();
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);

        await act(async () => {
            fireEvent.click(screen.getByTestId('npc-remove-Goblin'));
        });
        expect(window.confirm).toHaveBeenCalledWith('Goblin has 5 HP. Remove anyway?');
        expect(removeNpc).not.toHaveBeenCalled();
    });
});
