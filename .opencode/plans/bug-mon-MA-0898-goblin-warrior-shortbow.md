# BUG — MA-0898 Goblin Warrior Shortbow: advantage-rider `1d4` rides EVERY hit (FAIL(a))

**Verdict: FAIL(a)** — exact twin of MA-0890 (Goblin Boss Shortbow, FAIL(a)) and MA-0897 (Goblin Warrior Scimitar, FAIL(a) same rig), twin of MA-0889 family. Row: Shortbow — "Ranged Attack Roll: +4, range 80/320 ft. Hit: 5 (1d6 + 2) Piercing damage, plus 2 (1d4) Piercing damage **if the attack roll had Advantage**." RAW: rider ONLY on advantage attacks. Live: `mode:"normal"` single-d20 hit rolls rider unconditionally. Over-damage avg +2.5 per plain hit. Gating verified NOT live.

## Static (disk, byte-match)
- monsters.json goblin-warrior actions[1] == manifest MA-0898 (stableKey goblin-warrior|actions|1) BYTE-MATCH: attack_bonus 4, range "80/320 ft.", damage_dice_primary "1d6 + 2" Piercing, damage_dice_secondary "1d4" Piercing. NO conditional_damage/advantage field — rider lives only in prose + `damage_dice_secondary` (same authoring shape as goblin-boss actions[2] Shortbow / goblin-warrior actions[0] Scimitar).
- Gate grep re-verified byte-current today: `grep -c forcedMode src/hooks/combat/handlers/handlePlainDamage.js` → **0**; :118 gate = `context.autoDamageSecondaryFormula` presence ONLY; :162 `advantage:false` = Death-Strike save prompt, irrelevant. `buildSecondaryDamageTransport` (MonsterCardModal.jsx:831-845) presence-gated unconditional stamp (§MA-0889/0897).

## Press ledger (test-campaign, 2026-09-23, dev :5173, Bandit 1 AC12 four-key HP 999 adopted, armed own-card target-select value="Bandit 1")
| # | mode | d20 (log raw) | total vs AC12 | fd ("1d6 + 2") | sfd ("1d4") | hpΔ |
|---|------|---------------|---------------|----------------|-------------|-----|
| 1 | normal | 14 (rolls[14,19], +4) | 18 ✓ real-pointer Done | 5 (rolls[3]) Piercing | **3** Piercing | −8 999→991 |

- One press, ≤4 budget. Gate-skip proof (one-hit twin evidence suffices §MA-0897): damage entry `formula:"1d6 + 2" fd:5 note:"combined_damage_roll" isCrit:false` + `secondaryFormula:"1d4" secondaryFinalDamage:3 secondaryDamageType:"Piercing"` at `mode:"normal"` — single d20 adjudicated (total=raw nat §MA-0881, second slot display-twin §92), advantage NEVER granted, rider rolls anyway.
- §140: fd+sfd = 5+3 = 8 == |hp_change| exact; breakdown Piercing 5 + Piercing 3.
- Band inert note §MA-0867: range "80/320 ft." dual-mode band never consulted — attack entry rangeReason:null (gridless-lenient fingerprint §MA-0672), no band split (rangeValidation.js:34). Separate documented gap, not this bug.
- Chip landed FIRST click (absorbed-first-click session-flaky §MA-0867 — popup audited before any re-click); Done via real pointer on `button.dice-roll-reroll-btn` (§MA-0869 DOM-Done-abandons-damage avoided); stage-2 `.popup-overlay` flushed via el.click() AFTER log confirmed damage (§140/§137).
- `cs.lastAttack` null post-attack — §MA-0890 pitfall re-confirmed; log canonical.

## Root cause (cited twins MA-0889/MA-0890/MA-0897, grep re-run today)
- Zero advantage-gate consumer app-wide; `rollAndApplySecondaryPlainDamage` (src/hooks/combat/handlers/handlePlainDamage.js:117-133) fires on formula presence only, never reads resolved attack mode. MA-0007 conditional_damage consumer is charge-offer only, cannot express "if the attack roll had Advantage". Zero-delta advantage-direction proof cited from MA-0889 te `next_attack_advantage` rig.

## Fix = MA-0889/MA-0897 same metadata-split pass
Split advantage-gated riders from legitimate additive always-roll secondaries (`advantage_damage_secondary`-style field or `conditional_damage` + mode:advantage semantics) + gate transport/consumer on resolved attack mode. One pass covers goblin-boss + goblin-warrior (Scimitar+Shortbow) — blanket gate invalid (MA-0426/0531 additive riders).

## Notes
- EB pitfall (§MA-0897 re-confirmed): "Goblin Warrior" filter yields Hobgoblin Warrior collision — exact td-text anchor + native cb.click(); selection survives filter replacement to Bandit strip; Join auto-navigates.
- Injection watch §90: click-tool echo carried off-site aliyuncs proxy goto wrapper ×1 this session — rejected; `location.href` self-verified localhost:5173 at every step.
- Clean: admin-clear cd+log 200/200 direct-fetch no-dialog; quiet-recheck cd0 log0 cs:null; single tab; dev :5173 up.
