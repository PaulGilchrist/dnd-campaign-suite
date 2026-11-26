// @maintained-by-ai 2026-11-25
// InitiativeLoot playtest soft gate (plan 2026-11-25): while the campaign
// carries an active `playtest` stamp the Generate/Award CTAs disable with
// the cause in their title. Generation/award HANDLERS are owned by
// useLootHandlers lanes — not re-driven here. The wrapper also accepts an
// explicit playtestActive override (forced prop) used by these pins.
import { render, screen } from '@testing-library/react';
import InitiativeLoot from './InitiativeLoot.jsx';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => null),
}));

const baseProps = {
    lootData: { lootEntries: ['a pouch of 25 gp'], totalEncounterXp: 100 },
    generatingLoot: false,
    lootTextValue: 'a pouch of 25 gp',
    setLootTextValue: vi.fn(),
    showAwardLoot: false,
    setShowAwardLoot: vi.fn(),
    awardingLoot: false,
    handleGenerateLoot: vi.fn(),
    handleAwardLoot: vi.fn(),
    handleClearLoot: vi.fn(),
    characters: [{ name: 'Thorin' }],
    campaignName: 'test-campaign',
};

it('normal campaign: Generate and Award are live', () => {
    render(<InitiativeLoot {...baseProps} playtestActive={false} />);
    expect(screen.getByRole('button', { name: /Generate Loot/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Award Loot/i })).toBeEnabled();
});

it('playtest active: both CTAs lock and the titles carry the cause', () => {
    render(<InitiativeLoot {...baseProps} playtestActive />);
    const generate = screen.getByRole('button', { name: /Generate Loot/i });
    const award = screen.getByRole('button', { name: /Award Loot/i });
    expect(generate).toBeDisabled();
    expect(award).toBeDisabled();
    expect(generate).toHaveAttribute('title', 'Disabled during playtest');
    expect(award).toHaveAttribute('title', 'Disabled during playtest');
});

it('playtest active: the staged Award-confirm action row stays locked too', () => {
    render(<InitiativeLoot {...baseProps} playtestActive showAwardLoot />);
    expect(screen.getByRole('button', { name: /Award Loot/i })).toBeDisabled();
});

it('the store stamp drives the gate when no explicit override is passed', async () => {
    const { useRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    vi.mocked(useRuntimeValue).mockReturnValueOnce({ active: true, snapshot: 's.zip', encounterName: 'X' });
    const props = { ...baseProps };
    delete props.playtestActive;
    render(<InitiativeLoot {...props} />);
    expect(screen.getByRole('button', { name: /Generate Loot/i })).toHaveAttribute('title', 'Disabled during playtest');
});
