// @maintained-by-ai 2026-11-25
/* Lane: TargetSelect honors the "Arm a target" deep link (backlog 2026-11-24
 * run BA). The sheet refusal's button arms a name-matched, single-shot focus
 * request (armTargetSignal); the matching card's select takes focus on its
 * mount effect (the request survives the sheet→Initiative navigation seam)
 * or via the subscription while already mounted. Laws pinned here:
 * name-matching (sibling cards never eat the request), the visitor
 * read-only face never consumes it, and honored requests never re-steal
 * focus on a later remount. Focus only — arming (onChange → combatSummary
 * PATCH) stays the untouched select lane. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import TargetSelect from './TargetSelect.jsx';
import {
    requestArmTarget,
    consumePendingArmTarget,
} from '../../services/ui/armTargetSignal.js';

const KORGATH = { name: 'Korgath', type: 'player', currentHp: 20 };
const OTHER = { name: 'FeyRanger', type: 'player', currentHp: 18 };
const ALL = [KORGATH, OTHER];

function renderSelects(props = {}) {
    return render(
        <div className="initiative">
            <TargetSelect
                allCreatures={ALL}
                overlays={[]}
                onTargetChange={vi.fn()}
                isLocalhost
                creature={KORGATH}
                {...props}
            />
        </div>
    );
}

afterEach(() => {
    consumePendingArmTarget('Korgath');
});

describe('TargetSelect arm-target deep link', () => {
    it('request armed BEFORE mount: the matching card select takes focus (navigation seam)', () => {
        requestArmTarget('Korgath');
        renderSelects();
        expect(document.activeElement).toBe(screen.getByTestId('target-select'));
    });

    it('request armed while mounted: the matching card select takes focus', () => {
        renderSelects();
        const select = screen.getByTestId('target-select');
        select.blur();
        requestArmTarget('Korgath');
        expect(document.activeElement).toBe(select);
    });

    it('a sibling card never eats the request and never steals focus', () => {
        requestArmTarget('Korgath');
        render(
            <div className="initiative">
                <TargetSelect allCreatures={ALL} overlays={[]} onTargetChange={vi.fn()} isLocalhost creature={OTHER} />
            </div>
        );
        expect(document.activeElement).not.toBe(screen.getByTestId('target-select'));
        // The request survives for the matching card, single-shot once consumed.
        expect(consumePendingArmTarget('Korgath')).toBe(true);
        expect(consumePendingArmTarget('Korgath')).toBe(false);
    });

    it('honored once = never re-stolen on a later mount', () => {
        requestArmTarget('Korgath');
        const view = renderSelects();
        expect(document.activeElement).toBe(screen.getByTestId('target-select'));
        view.unmount();
        const second = renderSelects();
        expect(document.activeElement).not.toBe(screen.getByTestId('target-select'));
        second.unmount();
    });

    it('visitor read-only face (no select): focuses nothing AND never consumes', () => {
        requestArmTarget('Korgath');
        render(
            <div className="initiative">
                <TargetSelect
                    allCreatures={ALL}
                    overlays={[]}
                    onTargetChange={vi.fn()}
                    isLocalhost={false}
                    localCharacterName="FeyRanger"
                    creature={KORGATH}
                />
            </div>
        );
        expect(screen.getByTestId('target-readonly')).toBeInTheDocument();
        expect(document.activeElement).not.toBe(screen.getByTestId('target-readonly'));
        // Still pending: a later GM mount (real select) would honor it.
        expect(consumePendingArmTarget('Korgath')).toBe(true);
    });
});
