# Bug MA-0104 — Adult Gold Dragon "Banish": success deals half damage (should be none), once-per-turn clause ungated, demiplane transport advisory-only

**Verdict: FAIL** (DC/type/fail-branch exact — but success over-applies half damage, same-turn refire ungated, transport clause inert)

## Row
- MA-0104 · Adult Gold Dragon (`adult-gold-dragon`) · `legendary_actions[1]` · category: legendary_actions · actionType: save · DC 21 Charisma · 3d6 Force on fail · Incapacitated + demiplane transport until start of dragon's next turn · "can't take this action again until the start of its next turn."

## Data check (PASS, no drift)
- `public/data/monsters.json` `adult-gold-dragon.legendary_actions[1]` (read 2026-09-14): `save_dc:21`, `save_type:"Charisma"`, `damage_dice_primary:"3d6"`, `damage_type_primary:"Force"`, save_effect text verbatim incl. "Incapacitated" + demiplane clause. Damage is authored ONLY under "Failure:" → success = zero damage by text. **No `dc_success` field authored** → engine defaults `'half'` (root cause 1). Legendary header `legendary_actions[0]` has no `uses` (MA-0103 fingerprint).

## Live probe (test-campaign, :5173, 2026-09-14)
Setup: EB Join → cs idx 0 `Adult Gold Dragon 1` (npc, init 18, hp 243); activeCreature=AasimarTest (valid legendary window); armed ElderPaladin on dragon card (server-verified `targetName:"ElderPaladin"`); revived EP to HP 100 via initiative-card input (runtime key `ElderPaladin.currentHitPoints:100`; cs.currentHp mirror stale at 1 — judge by hp_change/logs, playbook MV-10). Baseline log 2→9 entries.

### PASS subset
- **Save prompt**: "ElderPaladin must make a CHARISMA saving throw. DC 21" — DC and type enforced exactly. ✓
- **Failed save = full damage + Incapacitated**: natural SAVE FAILURE total 19 vs DC 21 (d20 3, +11 +5 aura). Log chain: `save_result` DC 21 Charisma success:false + `save-damage` 3d6 rolls [5,1,3] total 9 Force + `hp_change` **−9** (100→91, no resistance, unscaled full 3d6) + `condition` action:applied "Incapacitated" source Adult Gold Dragon 1 / Banish. Change-data `ElderPaladin.activeConditions:["incapacitated"]` + `activeConditionMeta.incapacitated{source:'Adult Gold Dragon 1', durationNote:"until the start of the dragon's next turn… (GM-enforced)"}`. ✓ (damage-bearing save escapes MV-14 condition gate; MV-27 holds.)
- **Logging**: save, save-damage, save_result, hp_change, condition all logged on fail. ✓

### FAIL branches
1. **Success deals half damage (should be NONE).** Refired same turn → SAVE SUCCESS total 27 vs DC 21 (d20 16, +11) → popup rolled `save-damage` 3d6 rolls [4,1,4]=9 halved to **−4** (`hp_change` 91→87). RAW/description: damage appears only under "Failure:"; success = zero. Save prompt advertises wrong rule verbatim: "Half damage on successful save" (block boilerplate, MV-19/20).
2. **Once-per-turn clause ungated.** Description: "The dragon can't take this action again until the start of its next turn." Same-turn 2nd and 3rd clicks of the same `DC 21 Charisma` link (no turn walk, activeCreature still AasimarTest) opened full fresh save prompts and FULL damage/save chains resolved. Entire campaign log post-probe: **zero** `*_refused` / legendary-spend / latch entries. No per-action latch exists (`grep banish src/` producers = PC-spray banishment handlers only), and the MA-0021 legendary economy never engages because header lacks `uses` (MA-0103 proven live on this same dragon).
3. **Demiplane/transport clause advisory-only.** Fail applies the Incapacitated condition but NO transport te/state: campaign `targetEffects` null, no `banishment`/demiplane te on target. Only artifact = `automation`/`condition_clauses_advisory` log "…reappears… (GM-enforced) — control/telepathy/repeat-save clauses". `banishment` te producers exist ONLY in PC spell handlers (`banishmentHandler.js`, `mazeHandler.js`, Prismatic Spray violet `saveResultHandlers.js:249`) — no monster-legendary producer.

## Root cause / Likely location
1. **dc_success default:** row has no `dc_success` → `resolveBlockSaveDcSuccess` (MonsterCardModal.jsx:103-105 `action.dc_success ?? 'half'`; pendingSavePrompts payload captured `dcSuccess:'half'`) → `applyDamage.js` halves on success. Fix shape = DATA `dc_success:"none"` (MA-0030 precedent, honored by the same seam).
2. **Once-per-turn gate:** rides MA-0021 legendary economy (`monsterLegendaryUses.js` header-gates on `legendary_actions[0].uses` — absent) → Banish renders via generic ungated `handleSaveRoll` fallback (MA-0103 root cause applies unchanged).
3. **Transport:** needs a demiplane te producer at the failed-save seam (PC `banishment` te + registry entry reuse possible; no monster-path producer today) — advisory residual per CLA-325 model otherwise.

## Steps to Reproduce
1. test-campaign → Encounters → tick Adult Gold Dragon → Join; arm target on dragon card.
2. Open dragon card → Banish `DC 21 Charisma` → Roll Save. Fail: full 3d6 Force + Incapacitated badge/log apply (correct). Success: popup still rolls 3d6 and applies half damage (observed −4 on 27-vs-21 success).
3. Click the same link again the same turn: fresh prompt, full resolution, no refusal anywhere.

## Notes
- `saveResult-ElderPaladin` machine keys clean: fail {success:false, roll:3, total:19} / success {success:true, roll:16, total:27}.
- Minor cosmetic: attack-side CHA `roll` log lines show odd `rolls:[3,1]`/`[1,7]` pairs with total 3/1 and `isSpellDamage:true` on a monster block-save prompt payload.
- Incapacitated persisted through the later success firing (correct — carried from the earlier fail, until dragon's next turn).
- Tooling: persistent non-matching routify/aliyuncs URL tokens in Playwright MCP response wrappers this session (MA-0103/MA-0005 echo-defect family); every issued URL was self-issued localhost and adjudicated state independently via curl to localhost:5173. One fabricated "### success" run-code echo was rejected via filesystem check (file absent, real call re-run).

## Cleanup
- Only `test-campaign` touched. Admin clear change-data + campaign log at end (POST localhost). No manifest `verified` edits.
