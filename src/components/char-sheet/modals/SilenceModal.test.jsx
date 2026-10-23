// @maintained-by-ai
/**
 * SilenceModal — execution owner for the Silence spell popup.
 * Lane map (verified 2026-10-17):
 *   - Routing into this modal: silenceHandler.test.js (opens silence_target_selection).
 *   - Shared picker UI (rows, toggle, count label, confirm-disabled-at-0,
 *     empty state, Skip, string targets, pre-confirm inertness):
 *     shared/CreatureSelectionModal.test.jsx — not re-tested here.
 *   - Zone consumption after the cast: silenceService.test.js,
 *     clearExpirationEffects_additional_types.test.js (clear_silence_zone).
 * This file owns the modal's confirm dispatch: the Silence config forwarded to
 * the REAL picker, the zone triple (silenceCaster/silenceCenter/silenceRadius),
 * point-model center precedence, outside-radius refusal (real getDistanceFeet),
 * Deafened normalization, Silence buff grant/dedup, exact addExpiration
 * payloads, log discipline, combat-summary-updated + close, and cancel inertness.
 * RAW: Silence has no saving throw — nothing here rolls, no RNG seam needed.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/rules/features/silenceService.js', () => ({
    addSilencedTarget: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

import SilenceModal from './SilenceModal.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { addSilencedTarget } from '../../../services/rules/features/silenceService.js';
import { getCombatContext } from '../../../services/rules/combat/damageUtils.js';

const CAMPAIGN = 'test-campaign';

const baseProps = {
    playerStats: { name: 'Wizard1' },
    campaignName: CAMPAIGN,
    aoeRadius: 20,
    onClose: vi.fn(),
    creatureTargets: [
        { name: 'Goblin1', type: 'npc' },
        { name: 'Orc Warrior', type: 'npc' },
        { name: 'Elf Mage', type: 'player' },
    ],
};

function renderModal(overrides = {}) {
    return render(<SilenceModal {...baseProps} {...overrides} />);
}

function selectTarget(name) {
    fireEvent.click(screen.getByRole('checkbox', { name }));
}

function confirmButton(count) {
    return screen.getByRole('button', { name: `Cast Silence (${count})` });
}

async function confirm(count) {
    await act(async () => {
        fireEvent.click(confirmButton(count));
    });
}

const runtimeWrites = (key) => setRuntimeValue.mock.calls.filter((c) => c[1] === key);
const logsOfType = (type) => addEntry.mock.calls.filter((c) => c[1].type === type);

beforeEach(() => {
    baseProps.onClose.mockReset();
    setRuntimeValue.mockReset();
    getRuntimeValue.mockReset().mockImplementation(() => null);
    addEntry.mockReset().mockImplementation(() => Promise.resolve());
    addExpiration.mockReset();
    addSilencedTarget.mockReset();
    getCombatContext.mockReset().mockResolvedValue(null);
});

describe('SilenceModal', () => {
    it('renders the Silence spell config on the picker with nothing castable until a target is picked', () => {
        const { container } = renderModal();
        expect(screen.getByText('Silence')).toBeInTheDocument();
        expect(container.querySelector('.sp-header .fa-volume-xmark')).toBeInTheDocument();
        expect(screen.getByText(/no sound can be created/).textContent).toContain('20-foot-radius sphere');
        expect(screen.getAllByRole('checkbox')).toHaveLength(3);
        expect(confirmButton(0)).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });

    // fix#155 truth-law: the picker description must show the SAME radius the
    // write side uses (silenceRadius zone write, refusal check, ability_use log)
    // — never a hardcoded 20 while the flow casts a wider or narrower sphere.
    describe('description radius is coupled to the write-side aoeRadius', () => {
        const descriptionText = () => screen.getByText(/no sound can be created/).textContent;
        const shownRadius = () => Number(descriptionText().match(/(\d+)-foot-radius/)[1]);

        for (const radius of [5, 20, 30]) {
            it(`displays the ${radius}-foot radius it will write, never a stale 20`, async () => {
                const view = renderModal({ aoeRadius: radius });
                expect(descriptionText()).toContain(`${radius}-foot-radius sphere`);
                if (radius !== 20) {
                    expect(descriptionText()).not.toContain('20-foot-radius');
                }
                selectTarget('Goblin1');
                await confirm(1);

                // Same-source coupling pin: displayed number == zone-written number
                // == number in the ability_use log.
                expect(shownRadius()).toBe(runtimeWrites('silenceRadius')[0][2]);
                expect(logsOfType('ability_use')[0][1].description).toContain(`${radius}-foot-radius sphere`);
                view.unmount();
            });
        }

        it('prop absent: display default == write default (documented RAW 20-ft sphere)', async () => {
            const view = renderModal({ aoeRadius: undefined });
            expect(descriptionText()).toContain('20-foot-radius sphere');
            selectTarget('Goblin1');
            await confirm(1);

            expect(shownRadius()).toBe(runtimeWrites('silenceRadius')[0][2]);
            expect(runtimeWrites('silenceRadius')[0][2]).toBe(20);
            expect(logsOfType('ability_use')[0][1].description).toContain('20-foot-radius sphere');
            view.unmount();
        });

        it('refusal copy names the actual radius too (30-ft sphere, 42-ft outsider)', async () => {
            // Center = Goblin1 @(2,2). Orc Warrior @(8,8): sqrt(72)*5 ≈ 42.4 ft > 30.
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
                creatures: [
                    { name: 'Goblin1', gridX: 2, gridY: 2 },
                    { name: 'Orc Warrior', gridX: 8, gridY: 8 },
                ],
            });
            const view = renderModal({ aoeRadius: 30 });
            selectTarget('Goblin1');
            selectTarget('Orc Warrior');
            await confirm(2);

            const refusal = logsOfType('automation')[0][1];
            expect(refusal.description).toContain('outside the 30-foot-radius sphere');
            expect(refusal.description).not.toContain('20-foot-radius');
            // 42.4 ft is inside 30? no — 42.4 > 30 so refusal stands.
            expect(refusal.creatureName).toBe('Orc Warrior');
            view.unmount();
        });
    });

    it('closes via Skip without touching any runtime state', () => {
        renderModal();
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addSilencedTarget).not.toHaveBeenCalled();
    });

    it('forwards undefined creatureTargets as the picker empty state', () => {
        renderModal({ creatureTargets: undefined });
        expect(screen.getByText('No targets available.')).toBeInTheDocument();
        expect(confirmButton(0)).toBeDisabled();
    });

    // Point-model ("point you choose"): first placed picked token wins, then
    // the caster, then null. Also pins silenceCaster=true and the radius write
    // on every successful confirm.
    describe('zone writes (silenceCaster / silenceCenter / silenceRadius)', () => {
        const centerCases = [
            {
                label: 'the first picked token with a grid position',
                context: {
                    players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
                    creatures: [
                        { name: 'Goblin1', gridX: 8, gridY: 8 },
                        { name: 'Orc Warrior', gridX: 10, gridY: 10 },
                    ],
                },
                select: ['Goblin1', 'Orc Warrior'],
                center: { gridX: 8, gridY: 8 },
            },
            {
                label: 'the caster when no picked token is placed',
                context: { players: [{ name: 'Wizard1', gridX: 5, gridY: 5 }] },
                select: ['Goblin1'],
                center: { gridX: 5, gridY: 5 },
            },
            {
                label: 'null when there is no combat context',
                context: null,
                select: ['Goblin1'],
                center: null,
            },
            {
                label: 'null when no combatant has a grid position',
                context: {
                    players: [{ name: 'Wizard1' }],
                    creatures: [{ name: 'Goblin1' }],
                },
                select: ['Goblin1'],
                center: null,
            },
        ];

        for (const tc of centerCases) {
            it(`centers the zone on ${tc.label}`, async () => {
                getCombatContext.mockResolvedValue(tc.context);
                const view = renderModal();
                tc.select.forEach(selectTarget);
                await confirm(tc.select.length);

                expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
                expect(setRuntimeValue).toHaveBeenCalledWith('Wizard1', 'silenceCaster', true, CAMPAIGN);
                const centerWrites = runtimeWrites('silenceCenter');
                expect(centerWrites).toHaveLength(1);
                if (tc.center === null) {
                    expect(centerWrites[0][2]).toBe(null);
                } else {
                    expect(JSON.parse(centerWrites[0][2])).toEqual(tc.center);
                }
                expect(setRuntimeValue).toHaveBeenCalledWith('Wizard1', 'silenceRadius', 20, CAMPAIGN);
                view.unmount();
            });
        }
    });

    it('refuses a picked creature provably outside the sphere without granting anything to it', async () => {
        // Center = Goblin1 @(2,2). Orc Warrior @(8,8): sqrt(72)*5 ≈ 42.4 ft > 20.
        getCombatContext.mockResolvedValue({
            players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            creatures: [
                { name: 'Goblin1', gridX: 2, gridY: 2 },
                { name: 'Orc Warrior', gridX: 8, gridY: 8 },
            ],
        });
        renderModal();
        selectTarget('Goblin1');
        selectTarget('Orc Warrior');
        await confirm(2);

        const conditionWrites = runtimeWrites('activeConditions');
        expect(conditionWrites).toEqual([['Goblin1', 'activeConditions', ['deafened'], CAMPAIGN]]);
        expect(addSilencedTarget).toHaveBeenCalledTimes(1);
        expect(addSilencedTarget).toHaveBeenCalledWith('Wizard1', 'Goblin1', CAMPAIGN);
        expect(addExpiration.mock.calls.filter((c) => c[0].targetName === 'Orc Warrior')).toHaveLength(0);
        expect(runtimeWrites('activeBuffs').filter((c) => c[0] === 'Orc Warrior')).toHaveLength(0);

        const refusals = logsOfType('automation');
        expect(refusals).toHaveLength(1);
        expect(refusals[0][1].creatureName).toBe('Orc Warrior');
        expect(refusals[0][1].description).toContain('Orc Warrior is 42 ft from the Silence center');
        expect(refusals[0][1].description).toContain('outside the 20-foot-radius sphere');

        const ability = logsOfType('ability_use');
        expect(ability).toHaveLength(1);
        expect(ability[0][1].description).toContain('Goblin1 is Deafened.');
        expect(ability[0][1].description).not.toContain('Orc Warrior');
    });

    it('writes Deafened to each accepted target, re-normalizing an existing deafened condition', async () => {
        const fresh = renderModal();
        selectTarget('Goblin1');
        selectTarget('Orc Warrior');
        await confirm(2);
        expect(runtimeWrites('activeConditions')).toEqual([
            ['Goblin1', 'activeConditions', ['deafened'], CAMPAIGN],
            ['Orc Warrior', 'activeConditions', ['deafened'], CAMPAIGN],
        ]);
        fresh.unmount();

        // Already deafened + blinded: deafened is filtered out then re-appended,
        // other conditions preserved.
        setRuntimeValue.mockReset();
        getRuntimeValue.mockImplementation((name, key) =>
            (key === 'activeConditions' && name === 'Goblin1') ? ['deafened', 'blinded'] : null);
        renderModal();
        selectTarget('Goblin1');
        await confirm(1);
        expect(runtimeWrites('activeConditions')).toEqual([
            ['Goblin1', 'activeConditions', ['blinded', 'deafened'], CAMPAIGN],
        ]);
    });

    it('grants a caster-sourced concentration Silence buff to caster and targets, skipping creatures that already have it', async () => {
        const fresh = renderModal();
        selectTarget('Goblin1');
        await confirm(1);
        const freshBuffWrites = runtimeWrites('activeBuffs');
        expect(freshBuffWrites.map((c) => c[0])).toEqual(['Wizard1', 'Goblin1']);
        for (const write of freshBuffWrites) {
            expect(write[2]).toContainEqual({
                name: 'Silence',
                effect: 'silence',
                duration: 'concentration',
                sourceCharacter: 'Wizard1',
            });
        }
        fresh.unmount();

        // Caster already carries the Silence buff: no duplicate write for him,
        // the fresh target still gets it.
        setRuntimeValue.mockReset();
        getRuntimeValue.mockImplementation((name, key) =>
            (key === 'activeBuffs' && name === 'Wizard1')
                ? [{ name: 'Silence', effect: 'silence', duration: 'concentration', sourceCharacter: 'Wizard1' }]
                : null);
        renderModal();
        selectTarget('Goblin1');
        await confirm(1);
        const buffWrites = runtimeWrites('activeBuffs');
        expect(buffWrites).toHaveLength(1);
        expect(buffWrites[0][0]).toBe('Goblin1');
    });

    it('dispatches exact expiration payloads per target and once for the caster', async () => {
        renderModal();
        selectTarget('Goblin1');
        await confirm(1);

        expect(addExpiration).toHaveBeenCalledTimes(2);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Wizard1',
            targetName: 'Goblin1',
            effects: [
                { type: 'condition', condition: 'deafened' },
                { type: 'remove_active_buff', buffName: 'Silence' },
            ],
            campaignName: CAMPAIGN,
        });
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Wizard1',
            targetName: 'Wizard1',
            effects: [
                { type: 'remove_active_buff', buffName: 'Silence' },
                { type: 'clear_silence_zone', casterName: 'Wizard1' },
                { type: 'clear_runtime_value', creatureName: 'Wizard1', key: 'silenceCaster' },
                { type: 'clear_runtime_value', creatureName: 'Wizard1', key: 'silenceCenter' },
                { type: 'clear_runtime_value', creatureName: 'Wizard1', key: 'silenceRadius' },
            ],
            campaignName: CAMPAIGN,
        });
    });

    it('logs a condition entry per target plus a final ability_use carrying radius and accepted names, then refreshes and closes', async () => {
        const eventListener = vi.fn();
        window.addEventListener('combat-summary-updated', eventListener);
        renderModal({ aoeRadius: 30 });
        selectTarget('Goblin1');
        selectTarget('Orc Warrior');
        await confirm(2);

        const conditionLogs = logsOfType('condition');
        expect(conditionLogs).toHaveLength(2);
        expect(conditionLogs.map((c) => c[1].characterName)).toEqual(['Goblin1', 'Orc Warrior']);
        for (const log of conditionLogs) {
            expect(log[1].condition).toBe('Deafened');
            expect(log[1].reason).toBe('Silence spell');
            expect(log[1].note).toContain('Verbal');
        }

        const abilityLogs = logsOfType('ability_use');
        expect(abilityLogs).toHaveLength(1);
        expect(abilityLogs[0][1].characterName).toBe('Wizard1');
        expect(abilityLogs[0][1].abilityName).toBe('Silence');
        expect(abilityLogs[0][1].description).toContain('30-foot-radius');
        expect(abilityLogs[0][1].description).toContain('Goblin1 is Deafened. Orc Warrior is Deafened.');
        expect(runtimeWrites('silenceRadius')[0][2]).toBe(30);

        expect(eventListener).toHaveBeenCalledTimes(1);
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        window.removeEventListener('combat-summary-updated', eventListener);
    });

    it('survives a rejected condition log — cast still completes, logs, and closes', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
        addEntry.mockRejectedValueOnce(new Error('log failed'));
        renderModal();
        selectTarget('Goblin1');
        selectTarget('Orc Warrior');
        await confirm(2);

        expect(consoleSpy).toHaveBeenCalled();
        expect(addSilencedTarget).toHaveBeenCalledTimes(2);
        expect(logsOfType('ability_use')).toHaveLength(1);
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
    });
});
