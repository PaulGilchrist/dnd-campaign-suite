// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CelestialRevelationModal from './CelestialRevelationModal.jsx';

// CelestialRevelationModal — component-only unit tests (choose-one chooser + result screen).
//
// Caller seams deferred elsewhere (deliberately NOT covered here):
// - celestial_revelation → handle() → celestialRevelationModal routing and mounting:
//   CharActionModals.SecondaryModals.jsx (this modal is mocked in
//   CharActionModals.secondary-targets.test.jsx and CharActionModals.async-confirm-handlers.test.jsx).
// - confirmCelestialRevelation behavior itself (level/uses gates, runtime-store writes,
//   expirations, buffs, campaign log): celestialRevelationHandler.test.js — this file
//   only pins the modal's exact call payloads, with same-object identity for the
//   pass-through playerStats/payload props.
// - Radiant rider in the attack pipeline (buildCelestialRevelationStep):
//   attackRollBonuses-cla048-celestial-rider.test.js.
//
// Component flags (noted, NOT fixed here):
// - MISSING CATCH lane: handleApply awaits confirmCelestialRevelation with no try/catch
//   (contrast BendFateModal.jsx, which has a mockRejected error/retry path). A handler
//   rejection here becomes an unhandled rejection with the chooser silently unchanged.
//   No error/retry test is invented until a catch exists in the component.
// - Inline styles: option-list wrapper, option labels, radio input, and the description
//   spans use style={{...}} instead of scoped sp-* classes.
//
// Conventions: makeProps returns fresh onClose/onSetConditionModal vi.fn per call;
// afterEach mockReset on the module mock (clearAllMocks does NOT strip mockResolvedValue);
// findBy idiom for async result screens; role-scoped queries; exact-arg assertions.

vi.mock('../../../services/automation/handlers/class-sorcerer/celestialRevelationHandler.js', () => ({
    confirmCelestialRevelation: vi.fn(),
}));

import * as celestialRevelationHandler from '../../../services/automation/handlers/class-sorcerer/celestialRevelationHandler.js';

// ── Fixtures ──

const TRANSFORM_OPTIONS = [
    { name: 'Heavenly Wings', damageType: 'Radiant' },
    { name: 'Inner Radiance', damageType: 'Radiant' },
    { name: 'Necrotic Shroud', damageType: 'Necrotic' },
];

// Handler-shaped popup with a handler-voice description that appears nowhere in the
// component, so result-screen assertions prove payload flow, not fixture echo.
function popupResult(chosenOption) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'CLA mock popup',
            description: `Handler confirms ${chosenOption} transformation armed.`,
        },
    };
}

function makeProps(overrides = {}) {
    return {
        action: { name: 'Celestial Revelation', automation: { type: 'celestial_revelation', chooseOne: true } },
        playerStats: { name: 'Sorcerer1', level: 5, proficiency: 3 },
        campaignName: 'test-campaign',
        onClose: vi.fn(),
        onSetConditionModal: vi.fn(),
        ...overrides,
    };
}

function renderModal(overrides = {}) {
    const props = makeProps(overrides);
    return { props, ...render(<CelestialRevelationModal {...props} />) };
}

const optionRadio = (name) => screen.getByRole('radio', { name: new RegExp(name) });
const transformButton = () => screen.getByRole('button', { name: 'Transform' });

afterEach(() => {
    celestialRevelationHandler.confirmCelestialRevelation.mockReset();
});

// ── Chooser rendering ──

describe('CelestialRevelationModal - chooser rendering', () => {
    it('renders header, instruction, all three radios unselected, Transform disabled, Cancel present', () => {
        renderModal();
        expect(screen.getByText('Celestial Revelation')).toBeInTheDocument();
        expect(screen.getByText(/Choose a transformation option \(Bonus Action, once per Long Rest\)/)).toBeInTheDocument();
        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(3);
        radios.forEach((radio) => expect(radio).not.toBeChecked());
        expect(transformButton()).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('shows a dash for damage type until an option is chosen', () => {
        renderModal();
        expect(screen.getByText(/of — type per turn/)).toBeInTheDocument();
    });

    it.each(TRANSFORM_OPTIONS.map(({ name, damageType }) => [name, damageType]))(
        'selecting %s checks only that radio (cap of one) and shows %s damage type',
        async (name, damageType) => {
            renderModal();
            fireEvent.click(optionRadio(name));
            expect(optionRadio(name)).toBeChecked();
            TRANSFORM_OPTIONS.filter((o) => o.name !== name).forEach((o) => expect(optionRadio(o.name)).not.toBeChecked());
            expect(screen.getByText(new RegExp(`Proficiency Bonus \\(3\\) of ${damageType} type per turn`))).toBeInTheDocument();
            expect(transformButton()).toBeEnabled();
        }
    );

    it('replaces the selection when a different option is clicked', () => {
        renderModal();
        fireEvent.click(optionRadio('Heavenly Wings'));
        fireEvent.click(optionRadio('Necrotic Shroud'));
        expect(optionRadio('Heavenly Wings')).not.toBeChecked();
        expect(optionRadio('Necrotic Shroud')).toBeChecked();
        expect(screen.getByText(/Proficiency Bonus \(3\) of Necrotic type per turn/)).toBeInTheDocument();
        expect(screen.queryByText(/of Radiant type per turn/)).not.toBeInTheDocument();
    });

    it.each([
        [{ name: 'S1', level: 3, proficiency: 5 }, '5'],
        [{}, '0'],
    ])('renders Proficiency Bonus (%s) from playerStats, defaulting missing values to 0', (playerStats, shown) => {
        renderModal({ playerStats });
        expect(screen.getByText(new RegExp(`Proficiency Bonus \\(${shown}\\)`))).toBeInTheDocument();
    });
});

// ── Gating and inertness ──

describe('CelestialRevelationModal - gating and inert paths', () => {
    it('disabled Transform with no selection never invokes the handler', () => {
        const { props } = renderModal();
        fireEvent.click(transformButton());
        expect(celestialRevelationHandler.confirmCelestialRevelation).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('Cancel closes once with the click event, without touching the handler', () => {
        const { props } = renderModal();
        fireEvent.click(optionRadio('Heavenly Wings'));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onClose.mock.calls[0][0].type).toBe('click'); // onClick={onClose} direct ref
        expect(props.onSetConditionModal).not.toHaveBeenCalled();
        expect(celestialRevelationHandler.confirmCelestialRevelation).not.toHaveBeenCalled();
    });

    it('overlay and modal clicks are inert both before and after transformation', async () => {
        celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(popupResult('Inner Radiance'));
        const { props, container } = renderModal();

        fireEvent.click(container.querySelector('.sp-overlay'));
        fireEvent.click(container.querySelector('.sp-modal'));
        expect(props.onClose).not.toHaveBeenCalled();

        fireEvent.click(optionRadio('Inner Radiance'));
        fireEvent.click(transformButton());
        await screen.findByRole('button', { name: 'Done' });

        fireEvent.click(container.querySelector('.sp-overlay'));
        expect(props.onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
});

// ── Transformation flow (popup lane) ──

describe('CelestialRevelationModal - transformation popup flow', () => {
    it.each(TRANSFORM_OPTIONS.map(({ name }) => [name]))(
        'applies %s with exact args: same playerStats object, option name, campaign name',
        async (name) => {
            celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(popupResult(name));
            const { props } = renderModal();
            fireEvent.click(optionRadio(name));
            fireEvent.click(transformButton());

            await screen.findByRole('button', { name: 'Done' });
            expect(celestialRevelationHandler.confirmCelestialRevelation).toHaveBeenCalledTimes(1);
            const [stats, chosen, campaign] = celestialRevelationHandler.confirmCelestialRevelation.mock.calls[0];
            expect(stats).toBe(props.playerStats);
            expect(chosen).toBe(name);
            expect(campaign).toBe('test-campaign');
        }
    );

    it.each(TRANSFORM_OPTIONS.map(({ name }) => [name]))(
        'result screen renders the handler description and retires the chooser for %s',
        async (name) => {
            // NOTE: for Necrotic Shroud the real handler returns a setCondition response
            // (pinned in the routing test below); the popup shape here exercises the
            // modal's own result-screen lane for every option.
            celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(popupResult(name));
            renderModal();
            fireEvent.click(optionRadio(name));
            fireEvent.click(transformButton());

            expect(await screen.findByText(`Handler confirms ${name} transformation armed.`)).toBeInTheDocument();
            expect(screen.getAllByRole('button')).toEqual([screen.getByRole('button', { name: 'Done' })]);
            expect(screen.queryByRole('radio')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        }
    );

    it('Done closes once with the click event', async () => {
        celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(popupResult('Heavenly Wings'));
        const { props } = renderModal();
        fireEvent.click(optionRadio('Heavenly Wings'));
        fireEvent.click(transformButton());
        fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onClose.mock.calls[0][0].type).toBe('click'); // onClick={onClose} direct ref
    });

    it('stays on the chooser when the handler resolves with no result', async () => {
        let settled = false;
        celestialRevelationHandler.confirmCelestialRevelation.mockImplementation(async () => {
            settled = true;
            return null;
        });
        const { props } = renderModal();
        fireEvent.click(optionRadio('Inner Radiance'));
        fireEvent.click(transformButton());
        await waitFor(() => expect(settled).toBe(true));
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
    });
});

// ── setCondition routing lane ──

describe('CelestialRevelationModal - setCondition routing', () => {
    it('closes then forwards the identical payload object to onSetConditionModal, skipping the result screen', async () => {
        const payload = {
            type: 'setCondition',
            name: 'Necrotic Shroud',
            automation: {
                type: 'set_condition',
                saveType: 'CHA',
                saveDc: 'ability',
                condition: 'frightened',
                range: '10 ft',
                duration: 'until_end_of_next_turn',
            },
        };
        celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({ type: 'setCondition', payload });
        const { props } = renderModal();
        fireEvent.click(optionRadio('Necrotic Shroud'));
        fireEvent.click(transformButton());

        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
        expect(props.onSetConditionModal).toHaveBeenCalledTimes(1);
        expect(props.onSetConditionModal.mock.calls[0][0]).toEqual({ setConditionModal: expect.any(Object) });
        expect(props.onSetConditionModal.mock.calls[0][0].setConditionModal).toBe(payload);
        expect(props.onClose.mock.invocationCallOrder[0]).toBeLessThan(props.onSetConditionModal.mock.invocationCallOrder[0]);
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
});
