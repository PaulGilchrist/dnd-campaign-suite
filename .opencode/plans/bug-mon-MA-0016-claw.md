# Bug MA-0016 — Aberrant Spirit (Slaad) · Claw

## Verdict: FAIL — inert-token data (MV-12 fingerprint, monster-specific instance) + no-regain clause unimplemented

## Monster
- `aberrant-spirit-slaad` — "Aberrant Spirit (Slaad)" (2024 PHB, Summon Aberration form)
- Action: **Claw** — Melee Spell Attack, reach 5 ft., Slashing

## Issue 1: inert token dice / no to-hit
### Data (public/data/monsters.json)
- `attack_bonus`: **null** → no numeric to-hit authored
- `damage_dice_primary`: **"1d10+3+spell level"** → "+spell level" token unparseable → rollExpression null
- CR 0, proficiency_bonus null — no fallback bonus anywhere in entry.

### E2E evidence (localhost:5173, test-campaign)
1. Encounters → checked "Aberrant Spirit (Slaad)" → Join Encounter → initiative round 1, token "Aberrant Spirit (Slaad) 1" (HP 40/40, Init 16).
2. Armed PC target **AasimarTest** (HP baseline 143) via token Target dropdown; opened `.mc-overlay` via avatar click.
3. Claw row DOM: `<strong>Claw.</strong> <span class="mc-dice-link" role="button">🎲 1d10+3+spell level</span>` + prose "+spell attack modifier" — the chip is the **only** interactive element; **no to-hit link**.
4. Clicked Claw damage chip → **no popup, no toast, no campaign log entry** (log tail: join + initiative only), **HP unchanged 143→143**. Console: no new errors. **Silent no-op.**

## Issue 2: "can't regain Hit Points" clause — no consumer, no producer
- grep src (non-test) for `no_healing|block_heal|heal_block|no_regen|prevent_heal|cant_regain|can't regain`: **zero matches**.
- `targetEffectDefinitions.js`: no heal-block/no-regain effect key registered.
- No producer exists on the monster hit path: even if the attack resolved, the "target can't regain HP until start of spirit's next turn" clause would never be applied, tracked, or expired.

## Conclusion
Identical inert-token behavior as MV-12 / MA-0014 / MA-0015 (Summon Aberration family bug): authored data carries literal "+spell attack modifier"/"+spell level" tokens instead of numbers; chip renders clickable but resolves nothing. Additionally, the no-regain clause has zero implementation in the targetEffect registry.

## Fix suggestion
Templated spell-attack monsters need caster-derived bonus resolution (spell attack mod, spell level slot) at card build time, or sanitization of unparseable chips (render disabled, not a dead button). Register a heal-block targetEffect (e.g. `no_healing_until`) in targetEffectDefinitions.js with a producer on monster hit and an expiry consumer.
