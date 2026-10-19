// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HpBar from './HpBar.jsx';

// Owned contract: HP bar display bytes — for each representative hp/maxHp ratio,
// the fill's exact width AND backgroundColor bytes together (source oracle:
// pct = max > 0 ? clamp(current/max*100, 0, 100) : 0; color bands >50 green,
// >25 yellow, else red). Input→bytes only; no formula recomputed in test.
//
// NOT owned (cited, covered elsewhere):
//   HP input/commit semantics → CreatureHp.test.jsx (#854)
//   card state-class hp boundaries → CreatureCard tests (#853)
//   zero-network guard → #841 (leaf props-in/DOM-out; mock of HpBar in
//   CreatureHp.test.jsx belongs to that lane's bisect, not this one)
describe('HpBar', () => {
    it.each`
        current | max   | expectedWidth | expectedColor | reason
        ${20}   | ${20} | ${'100%'}     | ${'#2ecc71'}  | ${'full hp'}
        ${51}   | ${100} | ${'51%'}     | ${'#2ecc71'}  | ${'just above green boundary (pct > 50)'}
        ${50}   | ${100} | ${'50%'}     | ${'#f1c40f'}  | ${'green boundary falls to yellow'}
        ${26}   | ${100} | ${'26%'}     | ${'#f1c40f'}  | ${'just above yellow boundary (pct > 25)'}
        ${25}   | ${100} | ${'25%'}     | ${'#e74c3c'}  | ${'yellow boundary falls to red'}
        ${3}    | ${8}  | ${'37.5%'}    | ${'#f1c40f'}  | ${'fractional width, no rounding'}
        ${30}   | ${20} | ${'100%'}     | ${'#2ecc71'}  | ${'over-max clamps to 100%'}
        ${-5}   | ${20} | ${'0%'}       | ${'#e74c3c'}  | ${'negative clamps to 0% (covers hp 0 — same bytes)'}
        ${10}   | ${0}  | ${'0%'}       | ${'#e74c3c'}  | ${'max 0 guard: no NaN/Infinity'}
    `(
        'current=$current max=$max → width $expectedWidth, color $expectedColor ($reason)',
        ({ current, max, expectedWidth, expectedColor }) => {
            const { container } = render(<HpBar current={current} max={max} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: expectedWidth, backgroundColor: expectedColor });
        },
    );
});
