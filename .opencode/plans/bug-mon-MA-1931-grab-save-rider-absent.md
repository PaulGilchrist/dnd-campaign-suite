# BUG MA-1931 — King Kong Grab: Save-Rider Half Inert (FAIL(b)/DATA)

**Verdict:** FAIL(b)/DATA · **Row:** MA-1931 `king-kong|actions|2` "Grab" · **Date:** 2026-10-11 · **Campaign:** test-campaign

## Title
King Kong Grab renders only its +17 attack chip; the DC 25 Strength save rider (Grappled + Restrained, escape DC 25, Huge-or-smaller gate) is structurally inert — save_dc/save_type/save_effect/escape_dc/target_prerequisite all absent from authored data.

## Overview
Grab is a compound attack+save row per RAW: melee attack (+17, 3d10+10 Bludgeoning), and if the hit lands on a Huge-or-smaller creature, that creature makes a DC 25 Strength save or is Grappled (escape DC 25) AND Restrained until Kong's next turn. Live E2E proved the attack half resolves honestly, but across 2/2 hits the save half produced ZERO adjudication: no save chip affordance, no save roll, no conditions, no escape badge. Machine proof: `lastAttack.saveDc:null / saveType:null` after every Grab hit; whole-log grep-zero for save_result / rollSavingThrow / "DC 25" / Grappled / Restrained / escape_dc. Same-session control (Kong's own Thunder Roar DC 23 Wisdom chip, pressed once, zero resource cost — no structured `recharge` field authored) adjudicated live: victim `roll/save saveDc:23 saveType:"Wisdom" saveResult:"failure"` + Frightened condition granted — the save lane is ALIVE; the Grab row simply never arms it.

## Expected (row + disk quote)
Row description (disk `public/data/monsters.json` king-kong `actions[2]`, byte-exact):
> "Melee Attack Roll: +17, reach 10 ft. Hit: 26 (3d10 + 10) Bludgeoning damage. If the target is a Huge or smaller creature, it must succeed on a DC 25 Strength saving throw or have the Grappled condition (escape DC 25) and be Restrained until Kong's next turn."

Disk fields authored: ONLY `{name, description, reach:"10 ft.", attack_bonus:17, damage_dice_primary:"3d10 + 10", damage_type_primary:"Bludgeoning"}` — **NO save_dc / save_type / save_effect / escape_dc / target_prerequisite / dc_success**.

Expected app behavior: two chips per compound attack+save row (§120/§255): attack chip (always-full damage) + "DC 25 Strength" save chip (§260 DC0-gate `Number(save_dc)>0`) that on save-fail grants Grappled (escape DC 25 badge) + Restrained until Kong's next turn, gated to Huge-or-smaller victims.

## Actual
- **Chip census (live):** Grab row = exactly ONE `span.mc-dice-link` "+17". ZERO `.mc-dice-link-save-clickable` chips on the row. (Thunder Roar row on the same card renders "DC 23 Wisdom" — renderer capable; absence is missing-data, not a render bug.)
- **Attack ledger (passes):** Hit #1 nat18+17=35 vs AC12 → damage byte-formula "3d10 + 10" Bludgeoning rolls [5,8,10] finalDamage 33, hpΔ −33. Hit #2 nat4+17=21 vs AC12 → "3d10 + 10" rolls [2,6,4] finalDamage 22, hpΔ −22. Unclamped chain 999→966→943; |hpΔ|==fd each, secondary ABSENT (MA-188 cosmetic N/A). Same-turn, no Next clicked (round constancy 1, §151).
- **Zero-save machine proofs (rider inert):** after EACH hit GET `/lastAttack` → `saveDc:null, saveType:null, dcSuccess:null, saveResult:absent`. Whole-log scans across 2 hits: `save_result:false, rollSavingThrow:false, "DC 25":false, grappled(false, except combat-ui-viewingMonster.actions[2].description snapshot echo §371), restrained:false, escape_dc:false, condition-applied:0`. Victim Bandit 1 change-data `activeConditions:[]` post-hits (Medium = RAW-eligible victim; only 'frightened' present later from the CONTROL press).
- **Control (lane alive):** Thunder Roar DC chip press → `roll/save` saveDc:23 Wisdom saveResult:"failure" + `condition` Frightened granted + automation advisory; lastAttack.saveDc:23. Zero spend (no recharge gate authored, §196/MA-1916). Save-chip popup copy printed cosmetic "DC Unknown" (§336/§128 fingerprint) while lastAttack/log carried real DC 23.

## Steps to Reproduce
1. :5173 → test-campaign → EB exact "King Kong" ×1 Join; EB exact td "Bandit" ×1 Join.
2. Full-store cs POST Bandit currentHp+maxHp=999; char-store POST Bandit activeConditions:[]. Arm Bandit 1 via Kong's own initiative-card `[data-testid="target-select"]` (selectOption; cs.targetName server-verified).
3. Open Kong card (avatar img alt "King Kong 1"); scope Grab row via `.mc-action strong.textContent.trim().startsWith('Grab')` (§315 — Multiattack header prose names "Grab"; two other "+17" twins on card: regular Slam, legendary Rock Throw).
4. Census chips: one "+17", zero DC chips. Press +17 ×2 (HIT → `button.dice-roll-reroll-btn` Done). Observe damage lands; grep log + `/lastAttack` + Bandit change-data → zero save adjudication every hit.
5. Control: press Thunder Roar "DC 23 Wisdom" chip → inline NPC save adjudicates with real DC — proves save lane live.

## Likely Location
`public/data/monsters.json` → king-kong → actions[2] — **DATA lane**. Renderers/consumers live and correct (§260 DC0-gate arms save chips only on numeric save_dc; §346 save lane word-scans save_effect only, description NEVER; §209/MA-0019 target_prerequisite + hit-clause escape badge seams live; MA-0586 saveEffect rows consumed live — requires authored save_dc).

## Fix (byte-shape, cite precedents)
Add to actions[2]:
- `save_dc: 25`, `save_type: "Strength"` — arms the "DC 25 Strength" chip (§260 DC0-gate; MA-0586 proof save-lane consumption live once save_dc authored).
- `dc_success: "none"` — RAW success = nothing happens; half-default leaks fake half-damage copy (MV-20/§335/MA-0481 family).
- `save_effect: "On a failed save the target has the Grappled condition (escape DC 25) and is Restrained until Kong's next turn."` — save lane word-scans ONLY save_effect for canonical condition words Grappled/Restrained (§346/§537; NEVER hit_conditions here — §537: hit_conditions grants on attack-HIT, wrong axis when RAW gates grapple behind a save).
- `escape_dc: 25` — MA-0010 badge lane byte-shape (accept §537 residual: save-lane grapple grants carry meta without dc → escape badge rides attack-lane seam only; author anyway).
- `target_prerequisite` Huge-or-smaller gate via §209/MA-0019 structured shape (`evaluateTargetPrerequisiteGate` live; prose gate otherwise unenforced — MA-0687/MA-0689 codification: prose target-prerequisite lacking structured key = DATA defect, not §70 advisory).
- Per §537 disarm rule, keep recurring/ongoing flavor prose in `description` only — save_effect above carries no dice+"damage" pool so the DC chip stays clickable (MA-1867 fingerprint).

## Notes
- Multiattack "can replace one remaining attack with a Grab" tie stays MA-1929 GM-discretion (zero-parser replace clause, MA-1912) — not this row's axis.
- Attack half PASSES (+17 / "3d10 + 10" Bludgeoning certified 2/2); verdict remains FAIL(b)/DATA per §388 trichotomy: structured keys absent at authored-accessible lane (consumers exist; zero affordance+zero state across ≥2 hits = inert rider, never PASS).
- Scoping discipline re-confirmed: three "+17" chips share the card (Slam/Grab/Rock Throw); all presses row-scoped strong-startsWith('Grab'); ledger names "Grab" only, zero ability_use from legendary rows.
- Thunder Roar control press granted Frightened on Bandit (expected RAW fail face; admin-cleared at session end). Recharge name-text "(Recharge 5-6)" ungated as predicted (MA-1916/MA-0663 fingerprint) — separate row MA-1932's axis.
- Same-suite save-lane-alive precedents: MA-1916/MA-1920 (Godzilla queue family) + this session's Thunder Roar control.

## Cleanup
Admin POST clear-change-data + clear-log (curl, no dialog); Kong card closed first (§15 tab-resurrection). Quiet 15s → GET verify change-data `{}` + log `[]`.
