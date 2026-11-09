// @maintained-by-ai
// LANE: CreatureCard.noDcBadgeClick — locks the click-gate fix
// (bug-condition-badge-no-dc-auto-success-removal). The EffectAdder Conditions
// tab promises "No saving throw — the badge shows no DC unless you type one."
// A blank-DC add stamps meta without dc, so buildRuntimeConditions lands
// dc:0 (falsy). Before the fix ConditionBadgeRow wired onRollConditionSave
// ungated by dc, and buildSaveResult's `total >= 0` made every d20 a
// guaranteed "SAVE SUCCESSFUL (DC 0)" — one click silently removed any
// no-save condition and logged an honest-looking condition-save success.
// Owner ruling 2026-11-09: gate the click — no DC, no roll. The badge renders
// as the existing inert (span) badge face; removal stays the × / consumer
// lanes. Owned here: the ConditionBadgeRow dc-gate THROUGH the real
// handleRollConditionSave chokepoint (dc-less click leaves roll/remove/audit/
// popup lanes untouched). NOT owned here: the ST holder-remap face →
// createRollConditionSaveHandler.second-turn.test.js (dc-bearing click must
// stay byte-identical, control case below).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import { createRollConditionSaveHandler } from './createRollConditionSaveHandler.js';
import { rollConditionSave, removeCondition, buildConditionPopup } from '../../services/combat/conditions/conditionSaveService.js';
import { logConditionSave } from '../../services/encounters/combatLoggingService.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name, imagePath }) => {
        return <div data-testid={`avatar-${name}`} className="avatar-wrapper">{imagePath ? <img src={imagePath} alt={name} /> : <span>{name?.charAt(0).toUpperCase() || '?'}</span>}</div>;
    }),
}));

vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value, onChange, showBadge }) => {
        return <div data-testid="monster-autocomplete"><input data-testid="monster-name-input" value={value} onChange={(e) => onChange(e.target.value)} />{showBadge && <span data-testid="npc-match-badge">NPC Match</span>}</div>;
    }),
}));

vi.mock('./NpcAvatar.jsx', () => ({
    default: vi.fn(({ name, imageUrl, imagePath, onClick }) => {
        const src = imagePath || imageUrl;
        return <div data-testid={`npc-avatar-${name}`} className="npc-avatar" onClick={onClick}>{src ? <img src={src} alt={name} /> : <span>{name?.charAt(0).toUpperCase() || '?'}</span>}</div>;
    }),
}));

vi.mock('./CreatureHp.jsx', () => ({
    default: vi.fn(({ creature, isLocalhost, onChange }) => {
        return <div data-testid={`creature-hp-${creature.name}`} className="creature-hp"><input data-testid={`hp-input-${creature.name}`} type="number" defaultValue={creature.currentHp ?? 0} onBlur={(e) => onChange(creature.name, parseInt(e.target.value) || 0)} disabled={!isLocalhost && creature.type === 'player'} /><span>{creature.currentHp ?? 0}/{creature.maxHp ?? 1}</span></div>;
    }),
}));

vi.mock('./ConditionEffectBadges.jsx', () => ({
    default: vi.fn(({ conditions, targetEffects, creatureName }) => {
        const children = [];
        (conditions || []).forEach(c => children.push(<span key={c.id} data-testid={`effect-condition-${c.id}`}>{c.label}</span>));
        (targetEffects || []).forEach(te => children.push(<span key={te.id} data-testid={`effect-target-${te.id}`}>{te.effect}</span>));
        return <div data-testid={`condition-effects-${creatureName}`}>{children}</div>;
    }),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

// Only the exports CreatureCard (and its unmocked child TurnEconomyStrip) import from this module.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((_characterKey, key) => key === 'targetEffects' ? [] : null),
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
}));

// Real handler's service layer — every write/audit/popup lane is a spy here,
// so a dc-less click that reaches NONE of them is the byte-clean proof.
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(),
    removeCondition: vi.fn(),
    addCondition: vi.fn(),
    buildConditionPopup: vi.fn(),
}));
vi.mock('../../services/automation/handlers/spells/forcecageHandler.js', async (importOriginal) => ({
    ...(await importOriginal()),
    removeForcecageEffect: vi.fn(),
}));
vi.mock('../../services/automation/handlers/spells/mazeHandler.js', async (importOriginal) => ({
    ...(await importOriginal()),
    removeMazeEffect: vi.fn(),
}));
vi.mock('../../services/combat/conditions/slowEffects.js', () => ({
    removeSlowEffectsForTarget: vi.fn(() => true),
    SLOW_TE_EFFECTS: [],
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConditionSave: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
// Real structural semantics (mirrors thiefsReflexesService.isSecondTurnEntry) —
// same stub pinned in createRollConditionSaveHandler.second-turn.test.js.
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    isSecondTurnEntry: vi.fn((creature) => !!creature?.secondTurn),
}));

const CAMPAIGN = 'test-campaign';
const HOLDER = 'Alice';
const ST_ROW = 'Alice (Second Turn)';

// The exact shape buildRuntimeConditions produces for a blank-DC EffectAdder
// apply (meta has no dc → `|| 0` coercion).
const NO_DC_COND = { id: 'runtime-poisoned-0', key: 'poisoned', label: 'Poisoned', dc: 0, ability: 'con' };
// The live FV control face: GM-typed DC → badge carries it, click rolls.
const DC_COND = { id: 'runtime-poisoned-0', key: 'poisoned', label: 'Poisoned', dc: 12, ability: 'con' };

const SUCCESS_ROLL = { roll: 12, success: true, bonus: 5, bonusDetail: '(+5 aura from ElderPaladin)', rolls: [12], starryDragonFloor: false };

const makeSummary = (withStRow = false) => ({
    round: 1,
    creatures: [
        { name: HOLDER, type: 'player', initiative: '20', currentHp: 20, maxHp: 20, conditions: [] },
        ...(withStRow ? [{ name: ST_ROW, type: 'player', initiative: '10', secondTurn: true, holderName: HOLDER, currentHp: 20, maxHp: 20, conditions: [] }] : []),
    ],
});

const mount = (creature, combatSummary) => {
    const setCombatSummary = vi.fn();
    const setConditionPopup = vi.fn();
    const props = {
        creature,
        isActive: false,
        isLocalhost: true,
        campaignNpcs: [],
        overlays: [],
        allCreatures: combatSummary.creatures,
        characters: [{ name: HOLDER, computedStats: {} }],
        campaignName: CAMPAIGN,
        onRemoveNpc: vi.fn(),
        onNpcClick: vi.fn(),
        onNameChange: vi.fn(),
        onHpChange: vi.fn(),
        onInitiativeChange: vi.fn(),
        onTargetChange: vi.fn(),
        // REAL chokepoint handler (d55d4160a remap inside) — the click lane
        // under test, not a stubbed prop.
        onRollConditionSave: createRollConditionSaveHandler({
            combatSummary,
            campaignName: CAMPAIGN,
            characters: [{ name: HOLDER, computedStats: {} }],
            campaignNpcs: [],
            mapName: 'test-map',
            setConditionPopup,
            setCombatSummary,
        }),
        onBreakCondition: vi.fn(),
        onOpenEffectAdder: vi.fn(),
        onRollConcentrationSave: vi.fn(),
        onBreakConcentration: vi.fn(),
    };
    render(<CreatureCard {...props} />);
    return { props, setCombatSummary, setConditionPopup };
};

beforeEach(() => {
    vi.clearAllMocks();
    rollConditionSave.mockResolvedValue(SUCCESS_ROLL);
    buildConditionPopup.mockReturnValue({ success: true });
});

// Drain the handler's microtask chain (rollConditionSave resolves immediately);
// if a click reached the chokepoint, its lanes are all settled by then.
const flush = () => act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
});

describe('CreatureCard condition badge — no DC, no roll offer', () => {
    it('renders a blank-DC badge as the inert span face (no button, no DC in label/tooltip)', () => {
        mount({ ...makeSummary().creatures[0], conditions: [NO_DC_COND] }, makeSummary());
        const badge = screen.getByText('Poisoned', { selector: 'span.creature-badge' });
        expect(badge).toBeInTheDocument();
        expect(screen.queryAllByText(/Poisoned DC/)).toHaveLength(0);
        expect(badge.getAttribute('title')).not.toMatch(/DC/);
    });

    it('clicking a blank-DC badge on a player card leaves every roll/remove/audit/popup lane untouched', async () => {
        const summary = makeSummary();
        const { setConditionPopup } = mount({ ...summary.creatures[0], conditions: [NO_DC_COND] }, summary);
        fireEvent.click(screen.getByText('Poisoned', { selector: 'span.creature-badge' }));
        await flush();

        // Byte-clean: the save roll never runs, so there is no DC-0 auto-success,
        // no condition removal, no condition-save audit row, no popup.
        expect(rollConditionSave).not.toHaveBeenCalled();
        expect(removeCondition).not.toHaveBeenCalled();
        expect(logConditionSave).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(setConditionPopup).not.toHaveBeenCalled();
        // The condition itself stays on the card.
        expect(screen.getByText('Poisoned', { selector: 'span.creature-badge' })).toBeInTheDocument();
    });

    it('a blank-DC badge is still removable via × (the sanctioned removal lane stays live)', () => {
        const summary = makeSummary();
        const { props } = mount({ ...summary.creatures[0], conditions: [NO_DC_COND] }, summary);
        fireEvent.click(screen.getByTitle('Remove effect'));
        expect(props.onBreakCondition).toHaveBeenCalledWith(HOLDER, NO_DC_COND);
    });

    it('control: a DC-bearing badge still renders as a button and its click rolls a real save end-to-end', async () => {
        const summary = makeSummary();
        const { setConditionPopup } = mount({ ...summary.creatures[0], conditions: [DC_COND] }, summary);
        const badge = screen.getByText('Poisoned DC 12', { selector: 'button.creature-badge' });
        expect(badge.getAttribute('title')).toContain('DC 12');
        fireEvent.click(badge);
        await flush();

        expect(rollConditionSave).toHaveBeenCalledTimes(1);
        expect(rollConditionSave.mock.calls[0][0]).toMatchObject({ creature: summary.creatures[0], condition: DC_COND });
        expect(removeCondition).toHaveBeenCalledTimes(1);
        expect(removeCondition.mock.calls[0][0]).toMatchObject({ creatureName: HOLDER, campaignName: CAMPAIGN });
        expect(logConditionSave).toHaveBeenCalledWith(expect.objectContaining({ creatureName: HOLDER, dc: 12, success: true }));
        expect(setConditionPopup).toHaveBeenCalledTimes(1);
    });

    it('interaction with d55d4160a: DC-bearing badge on a (Second Turn) card still remaps the roll to the HOLDER', async () => {
        const summary = makeSummary(true);
        mount({ ...summary.creatures[1], conditions: [DC_COND] }, summary);
        fireEvent.click(screen.getByText('Poisoned DC 12', { selector: 'button.creature-badge' }));
        await flush();

        expect(rollConditionSave).toHaveBeenCalledTimes(1);
        expect(rollConditionSave.mock.calls[0][0].creature.name).toBe(HOLDER);
        expect(logConditionSave).toHaveBeenCalledWith(expect.objectContaining({ creatureName: HOLDER }));
    });

    it('interaction with d55d4160a: blank-DC badge on a (Second Turn) card is equally inert (no holder roll)', async () => {
        const summary = makeSummary(true);
        const { setConditionPopup } = mount({ ...summary.creatures[1], conditions: [NO_DC_COND] }, summary);
        fireEvent.click(screen.getByText('Poisoned', { selector: 'span.creature-badge' }));
        await flush();

        expect(rollConditionSave).not.toHaveBeenCalled();
        expect(removeCondition).not.toHaveBeenCalled();
        expect(logConditionSave).not.toHaveBeenCalled();
        expect(setConditionPopup).not.toHaveBeenCalled();
    });
});
