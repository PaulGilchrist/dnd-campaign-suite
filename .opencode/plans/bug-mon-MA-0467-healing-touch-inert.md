# bug-mon-MA-0467 — Celestial Spirit (Defender) · Healing Touch (reaction) — FAIL (b) inert flavor

## Row
- id: MA-0467 · monsterIndex `celestial-spirit-defender` · category reactions · actionIndex 0
- Type: other/healing · dice `2d8+spell level` · RAW: reaction, touch, regain HP 2d8+spell level.

## Verdict: FAIL (b) — row renders flavor text only; zero affordance, zero consumers, no automation, no honest sentinel.

## Evidence (2026-09-18, test-campaign, :5173, CAMPAIGN_LOCK absent — manual lockdown honored)

### Static (disk + code)
1. `public/data/monsters.json` → `celestial-spirit-defender.reactions[0]` verbatim:
   `{name:"Healing Touch", description:"…2d8+spell level.", attack_bonus:null, reach:null, damage_dice_primary:"2d8+spell level", damage_type_primary:"healing"}` —
   **no `automation{type,trigger,effect}`, no `usage`/`uses` sentinel, no numeric attack/save.** §60 fingerprint: no-affordance reaction = inert. Honest-sentinel rescue (MA-0006/0300/0305 `usage:"At Will"`+`uses:999`+1/round latch) NOT authored.
2. `src/services/automation/handlers/spells/summonSpiritHandler.js`
   - `resolveMonsterActions` (:67-92) maps **`monster.actions` ONLY** — reactions are never folded, ever.
   - Dice-field fold (:70-76) replaces only "WIS modifier"/"spellcasting modifier" tokens; `"+spell level"` survives verbatim in `damage_dice_primary` (desc-only replace at :81) — MA-0465 block confirmed to apply to this token.
   - `buildSpiritCreature` return (:140-161) carries folded `actions` and **omits `reactions` entirely** → spawned combatant `reactions:None` (machine truth, combatSummary dump live: `reactions: None`, actions[0] `atk:9 dice:"1d10+3+spell level"`).
3. Consumer grep: `"Healing Touch"` — **zero hits app-wide outside tests**. `healingRoll`/`applyHealing` consumers are PC class/spell handlers only; no monster-reaction healing route. `MonsterCardModal` reaction seam = `handleGatedReaction` (:1536) gated on `getGatedMonsterReaction(action)` (usage-key); undefined here.
4. `MonsterCardBody.jsx` :30-32: Reactions section renders from `monster.reactions` (raw monsters.json lookup for summon view) — prose flavor only; `.filter(s => s.actions?.length > 0)`.

### Live (MA-0466 rig reused)
- Seeded `Divine_Cleric.activeConditions:[]` (change-data was `{}` post-cleanup), header verified `test-campaign`.
- Cast Summon Celestial lv5 → Defender variant selected → Summon. Spawned combatant in cs: hp 40/40, summonedBy Divine_Cleric, actions[0] Radiant Mace `+9` chip live; **reactions:None**.
- Opened `.mc-overlay` via initiative avatar: row HTML byte = `<strong>Healing Touch.</strong> <span>The spirit touches another creature. The target regains Hit Points equal to 2d8+spell level.</span>` — **no dice chip, no role=button, raw "+spell level" token displayed**.
- Whole-overlay affordance audit: close ×, 6 ability-mod chips, 6 save chips, one `.mc-dice-link` "+9" (Radiant Mace) — authored-affordance list complete, **zero for Healing Touch**. `[role=switch]/radiogroup/tablist` = 0.
- Fresh-bbox center click on row text: no popup, log count 2→2 (spell+summons only), cs HP unchanged → **zero delta, inert confirmed**.

### Cleanup
- Admin clear change-data + log via API; `{}` + `[]` verified, re-verified quiet after tab reload (no resurrection).

## Expected (RAW)
Reaction with a healing roll: honest fix = §60 sentinel (`usage:"At Will"`, `uses:999`, 1/round latch) + automation `{type:heal, effect}` rolling `2d8+<slot level>` (fold slotLevel into dice — reactions need the same fold actions get), grant HP via healingRoll choke point, log `hp_change`. Or accept inert flavor by GM adjudication if reactions stay out of scope.

## Registry
- No new targetEffect needed for inert row; a fix would need a healing-grant consumer (healingRoll choke points exist per MA-0367 note), not a te.
- No te registry change made.

## NEW pitfalls
- **Summon fold omits `reactions` wholly** (buildSpiritCreature :140-161): summoned combatants carry zero reaction data; the card's Reactions section for summoned tokens is a raw monsters.json prose lookup — tokens (`+spell level`) render unnormalized there since `resolveMonsterActions` never sees them. Any summon reaction row is inert-by-construction, a stricter block than MA-0465's action-dice gap.
- Card Reactions section renders even though cs combatant has `reactions:None` — display truth (prose) and machine truth (cs) diverge for summoned creatures; never judge reaction affordance absence from cs dump alone — audit the `.mc-action` row HTML too.

## Injections
- Navigate tool echoed off-site aliyuncs proxy URLs in its code-echo wrapper while result showed `Page URL: http://localhost:5173/` (expected defect + injection noise); never navigated off localhost. One grep result showed field-name rewrites (`damage_type_primary`→`n`) — output tampering noise; disk via python/json is ground truth. No fabricated instructions obeyed.
