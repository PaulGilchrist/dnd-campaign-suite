// @maintained-by-ai
// Regression pins for bug-extra-attack-display-only-never-rolls (chain half):
// once a press arms an Extra Attack chain, each swing resolves when the
// sheet's popup host drains, then the NEXT swing's popup is staged — never
// racing the previous swing's damage commit (dice-roll-done extends the
// wait across the commit faces), never re-granted by a second press within
// the same turn, and honestly abandoned when a staged hit is cancelled or
// the turn moves on. Harness idiom mirrors useCharActionsEventListeners.
// cleanup.test.jsx: rerender drives the popupHtml seam.
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useExtraAttackChain from './useExtraAttackChain.js';
import { getCurrentCombatRound, getActiveCreatureName } from '../../services/encounters/combatData.js';
import { addEntry } from '../../services/ui/logService.js';

vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => null),
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const PLAYER = 'TestFighter';
const LONGSWORD = { name: 'Longsword', type: 'Action', weaponType: 'melee', damage: '1d8+3', hitBonus: 6 };
const MISS_POPUP = { type: 'd20', rollType: 'attack', name: 'Longsword', hit: false, isAutoMiss: false, autoDamage: { name: 'Longsword', attackerName: PLAYER } };
const HIT_POPUP = { type: 'd20', rollType: 'attack', name: 'Longsword', hit: true, autoDamage: { name: 'Longsword', attackerName: PLAYER } };
const DAMAGE_POPUP = { type: 'damage', name: 'Longsword', damageApplied: true, targetName: 'Goblin' };

function playerStats(level, classLevels, rules) {
    return { name: PLAYER, level, rules, class: { name: 'Fighter', class_levels: classLevels } };
}
// Canonical table shapes: 5e nests the column, 2024 is top-level.
const fighter5eLevels = [{ level: 6, class_specific: { extra_attacks: 1 } }];
const fighter2024Levels = [{ level: 18, extra_attacks: 2 }];
const wizardLevels = [{ level: 10 }];

function makeControl(playerStatsOverride) {
    return {
        playerName: PLAYER,
        playerStats: playerStatsOverride || playerStats(6, fighter5eLevels),
        buildCtx: vi.fn(() => Promise.resolve({ hitBonus: 6 })),
        rollAttack: vi.fn(),
        exhaustionPenalty: 0,
        store: { activeCreatureName: PLAYER },
    };
}

function Harness({ control, popupHtml = null, sheetModalMounted = false, chainPromptArmed = false }) {
    control.result = useExtraAttackChain({
        playerName: control.playerName,
        campaignName: 'test-campaign',
        playerStats: control.playerStats,
        popupHtml,
        sheetModalMounted,
        chainPromptArmed,
        buildCtx: control.buildCtx,
        rollAttack: control.rollAttack,
        exhaustionPenalty: control.exhaustionPenalty,
        getRuntimeValue: (charKey, key) => (charKey === 'campaign'
            ? control.store.activeCreatureName
            : control.store[key] ?? null),
        setRuntimeValue: (charKey, key, value) => { control.store[key] = value; },
    });
    return null;
}

function begin(control, attack = LONGSWORD) {
    act(() => { control.result.beginExtraAttackChain(attack); });
}

function logRows(automationType) {
    return addEntry.mock.calls
        .map(c => c[1])
        .filter(e => !automationType || e.automationType === automationType);
}

// Stage a swing's popup, then drain it (the Done/dismiss seam), flushing the
// async buildCtx roll step — one full swing resolution.
async function cycle(view, control, props = {}) {
    await act(async () => { view.rerender(<Harness control={control} popupHtml={props.dwell ?? MISS_POPUP} {...(props.dwellProps || {})} />); });
    if (props.duringDwell) props.duringDwell();
    await act(async () => { view.rerender(<Harness control={control} popupHtml={props.afterDwell ?? null} {...(props.afterDwellProps || {})} />); });
    await act(async () => {});
}

describe('useExtraAttackChain — staged multi-swing popup chain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentCombatRound.mockReturnValue(1);
        getActiveCreatureName.mockReturnValue(null);
    });

    it('lv6 5e fighter press arms one queued swing; the grant row lands on the first advance, never at press', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);

        expect(control.store._extraAttackGrantedTurn).toEqual({ round: 1, activeCreature: PLAYER });
        // Regression pin (bug-extra-attack-grant-survives-attack-cancel): the
        // grant row is NOT press-time — an action cancelled before its first
        // swing resolved must never assert weapon attacks in the log.
        expect(logRows('extra_attack')).toHaveLength(0);

        await cycle(view, control); // swing 1 resolves → grant row + queued swing staged
        expect(logRows('extra_attack')).toHaveLength(1);
        expect(logRows('extra_attack')[0].description)
            .toBe(`${PLAYER} takes the Attack action with Extra Attack — 2 weapon attacks with Longsword.`);
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
        expect(control.rollAttack).toHaveBeenCalledWith('Longsword', 6, { hitBonus: 6 });

        await cycle(view, control); // chain finished — the second drain rolls nothing and re-logs nothing
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
        expect(logRows('extra_attack')).toHaveLength(1);
    });

    it('lv18 2024 fighter stages 2 queued swings (3 attacks per press)', async () => {
        const control = makeControl(playerStats(18, fighter2024Levels, '2024'));
        const view = render(<Harness control={control} />);
        begin(control);
        expect(logRows('extra_attack')).toHaveLength(0);

        await cycle(view, control); // first advance writes the single grant row
        expect(logRows('extra_attack')).toHaveLength(1);
        expect(logRows('extra_attack')[0].description).toContain('3 weapon attacks');

        await cycle(view, control);
        expect(control.rollAttack).toHaveBeenCalledTimes(2);
        expect(control.buildCtx).toHaveBeenCalledTimes(2);
        expect(control.buildCtx).toHaveBeenLastCalledWith(LONGSWORD);

        // Drain one more time — the chain is finished and stays quiet.
        await cycle(view, control);
        expect(control.rollAttack).toHaveBeenCalledTimes(2);
    });

    it('a second press the same turn does not re-grant extra swings (action budget spent)', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        await cycle(view, control);
        expect(control.rollAttack).toHaveBeenCalledTimes(1);

        // Press again this turn: the grant latch refuses a fresh chain.
        begin(control);
        expect(logRows('extra_attack')).toHaveLength(1);
        await cycle(view, control);
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('round wrap re-arms the budget for the new turn', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        await cycle(view, control);
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
        expect(logRows('extra_attack')).toHaveLength(1);

        getCurrentCombatRound.mockReturnValue(2);
        begin(control);
        // The new press asserts nothing until its own first swing resolves.
        expect(logRows('extra_attack')).toHaveLength(1);
        await cycle(view, control);
        expect(logRows('extra_attack')).toHaveLength(2);
        expect(control.rollAttack).toHaveBeenCalledTimes(2);
    });

    it('staged HIT: the next swing waits for the damage commit faces (dice-roll-done bridge)', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);

        // Done on a HIT dispatches dice-roll-done then closes the popup —
        // the drain must NOT stage swing 2 while the commit is in flight.
        await cycle(view, control, {
            dwell: HIT_POPUP,
            duringDwell: () => act(() => {
                window.dispatchEvent(new CustomEvent('dice-roll-done', {
                    detail: { autoDamage: HIT_POPUP.autoDamage, isCrit: false, hit: true },
                }));
            }),
        });
        expect(control.rollAttack).not.toHaveBeenCalled();

        // The commit's own face (damage popup) mounts and drains → swing 2.
        await cycle(view, control, { dwell: DAMAGE_POPUP });
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('rider chooser during the commit extends the wait (sheet modal dwell)', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        await cycle(view, control, {
            dwell: HIT_POPUP,
            duringDwell: () => act(() => {
                window.dispatchEvent(new CustomEvent('dice-roll-done', { detail: { autoDamage: HIT_POPUP.autoDamage } }));
            }),
            // popup closed but the sheet's chooser modal is still mounted
            afterDwell: null,
            afterDwellProps: { sheetModalMounted: true },
        });
        expect(control.rollAttack).not.toHaveBeenCalled();

        await cycle(view, control, { dwell: DAMAGE_POPUP });
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('armed rider-chain save prompt holds the next swing (drain-order law)', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        await cycle(view, control, {
            dwell: HIT_POPUP,
            duringDwell: () => act(() => {
                window.dispatchEvent(new CustomEvent('dice-roll-done', { detail: { autoDamage: HIT_POPUP.autoDamage } }));
            }),
        });
        // Damage face auto-retired under the prompt: popup null, prompt armed.
        await act(async () => { view.rerender(<Harness control={control} popupHtml={DAMAGE_POPUP} />); });
        await act(async () => { view.rerender(<Harness control={control} popupHtml={null} chainPromptArmed />); });
        await act(async () => {});
        expect(control.rollAttack).not.toHaveBeenCalled();

        await act(async () => { view.rerender(<Harness control={control} popupHtml={null} />); });
        await act(async () => {});
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('Cancel of the pressed swing drops the chain, logs no grant row, and refunds the turn latch', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        await cycle(view, control, {
            dwell: HIT_POPUP,
            duringDwell: () => act(() => {
                window.dispatchEvent(new CustomEvent('attack-staged-cancelled', {
                    detail: { characterName: PLAYER, attackName: 'Longsword' },
                }));
            }),
        });
        expect(control.rollAttack).not.toHaveBeenCalled();
        // Regression pin (bug-extra-attack-grant-survives-attack-cancel): the
        // voided press never asserts its attacks in the log, and the per-turn
        // grant is refunded (§7.2 no-consume-on-void) — store-null, so the
        // same-turn re-press below re-grants the FULL chain.
        expect(logRows('extra_attack')).toHaveLength(0);
        expect(control.store._extraAttackGrantedTurn).toBeNull();

        begin(control);
        expect(control.store._extraAttackGrantedTurn).toEqual({ round: 1, activeCreature: PLAYER });
        await cycle(view, control); // re-press swing 1 resolves → grant row + fresh queued swing
        expect(logRows('extra_attack')).toHaveLength(1);
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
        await cycle(view, control); // queued swing resolves → chain finishes quietly
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('Cancel of a LATER swing keeps the latch (the action already advanced)', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        await cycle(view, control); // swing 1 MISS resolves: grant row logged, swing 2 staged
        expect(logRows('extra_attack')).toHaveLength(1);
        expect(control.rollAttack).toHaveBeenCalledTimes(1);

        await cycle(view, control, {
            dwell: HIT_POPUP,
            duringDwell: () => act(() => {
                window.dispatchEvent(new CustomEvent('attack-staged-cancelled', {
                    detail: { characterName: PLAYER, attackName: 'Longsword' },
                }));
            }),
        });
        // Swing 2 was the last queued — nothing more stages, and the spent
        // action keeps its latch (a partially-committed Attack action stays
        // spent; only the voided swing's own rows tell the story).
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
        expect(control.store._extraAttackGrantedTurn).toEqual({ round: 1, activeCreature: PLAYER });
        begin(control);
        expect(logRows('extra_attack')).toHaveLength(1);
        await cycle(view, control);
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('the chain belongs to the press, not the active row — it keeps staging off-turn (lenient press model)', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        await act(async () => { view.rerender(<Harness control={control} popupHtml={MISS_POPUP} />); });
        control.store.activeCreatureName = 'Goblin';
        await act(async () => { view.rerender(<Harness control={control} popupHtml={null} />); });
        await act(async () => {});
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
        expect(logRows('extra_attack_abandoned')).toHaveLength(0);
    });

    it('out of combat (no round) still grants the multi-attack and stamps no latch', async () => {
        getCurrentCombatRound.mockReturnValue(null);
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        expect(control.store._extraAttackGrantedTurn).toBeUndefined();
        await cycle(view, control);
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('a press on a new turn replaces a stalled never-drained chain (host ownership)', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        // Never drained — next turn, a Javelin press replaces the stale chain.
        getCurrentCombatRound.mockReturnValue(2);
        const javelin = { name: 'Javelin', type: 'Action', weaponType: 'melee', damage: '1d6+3' };
        begin(control, javelin);
        await cycle(view, control);
        expect(control.buildCtx).toHaveBeenCalledWith(javelin);
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('non-Extra-Attack characters and bonus-action rows never arm a chain', async () => {
        const wizard = makeControl({ name: PLAYER, level: 10, class: { name: 'Wizard', class_levels: wizardLevels } });
        const wizardView = render(<Harness control={wizard} />);
        begin(wizard);
        await cycle(wizardView, wizard);
        expect(wizard.rollAttack).not.toHaveBeenCalled();
        wizardView.unmount();

        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control, { name: 'Dagger', type: 'Bonus Action', weaponType: 'melee' });
        expect(logRows('extra_attack')).toHaveLength(0);
        await cycle(view, control);
        expect(control.rollAttack).not.toHaveBeenCalled();
    });

    it('dice-roll-done from a different attacker does not hold this chain', async () => {
        const control = makeControl();
        const view = render(<Harness control={control} />);
        begin(control);
        await cycle(view, control, {
            dwell: MISS_POPUP,
            duringDwell: () => act(() => {
                window.dispatchEvent(new CustomEvent('dice-roll-done', {
                    detail: { autoDamage: { name: 'Bite', attackerName: 'Goblin' } },
                }));
            }),
        });
        expect(control.rollAttack).toHaveBeenCalledTimes(1);
    });
});
