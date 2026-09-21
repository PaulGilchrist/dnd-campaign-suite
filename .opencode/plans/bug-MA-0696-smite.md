# Bug MA-0696 — Empyrean Smite (legendary_actions[2]): Expend chip silently BURNS uses, zero Divine Ray adjudication

**Verdict: VERIFIED: FAIL(b)/DATA** — one-field fix `delegates_to:"Divine Ray"` (2026-09-20)

## Disk truth (`public/data/monsters.json`, Empyrean)
- legendary_actions[2] = `{name:"Smite", description:"The empyrean makes one Divine Ray attack.", uses:1}` — NO `delegates_to`, NO numeric attack_bonus/save_dc, NO advisory, prose carries no dice.
- Delegate target EXISTS: actions[2] `Divine Ray {attack_bonus:15, damage_dice_primary:"6d8 + 8"}` — `resolveDelegates` spans actions[] (monsterLegendaryUses.js:3-9), so the one-field fix is live-runnable.
- Header context (today's ledgers): rows[0] Bolster{uses:1} swallowed-as-header (MA-0694); rows[1] Shockwave own DC 23 chip (MA-0695 PASS). Smite is rows[2] → renders own row + own "Expend Legendary" chip (.mc-dice-link-legendary), riding ONE shared swallowed-header counter (max=1, §98/MA-0511 child-uses collapse).

## Live fingerprint (test-campaign, :5173, Empyrean 1 cs idx0 + Bandit 1 AC12 staged 999)
1. active=None click → refusal popup + log `legendary_use_refused (own-turn)` — zero spend. Gate alive.
2. Initiative walk → active=AasimarTest (other creature's turn). Chip click FIRED:
   - `ability_use` "Empyrean 1 expends a legendary use for Smite after AasimarTest's turn — 0 of 1 left (regain at start of Empyrean 1's turn; 4 in lair advisory)"
   - change-data `Empyrean 1.monsterLegendaryUses {max:1, used:1}` — use BURNED 1→0-left honest counter
   - latch `_legendaryUses_usedRound {round:1, activeCreature:"AasimarTest"}` (§98: burn latch stamps active, not attacker)
   - **console.error `[MonsterCardModal] legendary action "Smite" delegates_to "undefined" — no resolvable mechanic on "Empyrean 1"`** (live at MonsterCardModal.jsx:661 today) = §99/MA-0510 SILENT BURN
   - ZERO `roll attack`, ZERO `roll damage`, ZERO `hp_change`, ZERO Divine Ray mentions in log; Bandit 1 held 999/999; NO popup at all — adjudication display is harder-zero (chip click consumed in silence).
   - Shared-counter side-effect (§98): burn also exhausted Bolster+Shockwave sibling pool.
3. Re-click → refusal popup "no legendary uses left — regain at the start of Empyrean 1's turn" + log `legendary_use_refused (exhausted)`; counter held {max:1,used:1}; zero-spend.

## Classification
FAIL(b)/DATA per §10 + MA-0510/MA-0581 precedent: economy spine (gate/spend/refusal/regain) live, row mechanic dead — spend never resolves the named Divine Ray attack. NOT code: `delegates_to` consumer exists (monsterLegendaryUses.js:7 + resolveLegendaryRowMechanic/MonsterCardModal.jsx:486-500 — MA-0022 Lash→Tentacle template).

## Fix (DATA, one field)
legendary_actions[2] Smite += `"delegates_to": "Divine Ray"`.
- Canonical-total honesty note (§199): disk authors no header row and no canonical legendary total; floor = children count (3 rows each uses:1 collapse to one max=1 counter today). Full canonical fix would prepend header "Legendary Action Uses: N" (N needs printed source) + drop per-child uses per §165 — but MA-0696's minimum viable fix is the single `delegates_to` field, which converts silent-burn into adjudicated Divine Ray (+15 / 6d8+8) on the existing shared-gate seam.

## Cleanup verified
Admin clear-change-data + clear-log POST 200/200; GET log `[]`, change-data keys `[]`, combatSummary null after 14s debounce quiet (§15). Header test-campaign throughout; no off-target touch.
