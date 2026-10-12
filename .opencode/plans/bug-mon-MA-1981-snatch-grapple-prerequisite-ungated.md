# BUG MA-1981 — Scylla "Snatch" Grappled/Restrained prerequisite is prose-only and fully ungated

**Verdict: FAIL** — unenforced prerequisite gate (§1 policy). MA-1981 · Scylla (`scylla`) · `legendary_actions[2]` · attack · `+16` · `4d10 + 8` Piercing · reach 15 ft.

## Row (disk-truth, 2026-10-12)
- `public/data/monsters.json` Scylla `legendary_actions[2]` fields: name/description/attack_bonus/reach/damage_dice_primary/damage_type_primary ONLY — **no structured `target_prerequisite`**. Prerequisite exists solely in verbatim prose: `"One head lunges at a Grappled or Restrained creature. Melee Attack Roll: +16, reach 15 ft. Hit: 30 (4d10 + 8) Piercing damage."`

## Expected (RAW)
Snatch may target **only** a Grappled or Restrained creature. An armed target without either condition should be refused (or at minimum advised); a satisfied target should register prerequisite-met.

## Static evidence (file:lines — no extractor exists for the prose)
- `src/components/encounter/MonsterCardHelpers.js:979-980` — `parseTargetPrerequisite` reads **only** `action?.target_prerequisite`; no description-prose parse.
- `src/components/encounter/MonsterCardHelpers.js:999-1001` — `evaluateTargetPrerequisiteGate` returns `{prerequisite:null, satisfied:true}` for rows without the structured field (byte-inert passthrough).
- `src/components/encounter/MonsterCardModal.jsx:2336-2344` — MA-0687 attack-row gate is live in the attack lane but comment + code confirm "Rows without the structured field are byte-inert"; this row therefore skips straight to roll.
- `src/services/encounters/monsterLegendaryUses.js:26` — legendary-ally gate also structured-field-only.
- Grep `grappled or restrained` (case-insensitive) across `src/`: **0 matches** — no prose→gate extractor anywhere for this wording.
- Save/eye-ray lanes plumb a `prerequisite` param (`executeBlockSaveRoll` ~:421, `resolveEyeRayFire` ~:529) — attack lane consumes the same structured field via MA-0687, so the plumbing **exists and is live** (MA-0687/0689/1275/1847 twins); this row simply authors nothing for it to consume. §68 MA-0019 live-lane precedent applies directly.

## LIVE probe A — ungrappled target (Bandit 1, zero conditions, AC12, 999-rig)
test-campaign, dev :5173, header==test-campaign every step. Fresh EB join Scylla x1 + Bandit 1; popups-0 pre-click verified; armed via Scylla combobox (`selected:"Bandit 1"`, cs stamp confirmed); pressed Snatch chip (`strong` startsWith "Snatch." row, plain `.mc-dice-link "+16"` — NEW: legendary child with own attack renders a plain chip, no `.mc-dice-link-legendary` class, unlike the Bite delegate's "Expend Legendary").
**Result: FIRED UNGATED.** Immediate roll popup `Snatch … d20 10 +16 … ✓ HIT (26 vs AC 12) Done` — zero prerequisite popup/warning/advisory. Log: `ability_use` + attack `bonus:16 total(nat):10 hit:true targetAc:12 targetName:"Bandit 1"` + damage `formula:"4d10 + 8"` rolls [7,10,4,3] **fd:32** Piercing no-secondary + `hp_change Δ−32` 999→967 (fd==|hpΔ| ✓). Whole-log regex `prereq|prerequisite`: **0 hits**.

## LIVE probe B — grappled target (same row)
Grappled granted via Bandit card Add → EffectAdder `.ea-overlay` Conditions tab → Grappled chip → **Apply** (mandatory; overlay auto-closed); cd-verified `activeConditions:["grappled"]` (meta `{dc:10,ability:"str"}`, no source — manual GM grant). Card closed first (Add intercepted by `.mc-overlay` — closed → Add → reopened, §76). Same-turn re-press correctly refused by **turn-economy** gate (`legendary_use_refused (turn) — zero spend, no roll`) — economy live, prerequisite still absent. Advanced Next → fresh boundary (active AberrantSorcerer), reopened, re-armed Bandit 1, pressed again: **FIRED, behavior identical to probe A** — plain roll popup `d20 1 +16 … ✓ HIT (17 vs AC 12)`, **zero prerequisite-satisfied mention** anywhere in popup or log (bonus:16, `4d10 + 8` fd:35 Piercing, Δ−35 967→932, fd==|hpΔ| ✓). **Gate blind both directions: cannot block the illegal target, cannot notice the legal one.**

## Fix proposal
Author structured `target_prerequisite: {conditions:["grappled","restrained"]}` on `monsters.json` Scylla `legendary_actions[2]` (MA-0019 byte-shape; decide + document whether `by_attacker:true` is wanted — RAW implies by Scylla, per MA-1275/MA-1890 grapple twins). The MA-0687 attack-lane gate at `MonsterCardModal.jsx:2342` then enforces refuse-before-roll with popup + `snatch_refused` log at zero cost, per the live MA-0687/0689 precedent. Optionally add a prerequisite-satisfied advisory line on authorized presses for symmetric auditability (MA-0019 lane currently refuses loudly but accepts silently).

## Notes
- Numerics on both fires byte-exact vs disk: bonus 16, single-leg `4d10 + 8` Piercing, no secondaryFormula, crit 0, fd==|hpΔ| per victim (32/35), sumFd 67 == sum|hpΔ|.
- Attack-lane vs save-lane contrast: the row is a legendary **attack** child, so the save-lane `prerequisite` plumbing (:421/:529) is N/A; the applicable lane (MA-0687 attack gate) is live and gated solely on the structured field — this is a DATA-authoring gap on top of a §1 policy failure (prose gate = no gate).
- Legendary turn-economy gate verified working on this row (refused 2nd same-turn press, zero spend) — the miss is specifically the target-eligibility prerequisite.
- Chip census: `.mc-dice-link "+16"` plain (NEW one-liner: self-mechanic legendary children expose plain attack chips; `mc-dice-link-legendary` appears only on delegate/"Expend" children, cf MA-1980).

## Cleanup (verified)
Grappled removed via badge `[title="Remove effect"]` (single, Bandit card) → cd `activeConditions:[]` → `.mc-close` → Admin Clear Change Data + Clear Campaign Log (native confirms accepted) → cd `{}` / log `[]` GET pass 1 + two-pass quiet ≥15s. Manifest untouched; no git writes; only test-campaign touched.
