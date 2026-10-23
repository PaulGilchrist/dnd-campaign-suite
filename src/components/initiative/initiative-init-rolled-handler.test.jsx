// @maintained-by-ai
// Lane: Initiative.jsx 'initiative-rolled' window-event listener (Initiative.jsx:497-523) —
// the GM-side new-initiative seam. Owned contract:
//   1. null-summary guard → zero store/log/expiry writes
//   2. WM-008 campaign latch '_Vex_appliedTarget' cleared once per event
//   3. player per-round latch resets (exact bytes); NPCs and thief's-reflex
//      second-turn entries get ZERO writes
//   4. Hunter's Mark concentration cleared + persisted byte-exactly; other
//      concentrations (other spells, null/absent) preserved untouched
//   5. dominated pendingExpirations cleared via clearExpirationEffects with exact
//      args; non-dominated entries survive in the filtered write; empty list → no-op;
//      non-empty all-non-dominated list → zero rewrite (#864 only-if-changed guard)
// Delegated (do NOT duplicate here):
//   - concentration-result / death-save-result inline listeners → initiative-callbacks.test.jsx (#863)
//   - round-wrap Vex latch reset (navigation seam, different event path) → navigationHandlers.wm008-vex-latch.test.js
//   - char-sheet per-character initiative resets → src/components/char-sheet/useInitiativeEffects.*.test.js
//   - dispatch side of the event → initiativeProcessing.test.js, encounterToInitiative.test.js
// Old→new map (8 cases → 4): player-resets + npc-skip → t1; Hunter's-Mark-clear +
// it.each negatives (Shield/null) → t2 (preserved in same exact payload); dominate-clear +
// preserve-non-dominated + skip-empty → t3 (per-creature fixtures); null-guard → t4.
// Dropped the mirrored PER_ROUND_RESETS key list: it had silently drifted from
// clearPlayerRoundFlags (missing _assassinate_usedRound, actionSurgeUsedThisRound,
// _Retaliation_usedRound, etc.). Replaced with exact-byte samples across latch
// categories + zero-write negatives, which cannot drift half-silently.
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary, getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import storage from '../../services/ui/storage.js';
import { clearExpirationEffects } from '../../services/rules/effects/expirations.js';

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    // L5-001: TurnEconomyStrip subscribes via useRuntimeValue; null ⇒ enforcement off.
    useRuntimeValue: vi.fn(() => null),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
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
vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
    clearExpirationEffects: vi.fn(),
}));
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
vi.mock('./CreatureCard.jsx', () => ({ default: ({ creature }) => (<div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type}`}><span>{creature.name}</span></div>) }));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => (<div data-testid="effect-adder"><span>{targetName}</span></div>) }));

describe('Initiative - initiative-rolled seam', () => {
    let props;

    beforeEach(async () => {
        vi.clearAllMocks();
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

    // Fresh mount → cards live → freeze post-mount call baselines so every
    // assertion below measures ONLY what the initiative-rolled event wrote.
    async function mountAndBaseline(eventSummary, mountSummary = eventSummary) {
        vi.mocked(loadCombatSummary).mockResolvedValue(mountSummary);
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByTestId('creature-card-Alice')).toBeInTheDocument(); });
        const baseline = {
            runtime: setRuntimeValue.mock.calls.length,
            storage: storage.set.mock.calls.length,
            expire: clearExpirationEffects.mock.calls.length,
        };
        vi.mocked(getCombatSummary).mockReturnValue(eventSummary);
        await act(async () => { window.dispatchEvent(new Event('initiative-rolled')); });
        return {
            runtimeAfter: setRuntimeValue.mock.calls.slice(baseline.runtime),
            storageAfter: storage.set.mock.calls.slice(baseline.storage),
            expireAfter: clearExpirationEffects.mock.calls.slice(baseline.expire),
        };
    }

    it('resets every players per-round latches but touches NPCs and second-turn entries not at all', async () => {
        const { runtimeAfter, storageAfter } = await mountAndBaseline({
            round: 1,
            creatures: [
                { name: 'Alice', type: 'player' },
                { name: 'Bob', type: 'player' },
                { name: 'Goblin', type: 'npc' },
                { name: 'Alice (Second Turn)', type: 'player', secondTurn: true },
            ],
        });

        // Exact bytes across latch categories: []-reset, null-latch reset, and the
        // CLA-100 Dread Ambush once-per-combat re-arm (regression-pinned key).
        expect(runtimeAfter).toEqual(expect.arrayContaining([
            ['Alice', 'activeBuffs', [], 'test-campaign'],
            ['Bob', 'activeBuffs', [], 'test-campaign'],
            ['Alice', '_Nick_UsedRound', null, 'test-campaign'],
            ['Alice', '_assassinate_usedRound', null, 'test-campaign'],
            ['Alice', 'actionSurgeUsedThisRound', null, 'test-campaign'],
            ['Alice', 'dreadAmbushSpeedActive', null, 'test-campaign'],
        ]));
        // WM-008: campaign-level auto-apply latch re-arms exactly once per event.
        expect(runtimeAfter.filter(c => c[1] === '_Vex_appliedTarget')).toEqual([
            ['campaign', '_Vex_appliedTarget', null, 'test-campaign'],
        ]);
        // Zero-write negatives: NPCs never get player resets; thief's-reflex
        // duplicate entries are skipped entirely; no concentration persisted here.
        expect(runtimeAfter.filter(c => c[0] === 'Goblin')).toEqual([]);
        expect(runtimeAfter.filter(c => c[0] === 'Alice (Second Turn)')).toEqual([]);
        expect(storageAfter).toEqual([]);
    });

    it('clears Hunter\'s Mark concentration and persists the summary byte-exactly, preserving other concentrations', async () => {
        const { storageAfter, runtimeAfter } = await mountAndBaseline({
            round: 1,
            creatures: [
                { name: 'Alice', type: 'player', concentration: { spell: "Hunter's Mark", dc: 10 } },
                { name: 'Bob', type: 'player', concentration: { spell: 'Shield', dc: 10 } },
                { name: 'Goblin', type: 'npc' },
            ],
        });

        // One persistence write, whole payload exact: HM nulled, Shield and the
        // concentration-less NPC preserved byte-for-byte (covers the old negative cases).
        expect(storageAfter).toEqual([
            ['combatSummary', {
                round: 1,
                creatures: [
                    { name: 'Alice', type: 'player', concentration: null },
                    { name: 'Bob', type: 'player', concentration: { spell: 'Shield', dc: 10 } },
                    { name: 'Goblin', type: 'npc' },
                ],
            }, 'test-campaign'],
        ]);
        // HM clearing must not hijack the per-round reset lane.
        expect(runtimeAfter).toEqual(expect.arrayContaining([['Alice', 'activeBuffs', [], 'test-campaign']]));
    });

    it('clears dominated expirations with exact args, preserves non-dominated entries, and no-ops on empty lists', async () => {
        vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByTestId('creature-card-Alice')).toBeInTheDocument(); });

        // Wire the dominate fixtures only at the seam so mount noise cannot pollute counts.
        vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
            if (prop !== 'pendingExpirations') return null;
            if (key === 'Alice') return [
                { target: 'Enemy1', effects: [{ type: 'dominated', effect: 'dominated', duration: '1 round' }] },
                { target: 'Enemy2', effects: [{ type: 'charmed', effect: 'charmed', duration: '1 turn' }] },
            ];
            return []; // Bob: empty list → early return, no writes
        });
        vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
        const expireBefore = clearExpirationEffects.mock.calls.length;
        await act(async () => { window.dispatchEvent(new Event('initiative-rolled')); });

        expect(clearExpirationEffects.mock.calls.slice(expireBefore)).toEqual([
            [[{ type: 'dominated', effect: 'dominated', duration: '1 round' }], 'Enemy1', 'Alice', 'test-campaign'],
        ]);
        // The filtered write keeps the charmed entry byte-exactly.
        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'pendingExpirations', [
            { target: 'Enemy2', effects: [{ type: 'charmed', effect: 'charmed', duration: '1 turn' }] },
        ], 'test-campaign');
        // Empty-list creature: no expiry call (count above is exactly 1) and no write.
        expect(setRuntimeValue.mock.calls.filter(c => c[0] === 'Bob' && c[1] === 'pendingExpirations')).toEqual([]);
    });

    // #864 churn pin (fix#170 only-if-changed guard law): a non-empty
    // pendingExpirations list with NO dominated entries must produce ZERO
    // rewrites of the identical array (was: unconditional write per invocation).
    it('does not rewrite pendingExpirations when nothing dominated was cleared', async () => {
        vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByTestId('creature-card-Alice')).toBeInTheDocument(); });

        const unchangedList = [
            { target: 'Enemy1', effects: [{ type: 'charmed', effect: 'charmed', duration: '1 turn' }] },
            { target: 'Enemy2', effects: [{ type: 'frightened', effect: 'frightened', duration: '1 minute' }] },
        ];
        vi.mocked(getRuntimeValue).mockImplementation((key, prop) => (prop === 'pendingExpirations' ? unchangedList : null));
        vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
        const runtimeBefore = setRuntimeValue.mock.calls.length;
        await act(async () => { window.dispatchEvent(new Event('initiative-rolled')); });

        // Nothing dominated: no expiry clears AND no identical-array rewrite.
        expect(clearExpirationEffects).not.toHaveBeenCalled();
        expect(setRuntimeValue.mock.calls.slice(runtimeBefore).filter(c => c[1] === 'pendingExpirations')).toEqual([]);
    });

    it('writes nothing when the combat summary cache is empty at the seam', async () => {
        const { runtimeAfter, storageAfter, expireAfter } = await mountAndBaseline(
            null, // event-time cache empty
            { round: 1, creatures: [{ name: 'Alice', type: 'player', concentration: { spell: "Hunter's Mark", dc: 10 } }] } // mounted fine
        );

        expect(runtimeAfter).toEqual([]);
        expect(storageAfter).toEqual([]);
        expect(expireAfter).toEqual([]);
    });
});
