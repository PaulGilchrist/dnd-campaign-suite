// @maintained-by-ai
/**
 * EyebiteEffectModal — BASE lane (mount contract, UI navigation, effect presentation).
 *
 * Ownership map (siblings — do not duplicate here):
 * - .npc-save.test.jsx    — NPC auto-save math (pinned d20, DC threshold), immunity gate +
 *                           aura channel, LIVE rollback/store movement, byte-exact log rows,
 *                           sendSaveResult payloads, popup copy, save-result inertness on that
 *                           seam, routing of 'monster'/type-less creatures.
 * - .player-save.test.jsx — prompt dispatch, save-result listener lifetime, aura suppression,
 *                           double-fire, resolution rows/store writes, Done-after-result,
 *                           featureName into logs (FLAG).
 * This lane owns: mount purity (zero service calls, zero armed save-result listeners), the
 * effect list render (exact 2024 rules text for all three options), effect→target navigation
 * — SecondaryTargetModal gets the exact title, component-computed filtered targets, the
 * full-line range/DC description (pinned with its deliberate literal <strong> markup) and
 * confirm label/icon — caster exclusion, empty-roster edge, rangeFeet/saveDc propagation,
 * Cancel and Skip each closing exactly once, and featureName into header/title/CTA. This
 * lane NEVER confirms a target: any resolution belongs to the save lanes.
 *
 * FLAG (pins actual behavior, not intent):
 * - EyebiteEffectModal.jsx:458 — the stage-two description hard-codes the literal 'Eyebite'
 *   even when featureName differs (full-line pin below rides the copy as shipped; the log
 *   half of this FLAG is pinned in .player-save.test.jsx). Product fix: interpolate featureName.
 *
 * Anti-vacuity: frozen fixtures handed to the seam; targets are component-computed (filter
 * + map), not a props echo; listener arming proven with an event-type-scoped addEventListener
 * spy plus an inert dispatch; fresh vi.fn onClose per makeProps; afterEach mockReset + re-arm
 * (never clearAllMocks); findBy idiom before any stage-two query; exact full-line text;
 * role-scoped queries; no bare setTimeout — no timers of any kind on this seam.
 */
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import EyebiteEffectModal from './EyebiteEffectModal.jsx';

vi.mock('./shared/SecondaryTargetModal.jsx', () => {
    return {
        default: vi.fn(({ title, targets, onTargetSelected, onSkip, description, confirmLabel, confirmIcon }) => {
            const firstTargetName = targets.length > 0 ? (targets[0].name || targets[0].value) : null;
            return (
                <div data-testid="secondary-target-modal">
                    <span data-testid="stm-title">{title}</span>
                    <span data-testid="stm-icon">{confirmIcon}</span>
                    <span data-testid="stm-description">{description}</span>
                    <span data-testid="stm-confirmLabel">{confirmLabel}</span>
                    <span data-testid="stm-targetCount">{targets.length}</span>
                    <button
                        onClick={() => onTargetSelected(firstTargetName)}
                        data-testid="stm-confirm"
                        type="button"
                    >
                        {confirmLabel}
                    </button>
                    <button onClick={onSkip} data-testid="stm-skip" type="button">
                        Skip
                    </button>
                    {targets.map((t, i) => (
                        <span key={i} data-testid={`stm-target-${i}`}>{t.name || t.value}</span>
                    ))}
                </div>
            );
        }),
    };
});

// Plain inert mocks: this seam never reaches the stores or services — mount purity pins
// that they stay empty (live stores/recorders live on the save lanes).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name,
        guid: vi.fn(() => 'test-guid-123'),
    },
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../services/combat/auras/auraConditionImmunity.js', () => ({
    getAuraConditionImmunities: vi.fn(() => Promise.resolve({ immunities: [], immunitySources: {} })),
    auraCoversCondition: vi.fn(() => false),
    splitAuraCoveredConditions: vi.fn((saveConditions) => ({ covered: [], applicable: saveConditions || [] })),
    logAuraConditionImmunity: vi.fn(),
}));

vi.mock('../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../../services/automation/common/damageRollback.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as automationService from '../../../services/combat/automation/automationService.js';
import * as logService from '../../../services/ui/logService.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as auraService from '../../../services/combat/auras/auraConditionImmunity.js';
import utils from '../../../services/ui/utils.js';

const CASTER = 'Witch1';
const CAMPAIGN = 'test-campaign';
const SAVE_DC = 13;
const DEFAULT_AURA = Object.freeze({ immunities: Object.freeze([]), immunitySources: Object.freeze({}) });

// Byte-exact 2024 rules copy as shipped by the component's EFFECT_OPTIONS.
const EFFECTS = [
    { label: 'Asleep', description: 'The target has the Unconscious condition. It wakes up if it takes any damage or if another creature takes an action to shake it awake.' },
    { label: 'Panicked', description: 'The target has the Frightened condition. On each of its turns, the Frightened target must take the Dash action and move away from you by the safest and shortest route available.' },
    { label: 'Sickened', description: 'The target has the Poisoned condition.' },
];

// ── Fixtures (frozen; saveBonuses intentionally absent — the target LIST never reads them) ──

const GOBLIN = Object.freeze({ name: 'Goblin1', type: 'npc' });
const ORC = Object.freeze({ name: 'Orc Warrior', type: 'npc' });
const ELF = Object.freeze({ name: 'Elf Mage', type: 'player' });
const WITCH = Object.freeze({ name: CASTER, type: 'player' });

function summaryOf(...creatures) {
    return Object.freeze({ creatures: Object.freeze(creatures) });
}

// Fresh vi.fn per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
    return {
        combatSummary: summaryOf(GOBLIN, ORC, ELF),
        attackerName: CASTER,
        saveDc: SAVE_DC,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        characters: [],
        featureName: 'Eyebite',
        rangeFeet: 60,
        ...overrides,
    };
}

// Full-line stage-two description, pinned WITH its literal <strong> markup (:458).
const descriptionFor = (label, range = 60, dc = SAVE_DC) =>
    `Choose a creature within <strong>${range} feet</strong>. It must make a WIS save (DC ${dc}) or be affected by Eyebite (${label}).`;

const targetNames = () => screen.queryAllByTestId(/^stm-target-\d$/).map(el => el.textContent);

// ── Setup / teardown ──

// House rule: mockReset (not clearAllMocks/resetAllMocks) + re-arm. The stub component is
// deliberately NOT reset — its render implementation must survive between tests; its call
// history is never asserted (stage presence is pinned via the DOM instead).
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    runtime.getRuntimeValue.mockReset().mockReturnValue(null);
    runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
    damageRollback.storeSpellLastAttack.mockReset();
    damageRollback.addTargetResult.mockReset();
    expirations.addExpiration.mockReset();
    diceRoller.rollD20.mockReset().mockReturnValue(15);
    automationService.playerIsImmuneToCondition.mockReset().mockReturnValue(false);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    savePromptService.sendSavePrompt.mockReset();
    savePromptService.sendSaveResult.mockReset();
    utils.guid.mockReset().mockReturnValue('test-guid-123');
    auraService.getAuraConditionImmunities.mockReset().mockResolvedValue(DEFAULT_AURA);
    auraService.auraCoversCondition.mockReset().mockReturnValue(false);
    auraService.splitAuraCoveredConditions.mockReset().mockImplementation((saveConditions) => ({ covered: [], applicable: saveConditions || [] }));
    auraService.logAuraConditionImmunity.mockReset();
});

describe('EyebiteEffectModal — mount contract & presentation', () => {

    it('mount purity: stage-one copy renders with zero service calls and no armed save-result listener', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        const props = makeProps();
        render(<EyebiteEffectModal {...props} />);

        // Stage-one presentation, exact copy.
        expect(screen.getByText('Eyebite')).toBeInTheDocument();
        expect(screen.getByText('Choose an effect for the target:')).toBeInTheDocument();
        expect(screen.queryByTestId('secondary-target-modal')).not.toBeInTheDocument();

        // Nothing touched any service on mount.
        expect(addSpy.mock.calls.filter(([type]) => type === 'save-result')).toEqual([]);
        expect(runtime.getRuntimeValue.mock.calls).toEqual([]);
        expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
        expect(logService.addEntry.mock.calls).toEqual([]);
        expect(savePromptService.sendSavePrompt.mock.calls).toEqual([]);
        expect(savePromptService.sendSaveResult.mock.calls).toEqual([]);
        expect(diceRoller.rollD20.mock.calls).toEqual([]);
        expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([]);
        expect(damageRollback.addTargetResult.mock.calls).toEqual([]);
        expect(expirations.addExpiration.mock.calls).toEqual([]);
        expect(auraService.getAuraConditionImmunities.mock.calls).toEqual([]);
        expect(automationService.playerIsImmuneToCondition.mock.calls).toEqual([]);
        expect(utils.guid.mock.calls).toEqual([]);

        // Nothing armed means dispatched save-results are inert.
        act(() => {
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: 'test-guid-123', success: false, roll: 1, total: 1 } }));
        });
        expect(logService.addEntry.mock.calls).toEqual([]);
        expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
    });

    describe('effect list', () => {
        it.each(EFFECTS)('renders $label option with exact 2024 rules text', ({ label, description }) => {
            render(<EyebiteEffectModal {...makeProps()} />);
            const btn = screen.getByRole('button', { name: new RegExp(`^${label}`) });
            expect(within(btn).getByText(description)).toBeInTheDocument();
        });
    });

    describe('effect → target navigation', () => {
        it.each(EFFECTS)('selecting $label opens SecondaryTargetModal with exact title, targets, description and CTA', async ({ label }) => {
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));
            await screen.findByTestId('secondary-target-modal');

            expect(screen.getByTestId('stm-title').textContent).toBe('Eyebite');
            expect(screen.getByTestId('stm-icon').textContent).toBe('fa-solid fa-eye');
            expect(screen.getByTestId('stm-confirmLabel').textContent).toBe('Cast Eyebite');
            expect(screen.getByTestId('stm-confirmLabel').textContent).toBe(screen.getByRole('button', { name: 'Cast Eyebite' }).textContent);
            expect(screen.getByTestId('stm-description').textContent).toBe(descriptionFor(label));

            // Component-computed: every non-caster creature, in summary order, type carried through.
            expect(screen.getByTestId('stm-targetCount').textContent).toBe('3');
            expect(targetNames()).toEqual(['Goblin1', 'Orc Warrior', 'Elf Mage']);
        });

        it('excludes the caster from the target list', async () => {
            const props = makeProps({ combatSummary: summaryOf(WITCH, GOBLIN, ORC, ELF) });
            render(<EyebiteEffectModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /^Asleep/ }));
            await screen.findByTestId('secondary-target-modal');

            expect(screen.getByTestId('stm-targetCount').textContent).toBe('3');
            expect(targetNames()).toEqual(['Goblin1', 'Orc Warrior', 'Elf Mage']);
            expect(screen.queryByText(CASTER)).not.toBeInTheDocument();
        });

        it('empty roster: target stage still renders with zero targets and stays open', async () => {
            const props = makeProps({ combatSummary: summaryOf() });
            render(<EyebiteEffectModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /^Panicked/ }));
            await screen.findByTestId('secondary-target-modal');

            expect(screen.getByTestId('stm-targetCount').textContent).toBe('0');
            expect(targetNames()).toEqual([]);
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it('custom rangeFeet and saveDc propagate into the full-line description', async () => {
            render(<EyebiteEffectModal {...makeProps({ rangeFeet: 30, saveDc: 15 })} />);
            fireEvent.click(screen.getByRole('button', { name: /^Sickened/ }));
            await screen.findByTestId('secondary-target-modal');

            expect(screen.getByTestId('stm-description').textContent).toBe(descriptionFor('Sickened', 30, 15));
        });

        it('custom featureName rides the header, modal title, and cast CTA', async () => {
            render(<EyebiteEffectModal {...makeProps({ featureName: 'Witch Eyebite' })} />);
            expect(screen.getByText('Witch Eyebite')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /^Asleep/ }));
            await screen.findByTestId('secondary-target-modal');
            expect(screen.getByTestId('stm-title').textContent).toBe('Witch Eyebite');
            expect(screen.getByTestId('stm-confirmLabel').textContent).toBe('Cast Witch Eyebite');
        });
    });

    describe('cancel & skip', () => {
        it('Cancel closes exactly once', () => {
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        it('Skip closes exactly once and resolves nothing', async () => {
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /^Asleep/ }));
            await screen.findByTestId('secondary-target-modal');

            fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
            expect(props.onClose).toHaveBeenCalledTimes(1);
            expect(logService.addEntry.mock.calls).toEqual([]);
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(savePromptService.sendSavePrompt.mock.calls).toEqual([]);
            expect(savePromptService.sendSaveResult.mock.calls).toEqual([]);
            expect(diceRoller.rollD20).not.toHaveBeenCalled();
        });
    });
});
