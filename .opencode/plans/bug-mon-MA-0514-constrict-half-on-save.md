# MA-0514 — Constrictor Snake Constrict: half-damage leak on save success (+ escape_dc unauthored)

**Verdict: FAIL** (test-campaign, 2026-09-19, :5173 dev, EB join "Constrictor Snake 1" + "Bandit 1", Bandit staged 999 HP via /combatSummary full-store POST, armed via snake initiative-card target-select → Bandit 1).

## Row
Constrict — STR save DC 12, one Medium-or-smaller creature seen within 5 ft. Failure: 7 (3d4) Bludgeoning + Grappled (escape DC 12). Disk `public/data/monsters.json` actions[1]: save_dc 12 ✓, save_type Strength ✓, damage_dice_primary "3d4" ✓, damage_type_primary Bludgeoning ✓, range "5 feet" ✓ — **dc_success ABSENT, escape_dc ABSENT, statusEffects ABSENT** (save_effect prose carries "Grappled").

## Defect leg A (decisive): dc_success default-half leaks damage on a SUCCESS save
- `MonsterCardModal.jsx:150` — `action.save_dc != null ? (action.dc_success ?? 'half') : null`; row authors no `dc_success` → picker/inline seam defaults **half**.
- RAW: Constrict success = **no damage, no grapple** (prose states only "Failure:"; no success clause) → requires `dc_success:"none"`.
- Live proof: nat 20-less success roll d20 **18** +0 (Bandit STR raw +0, cs saves.str 0, MA-0303 seam) vs DC 12 → ✓ SAVE SUCCESS, popup "6 damage applied to Bandit 1 — HP: 981 → 975"; log `save-damage` rolls [4,4,4]=12, finalDamage **6** Bludgeoning, saveResult success. Half-leak confirmed — MA-0481/0505/MV-20 twin.
- **Fix = DATA:** author `dc_success:"none"` on constrictor-snake actions[1] (honest copy both surfaces: popup + success log must show zero damage on success).

## Defect leg B (sub / advisory-adjacent): escape DC 12 not machine-represented
- No `escape_dc` authored; failed-save grapple stamp meta is `activeConditionMeta.grappled = {source:"Constrictor Snake 1"}` — **no dc field** (attack-path escape_dc stamper handlePlainDamage.js:504 never runs on save rows; §59/§70 grapple state-machine advisory-unbuilt app-wide).
- Prose "(escape DC 12)" therefore inert-unrepresentable; DATA `escape_dc:12` + consumer ticket owed (same residual family as MA-0490 advisory half).

## PASS-subset (verified live, do NOT regress)
- **FAIL legs ×3 (nat 4, 11, 3 +0 vs DC 12):** full 3d4 exact — dice totals 7/5/6 == `save-damage.finalDamage` == |hpΔ| chain 999→992→987→981, Bludgeoning, Bandit resistances clean, boundary honest (11+0<12 fail, 18+0≥12 success).
- **Grapple fingerprint REFUTED for this row:** grapple LANDS on EB-NPC victim — 3 `condition applied` logs `{characterName:"Bandit 1", condition:"Grappled", sourceName:"Constrictor Snake 1", sourceAbility:"Constrict"}` + change-data `Bandit 1.activeConditions:["grappled"]`; saveConditions extracted from save_effect (MonsterCardModal.jsx:399/683) is consumed on the NPC-inline seam here (MA-0368 precedent re-confirmed; NOT MA-0442/0443/0490 zero-producer class).
- Success produced **no new condition entry** (grapple persisting in ac = stale from prior fails, §96).
- Chips: "DC 12 Strength" `.mc-dice-link-save-clickable` fired on first click (no absorbed-click this session); single-target save auto-resolved inline "click to dismiss", no .sp-modal.

## Repro
EB join exact-td "Constrictor Snake" then "Bandit" → stage Bandit cs 999 → arm Bandit on snake's own initiative-card `[data-testid="target-select"]` → open card, click `.mc-overlay .mc-dice-link-save-clickable` until fail+success → success still pays half of dice pool.
