# BUG MA-0882 — Gnoll Pack Lord / Incite Rampage (FAIL(b))

- **Row:** MA-0882 · monsterIndex `gnoll-pack-lord` · actionIndex 3 · category actions · actionType other · range "60 feet" · recharge "5-6"
- **Date:** 2026-09-22 · campaign test-campaign · dev :5173 · verdict **FAIL(b)** (unimplemented data-and-UI: inert affordance live + grep-zero consumers)

## Expected
RAW semantics: "The gnoll targets another creature it can see within 60 feet of itself that has the Rampage Bonus Action. The target can take a Reaction to make one melee attack." — a grant-reaction-on-rampage-target utility with Recharge 5-6:
1. Row must arm an affordance (chip) that, on press, selects/arms a visible target ≤60 ft holding a Rampage bonus action, grants it a usable Reaction (one melee attack), and engages the recharge economy (spend on use, refuse "Not Recharged" until d6 5-6 recovery).
2. Recharge 5-6 must be an enforced economy — §MA-0875 proves the recharge channel itself is LIVE on chip-bearing rows (spend, refusal popup, recovery d6 at owner turn-start, `-spent` chip class).

## Actual (live-confirmed 2026-09-22)
- Row renders text-only, byte-shape:
  `<div class="mc-action"><strong>Incite Rampage.</strong> <span>The gnoll targets…one melee attack.</span><em> (5-6)</em></div>`
- `interactiveInRow: 0` — zero `<a>/<button>/[role=button]/input/select`, zero `mc-dice-link*` in row.
- Whole-card `.mc-dice-link*` inventory = 9 links: `+4 (14)` initiative, six ability-mod chips (`+3 +2 +1 -1 +0 -1`), two `+5` attack chips (Bone Whip, Bone Javelin). Incite|Rampage matches across whole-card link inventory = **0**.
- Real-pointer click at row center (fresh rect): **zero delta** — no popup, no picker, no sp-modal, no log entry (log post-click = join-noise only: 3 entries, `inciteRampageEntries: []`), card stays open, console 0 errors.
- Recharge "5-6" renders as cosmetic `<em> (5-6)</em>` name-text with NO chip — exactly the §117 recharge-metadata-without-chip cosmetic family (MA-0544); economy never engages because nothing arms a press. Corroborates §MA-0879 same-session observation ("feeds MA-0882").
- Consumer layer grep (`grep -rin "incite\|rampage" src/ server/ --include=*.js --include=*.jsx`, non-test AND incl. tests): **zero matches app-wide**; `targetEffectDefinitions.js` carries ZERO rampage te. No Rampage condition, no reaction-grant machinery, no gate anywhere.

## Steps
1. test-campaign → Initiative → open "Gnoll Pack Lord 1" card (EB re-join post MA-0881 admin-clear; header verified test-campaign).
2. Dump Incite Rampage `.mc-action` innerHTML → text-only, 0 interactive elements; recharge as `<em> (5-6)</em>`.
3. Whole-overlay `[class*=mc-dice-link]` inventory → 9 links, none matching Incite|Rampage.
4. Real-pointer click row text → popup 0, log delta 0, card open, console 0.
5. Grep src/+server/ incite|rampage → 0 matches (incl. targetEffectDefinitions.js: 0).

## Likely Location
- **UI:** row is other-type with zero numeric mechanic fields (no attack_bonus/dice/save_dc/automation) — MonsterAction.jsx chip paths never arm (§60/§116/§117); renderer prints description + cosmetic `<em> (Recharge)</em>` only. Chip-arm needs authored `automation{type:...}` per §60.
- **Consumer layer:** grep-zero means there is NOTHING for a data patch to arm — unlike MA-0725 (§239, one-field DATA fix onto live hellishRebuke consumers) or MA-0565 Parry (§114). Fix requires a NEW automation.type + te + consumer stack reusing the sanctioned templates: `monster_summon` (§222, encounters/monsterSummon.js) / `monster_self_buff` (§224, encounters/monsterSelfBuff.js, effect MUST equal te registry key) → new e.g. `grant_reaction` automation.type + registered te (targetEffectDefinitions.js registry whitelist §36) + reaction-grant consumer + recharge spend/refusal via live monsterRechargeGate (§61/§MA-0875) + spend/refusal/resolution logs (§41).

## Notes
- MA-0879 (§260-tail, same rig same day) corroborated live: zero affordance, recharge cosmetic.
- §MA-0875 shows the recharge channel itself is live elsewhere (save rows) — defect here is affordance + consumer absence, not recharge machinery.
- Targeting prerequisite ("has the Rampage Bonus Action") is additionally unmodellable today: no per-creature bonus-action-ownership predicate consumers (MonsterCardModal target lists are name-based); §70-class residual even post-automation.
- Rig: Pack Lord 1 AC15 + Bandit 1 AC12 four-key 999 cs POST; zero-damage row so HP staging immaterial. Cleanup: admin-clear cd+log 200/200, quiet-recheck cd{} log0, single tab, dev :5173 up.
- Injection echoes: none encountered this session; self-verified location.origin localhost on every evaluate.
