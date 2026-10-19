// @maintained-by-ai
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { getStore, notify } from '../../hooks/runtime/useRuntimeState.js';
import TurnEconomyStrip from './TurnEconomyStrip.jsx';

// Lane: TurnEconomyStrip render contract (L5-001) — zero-module-mock leaf
// (exemplar: HpBar #862). The strip is props+runtime-store in, exact bytes
// out; useRuntimeValue is an in-memory subscription (no fetch on this path,
// #841), so the real campaign store is seeded directly — no mocks needed.
//
// Owned here: enforcement/name gating · exact badge-text census incl order ·
// movement bytes incl boundaries · buff/debuff class legs · live refresh of
// a mounted strip when turnState broadcasts.
// NOT owned (cited, covered elsewhere):
//   spend/refund/caps/rearm/companion accounting → turnState.test.js
//   default-speed fallback LOGIC → turnState.test.js (movement); this lane
//     pins only the strip's rendered byte when speedFeet is absent
//   turn-economy stamp persistence at navigation seams → navigationHandlers.*
//   mount wiring (which creature/name reaches the strip) → CreatureCard /
//     Initiative / CharSummary lanes
//
// Old → new map: old "off/unset renders nothing" → gate matrix rows 1–3;
// old "full budget" → oracle row 1–2; old "spent states" → oracle rows 3–6
// (now covers the missing 'Bonus used' leg); old "30 ft default" → oracle
// rows 1 + 2 (forwarding vs hardcoded); old "empty name" → gate rows 4–5.

function prime(enforcement, turnState) {
    const store = getStore('campaign');
    if (enforcement !== undefined) store.set('enforcement', enforcement);
    if (turnState !== undefined) store.set('turnState', turnState);
}

beforeEach(() => {
    getStore('campaign').clear();
});

function badgeTexts() {
    return screen.getAllByTestId('creature-badge').map(el => el.textContent.trim());
}

describe('TurnEconomyStrip (L5-001)', () => {
    it.each`
        enforcement            | creatureName | reason
        ${undefined}           | ${'Rakan'}   | ${'enforcement key absent'}
        ${{ mode: 'off' }}     | ${'Rakan'}   | ${'enforcement off (today\'s view unchanged)'}
        ${{ mode: 'lenient' }} | ${'Rakan'}   | ${'unknown mode never turns the strip on'}
        ${{ mode: 'on' }}      | ${null}      | ${'no creature to show economy for'}
        ${{ mode: 'on' }}      | ${''}        | ${'blank creature name'}
    `('renders zero DOM when gated — $reason', ({ enforcement, creatureName }) => {
        prime(enforcement);
        const { container } = render(<TurnEconomyStrip creatureName={creatureName} speedFeet={30} />);
        expect(container).toBeEmptyDOMElement();
    });

    it.each`
        turnState                                                          | speedFeet     | expected                                                        | reason
        ${undefined}                                                       | ${undefined}  | ${['Action', 'Bonus', 'Reaction', '0/30 ft']}           | ${'fresh turn, unknown speed → 30 ft baseline byte'}
        ${undefined}                                                       | ${50}         | ${['Action', 'Bonus', 'Reaction', '0/50 ft']}           | ${'speedFeet is forwarded, not hardcoded to 30'}
        ${{ Rakan: { actionsUsed: 1 } }}                                 | ${30}         | ${['Action used', 'Bonus', 'Reaction', '0/30 ft']}      | ${'spent action shows exhausted, others stay fresh'}
        ${{ Rakan: { bonusActionsUsed: 1 } }}                          | ${30}         | ${['Action', 'Bonus used', 'Reaction', '0/30 ft']}      | ${'bonus leg was untested before'}
        ${{ Rakan: { reactionsUsed: 1 } }}                             | ${30}         | ${['Action', 'Bonus', 'Reaction used', '0/30 ft']}      | ${'reaction leg'}
        ${{ Rakan: { actionsUsed: 1, bonusActionsUsed: 1, reactionsUsed: 1, movementUsedFeet: 10 } }} | ${30} | ${['Action used', 'Bonus used', 'Reaction used', '10/30 ft']} | ${'all spent + partial movement'}
        ${{ Rakan: { movementUsedFeet: 30 } }}                         | ${30}         | ${['Action', 'Bonus', 'Reaction', '30/30 ft']}          | ${'movement exactly at speed (remaining hits 0)'}
        ${{ Rakan: { movementUsedFeet: 40 } }}                         | ${30}         | ${['Action', 'Bonus', 'Reaction', '40/40 ft']}          | ${'overspend: denominator collapses to used, never negative or 40/30'}
    `('badge census + movement bytes: $reason', ({ turnState, speedFeet, expected }) => {
        prime({ mode: 'on' }, turnState);
        render(<TurnEconomyStrip creatureName="Rakan" speedFeet={speedFeet} />);
        expect(screen.getByLabelText('Turn economy for Rakan')).toBeInTheDocument();
        expect(badgeTexts()).toEqual(expected);
    });

    it('refreshes in place when turnState broadcasts (live wiring, no remount)', () => {
        prime({ mode: 'on' });
        render(<TurnEconomyStrip creatureName="Rakan" speedFeet={30} />);
        const fresh = screen.getAllByTestId('creature-badge');
        expect(fresh.map(el => el.textContent.trim())).toEqual(['Action', 'Bonus', 'Reaction', '0/30 ft']);
        expect(fresh.map(el => el.className)).toEqual([
            'creature-badge effect-buff',
            'creature-badge effect-buff',
            'creature-badge effect-buff',
            'creature-badge effect-neutral',
        ]);

        act(() => {
            prime(undefined, { Rakan: { actionsUsed: 1, bonusActionsUsed: 1, reactionsUsed: 1, movementUsedFeet: 30 } });
            notify('campaign');
        });

        const spent = screen.getAllByTestId('creature-badge');
        expect(spent.map(el => el.textContent.trim())).toEqual(['Action used', 'Bonus used', 'Reaction used', '30/30 ft']);
        expect(spent.map(el => el.className)).toEqual(Array(4).fill('creature-badge effect-debuff'));
    });
});
