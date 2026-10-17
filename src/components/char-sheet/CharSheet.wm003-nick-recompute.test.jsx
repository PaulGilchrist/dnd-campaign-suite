// @maintained-by-ai
// WM-003 sheet seam only: CharSheet's compute effect subscribes to the Nick latch
// (_Nick_UsedRound) and the weapon-kind mastery bucket
// (_Weapon_Kind_Mastery_chosenWeapons). Stamping either key must re-run
// getPlayerStats AND deliver the recomputed stats (with the promoted off-hand
// row) to CharActions' consumed playerStats prop.
// Rules internals (resolveOffHandActionType) live in attackCalc2024.wm003-nick.test.js;
// latch stamping lives in weaponMasteryHandler.nick.test.js — not re-tested here.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import CharActions from './CharActions.jsx';
import rulesFactory from '../../services/rules/rulesFactory.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import {
    createDefaultProps,
    createMockPlayerStats,
    createSharedPopupReturnValue,
    resetTestState,
} from './CharSheet.test-utils.jsx';

vi.mock('../../services/automation/handlers/shieldOfFaithHandler.js', () => ({
    applyShieldOfFaith: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraComboEffects.js', () => ({
    computeAuraComboEffects: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn().mockReturnValue({ cannotAct: false }),
    getNetAttackMode: vi.fn().mockReturnValue('normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn().mockReturnValue({ creatures: [] }),
    getCurrentCombatRound: vi.fn(() => 1),
    loadCombatSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => expr),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
    isCreatureWarded: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn().mockReturnValue(null),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getManeuversForRules: vi.fn().mockResolvedValue([]),
    getSuperiorityDice: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        getProperty: vi.fn().mockResolvedValue(null),
        setProperty: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
    sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
    default: vi.fn(() => <div data-testid="secondary-target-modal">modal</div>),
}));

vi.mock('./modals/PolymorphSelectionModal.jsx', () => ({
    default: vi.fn(() => <div data-testid="polymorph-selection-modal">modal</div>),
}));

vi.mock('./modals/AnimalShapesSelectionModal.jsx', () => ({
    default: vi.fn(() => <div data-testid="animal-shapes-selection-modal">modal</div>),
}));

vi.mock('./modals/ObjectTransformModal.jsx', () => ({
    default: vi.fn(() => <div data-testid="object-transform-modal">modal</div>),
}));

vi.mock('../common/popup.jsx', () => ({
    default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../common/AttackResultPopup.jsx', () => ({
    default: vi.fn(() => <div data-testid="attack-result-popup" />),
}));

const sharedPopupReturnVal = createSharedPopupReturnValue();

vi.mock('../../hooks/combat/useSharedPopup.js', () => {
    const mockFn = vi.fn();
    mockFn.mockImplementation(() => ({ ...sharedPopupReturnVal, Provider: ({ children }) => children }));
    return { default: mockFn };
});

// Reactive runtime mock: setRuntimeValue notifies useRuntimeValue subscribers,
// mirroring the live server-first store so the seam's subscription is observable.
vi.mock('../../hooks/runtime/useRuntimeState.js', async () => {
    const React = await import('react');
    const store = new Map();
    const listeners = new Map();
    const keyOf = (name, prop) => `${name}:${prop}`;
    const notify = (key) => (listeners.get(key) || new Set()).forEach(fn => fn());
    const ARRAY_DEFAULTS = ['activeConditions', 'activeBuffs', 'targetEffects'];
    const EMPTY = [];
    const defaultFor = (prop) => (ARRAY_DEFAULTS.includes(prop) ? EMPTY : null);
    return {
        useSyncedState: (_key, _prop, def) => React.useState(def ?? null),
        getRuntimeValue: (name, prop) => store.get(keyOf(name, prop)) ?? null,
        setRuntimeValue: (name, prop, val) => {
            store.set(keyOf(name, prop), val);
            notify(keyOf(name, prop));
            return Promise.resolve();
        },
        useRuntimeValue: (name, prop) => {
            const key = keyOf(name, prop);
            const def = defaultFor(prop);
            const [val, setVal] = React.useState(() => store.get(key) ?? def);
            React.useEffect(() => {
                const set = listeners.get(key) || new Set();
                listeners.set(key, set);
                const fn = () => setVal(store.get(key) ?? def);
                set.add(fn);
                return () => set.delete(fn);
            }, [key, def]);
            return val;
        },
    };
});

// Counts every getPlayerStats run so each computed stats object carries a
// computeSeq the rendered sheet can echo — proves the recomputed output (not
// just the fetch) reached the consumed playerStats prop.
const computeState = { seq: 0 };

// Mirrors attackCalc2024 resolveOffHandActionType: Nick latched this round
// promotes the Nick off-hand row to 'Action'.
vi.mock('../../services/rules/rulesFactory.js', () => ({
    default: {
        getPlayerStats: vi.fn(async () => {
            const rt = await import('../../hooks/runtime/useRuntimeState.js');
            const nickLatched = rt.getRuntimeValue('Test Character', '_Nick_UsedRound') === 1;
            computeState.seq += 1;
            return createMockPlayerStats({
                rules: '2024',
                computeSeq: computeState.seq,
                attacks: [
                    { name: 'Scimitar', type: 'Action', mastery: 'Nick', properties: ['Finesse', 'Light'], hitBonus: 8, damage: '1d6+2', damageType: 'Slashing', range: 5 },
                    { name: 'Dagger', type: nickLatched ? 'Action' : 'Bonus Action', mastery: 'Nick', properties: ['Finesse', 'Light'], hitBonus: 8, damage: '1d4+2', damageType: 'Piercing', range: 5 },
                ],
            });
        }),
    },
}));

vi.mock('./CharActions.jsx', () => ({
    default: vi.fn(({ playerStats }) => (
        <div data-testid="char-actions">
            <span>{playerStats?.name || 'none'}</span>
            <span data-testid="compute-seq">{playerStats?.computeSeq}</span>
        </div>
    )),
}));

vi.mock('./char-summary/CharSummary.jsx', () => ({
    default: vi.fn(() => <div data-testid="char-summary" />),
}));

vi.mock('./CharAbilities.jsx', () => ({
    default: vi.fn(() => <div data-testid="char-abilities" />),
}));

vi.mock('./CharInventory.jsx', () => ({
    default: vi.fn(() => <div data-testid="char-inventory" />),
}));

vi.mock('./CharReactions.jsx', () => ({
    default: vi.fn(() => <div data-testid="char-reactions" />),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
    default: vi.fn(() => <div data-testid="char-special-actions" />),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
    default: vi.fn(() => <div data-testid="char-character-advancement" />),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
    default: vi.fn(() => <div data-testid="char-spells" />),
}));

const lastConsumedStats = () => CharActions.mock.calls.at(-1)[0].playerStats;
const nickOffHandRow = (stats) => stats.attacks.find(a => a.name === 'Dagger').type;

describe('CharSheet WM-003 recompute seam — Nick latch re-derives attacks', () => {
    beforeEach(() => {
        resetTestState(sharedPopupReturnVal);
        computeState.seq = 0;
    });

    it('re-runs getPlayerStats when _Nick_UsedRound latches and delivers the promoted off-hand row to CharActions', async () => {
        render(<CharSheet {...createDefaultProps({ playerSummary: { name: 'Test Character', rules: '2024' } })} />);

        await waitFor(() => expect(screen.getByTestId('char-actions')).toBeInTheDocument());
        expect(nickOffHandRow(lastConsumedStats())).toBe('Bonus Action');
        expect(screen.getByTestId('compute-seq').textContent).toBe('1');

        setRuntimeValue('Test Character', '_Nick_UsedRound', 1, 'test-campaign');

        // Recompute ran AND its output (promoted row) reached the consumed prop.
        await waitFor(() => {
            const latest = lastConsumedStats();
            expect(latest.computeSeq).toBeGreaterThan(1);
            expect(nickOffHandRow(latest)).toBe('Action');
        });
        // attackCalc2024 reads playerStats.campaignName to honour the latch — pin pass-through.
        expect(rulesFactory.getPlayerStats.mock.calls.at(-1)[0].playerSummary.campaignName).toBe('test-campaign');
    });

    it('re-runs getPlayerStats when the weapon-kind mastery bucket is armed', async () => {
        render(<CharSheet {...createDefaultProps({ playerSummary: { name: 'Test Character', rules: '2024' } })} />);

        await waitFor(() => expect(screen.getByTestId('compute-seq').textContent).toBe('1'));

        setRuntimeValue('Test Character', '_Weapon_Kind_Mastery_chosenWeapons', ['Scimitar', 'Dagger'], 'test-campaign');

        // The bucket is the only input written here, so the advanced seq rendered
        // on the sheet attributes the recompute to the kind-bucket subscription.
        await waitFor(() => expect(screen.getByTestId('compute-seq').textContent).not.toBe('1'));
        expect(screen.getByTestId('compute-seq').textContent).toBe(String(computeState.seq));
    });
});
