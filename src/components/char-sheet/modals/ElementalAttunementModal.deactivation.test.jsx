// @improved-by-ai
// CLA-113 regression: Attunement deactivation clear-list. When the results
// Close commits the attunement expiry clock, the effect list must ALSO drop the
// Elemental Epitome runtime footprint (CLA-110/CLA-113 render-only family):
// epitome flags + the epitome resistance activeBuffs entry + the numeric
// Destructive Stride speed_boost buff + destructiveStrideActive /
// destructiveStrideDamageType + the once-per-turn-per-creature latch.
// Everything in ONE addExpiration (playbook §39 — sequential clocks race).
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// ── Mocks ──

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((damage, success, dcSuccess) => {
        if (dcSuccess === 'half') return success ? Math.floor(damage / 2) : damage;
        return damage;
    }),
    computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./shared/AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
    default: vi.fn(({ targets, onConfirm, onSkip }) => (
        <div className="sp-overlay">
            <div className="sp-modal">
                <button data-testid="cs-confirm-btn" onClick={() => onConfirm(targets.map(t => t.name))} disabled={targets.length === 0}>
                    Confirm
                </button>
                <button data-testid="cs-skip-btn" onClick={onSkip}>Skip</button>
            </div>
        </div>
    )),
}));

// ── Re-import mocked modules ──

import * as combatData from '../../../services/encounters/combatData.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';

// ── Fixtures ──

const baseAction = { name: 'Elemental Attunement' };
const basePlayerStats = {
    name: 'Monk1',
    level: 5,
    proficiency: 3,
    abilities: [
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 4 },
        { name: 'Constitution', bonus: 1 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 1 },
        { name: 'Charisma', bonus: 0 },
    ],
};

function renderModal(props = {}) {
    const onClose = vi.fn();
    return {
        onClose,
        ...render(
            <ElementalAttunementModal
                action={baseAction}
                playerStats={basePlayerStats}
                campaignName="test-campaign"
                onClose={onClose}
                {...props}
            />
        ),
    };
}

// ── Tests ──

describe('ElementalAttunementModal — CLA-113 deactivation clear-list', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();
        combatData.getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'Goblin1', type: 'npc', saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
            ],
        });
        aoeService.getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7 } },
        ]);
    });

    it('registers ONE expiration whose effect list clears every epitome/stride key', async () => {
        renderModal({ activeOverlay: { type: 'sphere' } });
        fireEvent.click(screen.getByText('Fire'));
        await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /Close/ })));

        expect(addExpiration).toHaveBeenCalledTimes(1);
        const arg = addExpiration.mock.calls[0][0];
        const effects = arg.effects;
        const clearKeys = effects.filter(e => e.type === 'clear_runtime_value').map(e => e.key);
        const removedBuffs = effects.filter(e => e.type === 'remove_active_buff').map(e => e.buffName);

        // pre-existing keys stay
        expect(clearKeys).toEqual(expect.arrayContaining([
            'elementalAttunementActive',
            'elementalAttunementElement',
            'elementalEpitomeActive',
            'epitomeResistanceType',
            'epitomeEmpoweredUsedRound',
        ]));
        expect(removedBuffs).toContain('Stride of the Elements');

        // CLA-113 leak closures
        expect(clearKeys).toEqual(expect.arrayContaining([
            'destructiveStrideActive',
            'destructiveStrideDamageType',
            '_Destructive_Stride_usedRound',
        ]));
        expect(removedBuffs).toEqual(expect.arrayContaining(['Elemental Epitome', 'Destructive Stride']));

        // ONE clock anchored to the monk (no sequential addExpiration race)
        expect(arg.expireOnCreatureName).toBe('Monk1');
        expect(arg.campaignName).toBe('test-campaign');
    });
});
