# MA-1380 Rakshasa Spellcasting — checkpoint

## Row (disk verbatim, public/data/monsters.json rakshasa actions[3])
- name "Spellcasting", attack_bonus 0, save_dc 18, save_type "Charisma", save_effect "", range ""/reach ""/recharge ""
- description VERBATIM:
  `The rakshasa casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18):<br><strong>At Will:</strong> Detect Magic, Detect Thoughts, Disguise Self, Mage Hand, Minor Illusion<br><strong>1/Day Each:</strong> Fly, Invisibility, Major Image, Plane Shift`
- Manifest VERBATIM match: attackBonus 0 / saveDc 18 / Charisma (prose "(spell save DC 18)" byte-agrees).
- No 2024 twin file (public/data/2024/monsters.json absent).

## Step 1 static — AXIS DECIDING (extraction replica byte-exact vs Helpers:356/:395)
- Emphasis spans: ONLY ('strong','At Will:') + ('strong','1/Day Each:') — both end ':' → extractor skips.
- Decoy emphasis: NONE (pure MA-1327 zero-chip shape, NOT MA-0599 fake-chip).
- All 9 spell names (Detect Magic, Detect Thoughts, Disguise Self, Mage Hand, Minor Illusion, Fly, Invisibility, Major Image, Plane Shift): plain-text present, wrapped=False on ALL 9.
- extractSpellNamesFromSpellcasting => [] (count 0).
- extractSpellcastingSpellUses => {} — limit=1 captured from "1/Day Each:" header, binds NOTHING (unmarked names invisible, §144/§729).
- Renderer: SpellCastLinks names.length===0 → null; SpellOrSaveLinks Spellcasting XOR → row save_dc 18 NEVER renders (§532/§676/MA-1294); attack_bonus:0 → junk "+0" chip (§490) UNPRESSED.
- All 9 names present in spells.json → post-fix zero §158 fake-chip/console noise.
- twins: MA-1327 Planetar / MA-1339 Priest / MA-1342 Acolyte / MA-1375 Questing Knight (20-row zero-chip census incl rakshasa per MA-1375 bug file). Armed twins: MA-0611 djinni fix byte-shape, MA-0564 death-knight.

## Step 2/3 plan (Playwright localhost:5173, test-campaign ONLY)
- Server check → campaign header verify → EB join Rakshasa (verify cs name/AC17/HP221/monsterIndex rakshasa, §1339 clobber-watch). Rejoin needed after admin-clear (clear wipes cs).
- Join Bandit victim to observe picker/affordances (§240: zero-affordance row needs no victim, still join one).
- Open card via img.avatar-image[alt]; scope row strong.startsWith('Spellcasting').
- Chip census: .mc-dice-link-spell expected 0; junk +0 expected, UNPRESSED (§490/§650).
- Row-text press probe ×3 → expect zero log delta, zero popup, console 0.
- monsterSpellUses ABSENT probe (top-level + per-char).
- Uses probe moot (zero chips → 1/Day-EACH tracking dead by construction, cite §729).

## Status
- [x] step 1 static: FAIL(b)/DATA fingerprint confirmed (extraction 0 names / 0 uses binds)
- [ ] step 2 live rig
- [ ] step 3 chip census + press probe
- [ ] step 4 zero-delta + bug file + registry verifiedRow4 + admin-clear
