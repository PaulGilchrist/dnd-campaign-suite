import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AttackRiderManeuverPrompt from './AttackRiderManeuverPrompt.jsx';

// AttackRiderManeuverPrompt — component-only unit tests (presentational chooser).
//
// Caller seam deferred elsewhere (deliberately NOT covered here):
// - onUse/onSkip handler contract (handleAttackRiderManeuverUse / handleAttackRiderManeuverSkip,
//   pipeline resume, MN-015 size-gate, precision-miss reroll): useAttackDamageResolution.*.test.js
// - CharActionModals mounting of this prompt: CharActionModals.secondary-targets.test.jsx
//   (this component is mocked there, so its behavior lives solely in this file).
// - Superiority-die lane inside the dice popup: DiceRollResult.interactive.test.jsx and
//   DiceRollResult.superiorityDie.test.jsx (separate UI, not this modal).
// - MN-018 Sweeping Attack secondary-target chooser — the external chooser whose
//   `chooserOpened` result this prompt defers to: CharActionModals.inline-modals.test.jsx.
//
// FLAG (not fixed here): the component uses inline styles on the maneuver list
// (sp-body div/label/input/span, lines ~86-109). Should move to co-located CSS.
//
// Conventions: makeProps returns fresh vi.fn callbacks per call (no cross-test bleed);
// no module mocks are required (the component imports only React), so no mockReset needed;
// findBy idiom for async result screens; role-scoped queries throughout.

const baseManeuvers = [
    { name: 'Disarming Attack', damageBonus: true, saveType: 'STR', effect: 'disarm' },
    { name: 'Distracting Strike', damageBonus: true, saveType: null, effect: 'distracting_strike_advantage' },
    { name: 'Goading Attack', damageBonus: true, saveType: 'WIS', effect: 'goad', conditionInflicted: 'goaded' },
    { name: 'Trip Attack', damageBonus: true, saveType: 'STR', effect: 'prone' },
];

const baseAttack = {
    name: 'Longsword',
    weaponType: 'melee',
};

const basePopupHtml = {
    hit: true,
    isCrit: false,
    targetName: 'Orc',
};

function makeProps(overrides = {}) {
    return {
        maneuvers: baseManeuvers,
        attack: baseAttack,
        popupHtml: basePopupHtml,
        onUse: vi.fn(),
        onSkip: vi.fn(),
        ...overrides,
    };
}

function renderPrompt(overrides = {}) {
    return render(<AttackRiderManeuverPrompt {...makeProps(overrides)} />);
}

function getManeuverRadio(name) {
    return screen.getByRole('radio', { name: new RegExp(name) });
}

// ── Prompt chrome, descriptors, and gating ──

describe('AttackRiderManeuverPrompt - prompt rendering and gating', () => {
    it('renders header, instruction, all maneuver radios, and gates Use Maneuver behind a selection', () => {
        renderPrompt();
        expect(screen.getByText(/Battle Master — Attack Rider Maneuver/)).toBeInTheDocument();
        expect(screen.getByText(/Choose an attack rider maneuver to use on this hit/)).toBeInTheDocument();
        baseManeuvers.forEach((m) => {
            expect(getManeuverRadio(m.name)).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled();
    });

    it('renders each maneuver with its exact descriptor fragments', () => {
        renderPrompt();
        const labelOf = (name) => getManeuverRadio(name).closest('label');
        expect(labelOf('Disarming Attack').textContent).toContain('adds superiority die to damage');
        expect(labelOf('Disarming Attack').textContent).toContain('STR save');
        expect(labelOf('Goading Attack').textContent).toContain('WIS save');
        expect(labelOf('Trip Attack').textContent).toContain('STR save');
        // Distracting Strike has saveType: null — no save fragment.
        expect(labelOf('Distracting Strike').textContent).not.toContain('save');
    });

    it.each([
        ['attack_roll_bonus effect', { name: 'Menacing Attack', effect: 'attack_roll_bonus' }, 'adds superiority die to attack roll'],
        ['damageBonus only', { name: 'Pushing Attack', damageBonus: true }, 'adds superiority die to damage'],
        ['no bonus flags or save', { name: 'Evasive Footwork' }, null],
    ])('renders descriptor for %s', (_case, maneuver, expectedText) => {
        renderPrompt({ maneuvers: [maneuver] });
        const label = getManeuverRadio(maneuver.name).closest('label');
        if (expectedText) {
            expect(label.textContent).toContain(expectedText);
        } else {
            expect(label.textContent).toBe(maneuver.name);
        }
    });

    it('switches header and instruction to Precision Attack mode when isMiss', () => {
        renderPrompt({ isMiss: true });
        expect(screen.getByText(/Battle Master — Precision Attack/)).toBeInTheDocument();
        expect(screen.getByText(/The attack missed\. Choose a maneuver to attempt to turn the miss into a hit/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeDisabled();
    });

    it('renders an empty maneuver list without crashing — no radios, Use stays disabled', () => {
        renderPrompt({ maneuvers: [] });
        expect(screen.queryAllByRole('radio')).toHaveLength(0);
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled();
    });
});

// ── Selection and the onUse write contract ──

describe('AttackRiderManeuverPrompt - selection and onUse contract', () => {
    it('enables Use Maneuver and marks the chosen radio checked', () => {
        renderPrompt();
        fireEvent.click(getManeuverRadio('Goading Attack'));
        expect(getManeuverRadio('Goading Attack')).toBeChecked();
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeEnabled();
    });

    it.each([
        [0],
        [baseManeuvers.length - 1],
    ])('calls onUse once with the exact maneuver, attack, and popupHtml objects (index %i)', (index) => {
        const onUse = vi.fn().mockResolvedValue({});
        renderPrompt({ onUse });
        fireEvent.click(getManeuverRadio(baseManeuvers[index].name));
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));

        expect(onUse).toHaveBeenCalledTimes(1);
        const [maneuverArg, attackArg, popupArg] = onUse.mock.calls[0];
        expect(maneuverArg).toBe(baseManeuvers[index]);
        expect(attackArg).toBe(baseAttack);
        expect(popupArg).toBe(basePopupHtml);
    });

    it('is inert with no selection — disabled Use, overlay, and inner-modal clicks fire nothing', () => {
        const onUse = vi.fn();
        const onSkip = vi.fn();
        renderPrompt({ onUse, onSkip });

        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        fireEvent.click(document.querySelector('.sp-overlay'));
        fireEvent.click(document.querySelector('.sp-modal'));

        expect(onUse).not.toHaveBeenCalled();
        expect(onSkip).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });
});

// ── Result screens ──

describe('AttackRiderManeuverPrompt - result screens', () => {
    const appliedCases = [
        [
            'payload screen',
            { payload: { name: 'Rider Result', description: '<strong>Rider applied.</strong>' } },
            'Rider Result',
            'Rider applied.',
        ],
        [
            'payload screen with fallback header when payload.name is missing',
            { payload: { description: 'Nameless body.' } },
            'Maneuver',
            'Nameless body.',
        ],
        [
            'generic applied screen when result carries no payload',
            {},
            'Maneuver Applied',
            'Maneuver applied. Proceed with damage.',
        ],
    ];

    it.each(appliedCases)('renders the %s, replacing the chooser', async (_case, res, headerText, bodyText) => {
        const onUse = vi.fn().mockResolvedValue(res);
        renderPrompt({ onUse });
        fireEvent.click(getManeuverRadio('Disarming Attack'));
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));

        await screen.findByRole('button', { name: 'Done' });
        expect(screen.getByText(headerText)).toBeInTheDocument();
        expect(screen.getByText(bodyText)).toBeInTheDocument();
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    });

    it('renders the isMissResult screen with a Precision Attack header even when the prompt was not in miss mode', async () => {
        const onUse = vi.fn().mockResolvedValue({
            isMissResult: true,
            description: 'Turned into a hit!',
        });
        renderPrompt({ isMiss: false, onUse });
        fireEvent.click(getManeuverRadio('Trip Attack'));
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));

        await screen.findByRole('button', { name: 'Done' });
        expect(screen.getByText(/Precision Attack/)).toBeInTheDocument();
        expect(screen.getByText('Turned into a hit!')).toBeInTheDocument();
        expect(screen.queryByText(/Attack Rider Maneuver/)).not.toBeInTheDocument();
    });

    it.each([
        ['payload screen', { payload: { name: 'Rider Result', description: 'Applied.' } }],
        ['generic applied screen', {}],
        ['isMissResult screen', { isMissResult: true, description: 'Turned into a hit.' }],
    ])('calls onSkip exactly once when Done is clicked on the %s', async (_case, res) => {
        const onUse = vi.fn().mockResolvedValue(res);
        const onSkip = vi.fn();
        renderPrompt({ isMiss: !!res.isMissResult, onUse, onSkip });
        fireEvent.click(getManeuverRadio('Disarming Attack'));
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));

        fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('stays inert to overlay and inner-modal clicks in the result state', async () => {
        const onUse = vi.fn().mockResolvedValue({});
        const onSkip = vi.fn();
        renderPrompt({ onUse, onSkip });
        fireEvent.click(getManeuverRadio('Disarming Attack'));
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));

        await screen.findByRole('button', { name: 'Done' });
        fireEvent.click(document.querySelector('.sp-overlay'));
        fireEvent.click(document.querySelector('.sp-modal'));

        expect(onSkip).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it.each([
        ['chooserOpened (MN-018 external chooser)', { chooserOpened: true }],
        ['null result', null],
    ])('stays on the chooser when onUse resolves %s — no result screen, selection retained', async (_case, res) => {
        const onUse = vi.fn().mockResolvedValue(res);
        const onSkip = vi.fn();
        renderPrompt({ onUse, onSkip });
        fireEvent.click(getManeuverRadio('Disarming Attack'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        });

        expect(onUse).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(screen.getAllByRole('radio')).toHaveLength(baseManeuvers.length);
        expect(getManeuverRadio('Disarming Attack')).toBeChecked();
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeEnabled();
        expect(onSkip).not.toHaveBeenCalled();
    });
});
