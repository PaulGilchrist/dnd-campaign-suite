// @maintained-by-ai
// Lane: CreatureCard → TurnEconomyStrip movement DENOMINATOR
// (bug-movement-budget-caps-all-movers-at-30, display face).
//
// Regression pin: the per-card strip received speedFeet={creature.speed}, but
// combatSummary rows carried NO speed key for players (mount-merged minimal
// rows) NOR for EB-joined monsters, so every card readout fell to the 30 ft
// default — witnessed live as Wolf "0/30 ft" (authored 40) and a Speedy-buffed
// EF card "30/30 ft" beside the honest header strip "30/40 ft". The card now
// resolves through the shared resolveSpeedFeet: row-stamped speed (EB join
// stamps the bestiary walk speed) → the effectSubjectName-resolved character's
// computedStats.speed (holder remap included) → authored speed → 30 default,
// so the card denominator equals the header denominator for the same creature.
//
// Mock block mirrored from CreatureCard.conditions.test.jsx (TurnEconomyStrip
// stays REAL — it is the lane under test).
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`avatar-${name}`}>{name?.charAt(0)}</div>),
}));

vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value }) => <div data-testid="monster-autocomplete">{value}</div>),
}));

vi.mock('./NpcAvatar.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`npc-avatar-${name}`} />),
}));

vi.mock('./CreatureHp.jsx', () => ({
    default: vi.fn(({ creature }) => <div data-testid={`creature-hp-${creature.name}`} />),
}));

vi.mock('./ConditionEffectBadges.jsx', () => ({
    default: vi.fn(({ creatureName }) => <div data-testid={`condition-effects-${creatureName}`} />),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

// Only CreatureCard (and its unmocked child TurnEconomyStrip) import from here.
// 'campaign' store reads: enforcement ON (the strip's render gate) + a fresh
// movement-used turnState so the denominator is the whole story.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((_characterKey, key) => {
        if (key === 'enforcement') return { mode: 'on', movementBudget: true };
        if (key === 'turnState') return { EvasiveFighter: { movementUsedFeet: 0 } };
        return null;
    }),
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
}));

const baseProps = (creature, extra = {}) => ({
    creature,
    isActive: false,
    isLocalhost: true,
    campaignNpcs: [],
    overlays: [],
    allCreatures: [creature],
    campaignName: 'test-campaign',
    characters: [],
    onRemoveNpc: vi.fn(),
    onNpcClick: vi.fn(),
    onNameChange: vi.fn(),
    onHpChange: vi.fn(),
    onInitiativeChange: vi.fn(),
    onTargetChange: vi.fn(),
    onRollConditionSave: vi.fn(),
    onBreakCondition: vi.fn(),
    onOpenEffectAdder: vi.fn(),
    onRollConcentrationSave: vi.fn(),
    onBreakConcentration: vi.fn(),
    ...extra,
});

const efRow = {
    name: 'EvasiveFighter',
    type: 'player',
    currentHp: 20,
    maxHp: 20,
    initiative: 14,
    targetName: '',
    conditions: [],
    concentration: null,
};

const movementLabel = () => {
    const strip = screen.getByLabelText('Turn economy for EvasiveFighter');
    const badge = Array.from(strip.querySelectorAll('.creature-badge')).find((b) => /\d+\/\d+ ft/.test(b.textContent));
    return badge.textContent.trim();
};

describe('CreatureCard — economy-strip movement denominator (sheet-speed parity)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('player row: card denominator = the sheet computedStats.speed the header strip shows (40, not 30)', () => {
        render(<CreatureCard {...baseProps(efRow, {
            characters: [{ name: 'EvasiveFighter', computedStats: { speed: 40 } }],
        })} />);
        expect(movementLabel()).toBe('0/40 ft');
    });

    it('EB-joined monster row: the join-stamped `speed` byte feeds the denominator', () => {
        const wolf = { ...efRow, name: 'Wolf', type: 'npc', speed: 40 };
        render(<CreatureCard {...baseProps(wolf, { allCreatures: [wolf] })} />);
        const strip = screen.getByLabelText('Turn economy for Wolf');
        const badge = Array.from(strip.querySelectorAll('.creature-badge')).find((b) => /\d+\/\d+ ft/.test(b.textContent));
        expect(badge.textContent.trim()).toBe('0/40 ft');
    });

    it('(Second Turn) twin: display keeps the twin name, denominator resolves through the HOLDER sheet', () => {
        const twin = { ...efRow, name: 'EvasiveFighter (Second Turn)', secondTurn: true, holderName: 'EvasiveFighter' };
        render(<CreatureCard {...baseProps(twin, {
            allCreatures: [efRow, twin],
            characters: [{ name: 'EvasiveFighter', computedStats: { speed: 40 } }],
        })} />);
        const strip = screen.getByLabelText('Turn economy for EvasiveFighter (Second Turn)');
        const badge = Array.from(strip.querySelectorAll('.creature-badge')).find((b) => /\d+\/\d+ ft/.test(b.textContent));
        expect(badge.textContent.trim()).toBe('0/40 ft');
    });

    it('unknown speed stays honest at the 30 ft default (bare +NPC placeholder)', () => {
        const bare = { ...efRow, name: 'NPC 1', type: 'npc' };
        render(<CreatureCard {...baseProps(bare, { allCreatures: [bare] })} />);
        const strip = screen.getByLabelText('Turn economy for NPC 1');
        const badge = Array.from(strip.querySelectorAll('.creature-badge')).find((b) => /\d+\/\d+ ft/.test(b.textContent));
        expect(badge.textContent.trim()).toBe('0/30 ft');
    });
});
