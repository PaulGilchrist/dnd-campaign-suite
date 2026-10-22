import { executeHandler } from '../../automation/index.js';

export async function triggerForcecage(spell, metaCtx, playerStats, campaignName, mapName) {
    const isForcecage = (spell.name || '').toLowerCase() === 'forcecage';
    if (!isForcecage) return null;

    const slotLevel = metaCtx?.slotLevel || spell.level || 7;

    // #1365: the Forcecage disk rows DIVERGE by ruleset and the envelope must
    // select by the host's rules field (selector idiom per prayerOfHealingService.js:54
    // / empoweredSpellService.js:34 `playerStats.rules === '2024'`, optional-chained
    // so null playerStats stays a pure passthrough; rules-absent defaults to 5e per
    // rulesFactory.js:27 `playerSummary.rules || '5e'`).
    //   2024 public/data/2024/spells.json:5866-5868 'Concentration, up to 1 hour', true
    //   5e   public/data/spells.json:4352-4354       '1 hour', false (NON-concentrated)
    // Duration policy: both texts are >= 1 minute, so the cage te is combat-scoped
    // either way (cleared at initiative/rest seams by the handler lane) — never a
    // wall clock; only the breakable-concentration flag differs per RAW.
    const is2024Host = playerStats?.rules === '2024';
    const diskRow = is2024Host
        ? { duration: 'Concentration, up to 1 hour', concentration: true, ruleset: '2024' }
        : { duration: '1 hour', concentration: false, ruleset: '5e' };

    const action = {
        name: 'Forcecage',
        automation: {
            type: 'forcecage',
            saveDc: 'ability',
            saveAbility: 'CHA',
            ...diskRow,
            range: spell.range || '100 feet',
        },
        spell,
        spellSlotLevel: slotLevel,
        metaCtx: metaCtx,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[forcecage] Failed to execute handler:', e);
        return null;
    }
}
