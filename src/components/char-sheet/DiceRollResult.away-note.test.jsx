// @maintained-by-ai
// Regression: bug-away-initiative-roll-no-notice-rendered — processInitiativeRoll
// (hooks/combat/initiativeProcessing.js) refuses to stamp the tracker for an AWAY
// PC but threads awayNote on the popup payload. This lane pins the RENDER half:
// the note must land in the DOM as an amber notice under the total, and a normal
// (present) roll — no awayNote key — must render unchanged with no stray notice.
// Payload-side behaviour is pinned by initiativeProcessing.away.test.js.
import { render } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

const AWAY_NOTE = 'You are away from the party — this roll was not applied. Ask the GM to rejoin you.';

const renderInitiative = (props = {}) => render(
    <DiceRollResult name="Initiative" type="d20" rollType="initiative" rolls={[2]} bonus={5} {...props} />
);

describe('away note (split-party initiative popup)', () => {
    it('renders the awayNote text in the DOM when the payload carries one', () => {
        const { container } = renderInitiative({ awayNote: AWAY_NOTE });
        const notice = container.querySelector('.dice-roll-away-note');
        expect(notice).not.toBeNull();
        expect(notice.textContent).toContain(AWAY_NOTE);
    });

    it('sits directly under the roll total', () => {
        const { container } = renderInitiative({ awayNote: AWAY_NOTE });
        const order = Array.from(container.querySelectorAll('.dice-roll-total, .dice-roll-away-note'))
            .map(el => el.className);
        expect(order).toEqual(['dice-roll-total', 'dice-roll-away-note']);
    });

    it.each([
        { label: 'absent', value: undefined },
        { label: 'empty string', value: '' },
    ])('renders no notice row when awayNote is $label (normal roll unchanged)', ({ value }) => {
        const { container } = renderInitiative({ awayNote: value });
        expect(container.querySelector('.dice-roll-away-note')).toBeNull();
        expect(container.textContent).not.toMatch(/not applied/i);
    });
});
