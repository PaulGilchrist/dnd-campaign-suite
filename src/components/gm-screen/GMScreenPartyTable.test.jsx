// @maintained-by-ai
// GM Screen party table contract: every cell derives from PlayerStats
// (fixtures) + the runtime store (seeded via getStore, the same shape SSE
// echoes adopt). Pins the lookup acceptance bar: all six saves, AC and the
// passives visible for every party member, live HP/conditions surfacing,
// and zero mutation affordances (badges render as spans).
import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import GMScreenPartyTable from './GMScreenPartyTable.jsx';
import { makePartyMember, seedCharStore, clearGMScreenStores, CAMPAIGN } from './gm-test-utils.jsx';

afterEach(() => {
    clearGMScreenStores(['Aragorn', 'Shadow']);
});

function renderTable(party, campaignEffects = []) {
    return render(
        <GMScreenPartyTable party={party} campaignName={CAMPAIGN} campaignEffects={campaignEffects} />
    );
}

describe('GMScreenPartyTable', () => {
    it('renders one row per party member with name, class/level and computed AC', () => {
        renderTable([makePartyMember()]);
        expect(screen.getByRole('row', { name: /Aragorn/ })).toBeInTheDocument();
        const row = screen.getByRole('row', { name: /Aragorn/ });
        expect(row).toHaveTextContent('Fighter 3');
        expect(row.cells[2]).toHaveTextContent('18');
    });

    it('shows all six saving throws with computed bonuses, proficiency highlighted', () => {
        renderTable([makePartyMember()]);
        const saves = document.querySelector('.gm-cell-saves');
        expect(saves.textContent).toContain('STR +5');
        expect(saves.textContent).toContain('DEX +1');
        expect(saves.textContent).toContain('CON +2');
        expect(saves.textContent).toContain('INT +0');
        expect(saves.textContent).toContain('WIS +3');
        // Negative bonus renders with the minus glyph (−1)
        expect(saves.textContent).toContain('CHA −1');
        const proficient = [...saves.querySelectorAll('.gm-save-proficient')].map(el => el.textContent.trim());
        expect(proficient).toEqual(['STR +5', 'WIS +3']);
    });

    it('lists only proficient skills (with bonuses), marks expertise, hides non-proficient', () => {
        renderTable([
            makePartyMember(
                { name: 'Shadow', expertise: ['Stealth'], skillProficiencies: ['Stealth', 'Acrobatics'] },
            ),
        ]);
        const skills = document.querySelector('.gm-cell-skills');
        expect(skills.textContent).toContain('Acrobatics +1');
        expect(skills.textContent).toContain('Stealth +1');
        expect(skills.textContent).not.toContain('Athletics');
        expect(skills.querySelector('.gm-skill-expert')).toHaveTextContent('Stealth +1');
    });

    it('HP defaults to the effective max and folds Aid/Feast increases live', () => {
        seedCharStore('Aragorn', { aidHpMaxIncrease: 5 });
        renderTable([makePartyMember()]);
        expect(document.querySelector('.gm-cell-hp')).toHaveTextContent('35 / 35');
    });

    it('current HP + conditions surface from the runtime store, with status colors', () => {
        seedCharStore('Aragorn', { currentHitPoints: 12, activeConditions: ['poisoned', 'poisoned', 'invisible'] });
        renderTable([makePartyMember()]);
        const hp = document.querySelector('.gm-cell-hp');
        expect(hp).toHaveTextContent('12 / 30');
        expect(hp).toHaveClass('gm-hp-bloodied');
        const badges = screen.getAllByTestId('creature-badge');
        expect(badges.map(b => b.textContent.trim())).toEqual(['Poisoned', 'Invisible']);
        // Tone law mirrors the sheet: Invisible is a buff, the rest conditions.
        expect(badges[0]).toHaveClass('effect-condition');
        expect(badges[1]).toHaveClass('effect-buff');
        // Pure presentation: badges render as spans, never buttons.
        expect(badges[0].tagName).toBe('SPAN');
    });

    it('zero-HP members paint the down state', () => {
        seedCharStore('Aragorn', { currentHitPoints: 0 });
        renderTable([makePartyMember()]);
        expect(document.querySelector('.gm-cell-hp')).toHaveClass('gm-hp-down');
    });

    it('temporary HP rides beside the current/max pair only when granted', () => {
        seedCharStore('Aragorn', { currentHitPoints: 20, tempHp: 8 });
        renderTable([makePartyMember()]);
        expect(document.querySelector('.gm-cell-hp').textContent).toContain('20 / 30 +8');
    });

    it('campaign target effects aimed at the character badge the In Play column', () => {
        renderTable([makePartyMember()], [
            { target: 'Aragorn', effect: 'disadvantage_next_attack', source: 'Rime' },
            { target: 'Someone Else', effect: 'disadvantage_next_attack' },
        ]);
        const status = document.querySelector('.gm-cell-status');
        expect(status.textContent).toContain('Disadv On Next Attack Roll');
        expect(status.textContent).not.toContain('Someone Else');
    });

    it('speed and resistances/immunities render compactly, with an em-dash when empty', () => {
        renderTable([makePartyMember({ resistances: ['Poison'], immunities: ['Necrotic'] })]);
        const row = screen.getByRole('row', { name: /Aragorn/ });
        expect(row.cells[6]).toHaveTextContent('30 ft.');
        expect(row.cells[7]).toHaveTextContent('Res Poison');
        expect(row.cells[7]).toHaveTextContent('Imm Necrotic');
        renderTable([makePartyMember({ name: 'Shadow' })]);
        const shadowRow = screen.getByRole('row', { name: /Shadow/ });
        expect(shadowRow.cells[7]).toHaveTextContent('—');
    });

    it('empty party renders the honest placeholder', () => {
        renderTable([]);
        expect(screen.getByText('No party members loaded yet.')).toBeInTheDocument();
        expect(document.querySelector('table')).not.toBeInTheDocument();
    });
});
