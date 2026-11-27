# Project War: decisions for upcoming work

## Classes (back burner until the user says so): mage, flame blade, musketeer, troglodyte (later)
- Unlocked at **level 10**; players are classless before that.
- **Hard locks** on weapons and armor per class (a mage can't wear plate, a musketeer needs a musket).
- Can change class later **for a lot of gold**.
- Active skills: a **shared pool**, and each class has **one signature skill**.
- **Mage**: aimed ranged spells (mouse aims, projectiles travel); spells cost **cooldowns only** (no mana).
- **Musketeer**: charged shots (hold to charge, release to fire). The musket is also a **melee weapon**: **3 melee hits load one shot**.
- **Flame blade**: on the first death of a run they don't die: they stand back up with a **flaming blade for 30 s** doing bonus damage. Can also be **activated by hand on a 5-minute cooldown**.
- **Troglodyte** (later): feral (fast, clawing, climbing) **and** cave dweller (clubs, rocks, tough skin).
- **Enemies get classes too**, as new enemy types (enemy mages, musketeers...).

## Active skills on E (next to build), bought at the Trainer
First set: **Charge** (rush forward, knock enemies down), **Second wind** (restore stamina and some HP), **Whirlwind** (spin attack all around), **Grapple hook** (spear-on-a-rope pull, in the spirit of a classic fighting-game "get over here").

## Burning village (after skills)
- New map with **spearmen, shield-wall troops and berserkers**.
- **Fire spreads over the waves, shrinking the field, and never resets**: it keeps closing in, pushing the party to vote to leave.

## Book of Swords / profiles (later)
Players will set: a title/epithet, company banner and logo, a short bio line, pinned achievements.

## Wanted features (decided 2026-11-27, not built yet)
- **Sieges**: the endgame mode, up to 5 players attacking a fort (ladders, ram, archers on the walls, a gate to break).
- **Living camp**: hirelings idle and spar at the fire, and offline players appear as ghosts in camp.
- **Rare named weapons** as drops (no crafting).
- **Weather and time of day**, random per run (rain slows, night shrinks vision, fog hides archers).
- **Spectators**: people in the voice channel who aren't playing watch live and cheer, giving the party small buffs.
- **Bosses** with phases and arenas, as rare encounters (a warlord who calls reinforcements, a giant you climb).
- **Dynamic music** that swells with wave intensity and style rank.
- **Companies**: cosmetic only for now (name, banner).
- **Destructible battlefields**: cosmetic breakage only (fences, carts, braziers).
- **AI director**: watches how the party is doing and shapes the next waves both ways (mercy when struggling, ambushes when cruising).

## Not now / later
Persistent world map (later), daily faction war (later), mounted combat (not now), PvP (not now), replays and clips (not now), loot crafting (no).

## Kept as is
- Death penalty: lose the run's gold; gear, levels and skills stay.

## Rule
Every new pose or motion ships with its Animator setup (see CLAUDE.md).

## Overnight build (2026-11-27): choices made without asking
- Active skills: Charge 250 G (8 s), Second wind 200 G (30 s, +25% HP, full stamina), Whirlwind 300 G (10 s, two hits around you), Grapple hook 350 G (9 s, pulls one enemy in, stuns 1 s). Learned at the Trainer; buying one fills an empty E/R slot; swap in Tab.
- Skills cannot start mid-swing, while grabbing, in the air, slamming, carrying or stunned.
- Living camp: the first two hirelings spar near the Hire board, the next two sit by the fire, at most four shown. Up to three other players from the Book of Swords (most recently seen) wander the right side as pale ghosts with "(away)"; refreshed at most every 5 minutes.
- Battlefield: the knight has a fixed greathelm look, the general a crested helm and gilded armor. On line maps hirelings hold a rank just ahead of the nearest player until an enemy is within 130 px.
- Difficulty check (crude bot that can't parry, leather armor): level 1 solo dies on wave 3; level 6 with 2 hirelings dies on waves 5-7; level 10 with 3 hirelings reaches waves 8-10. Left as is (hard, as asked).
- Backdrops: Training Fields is now a dead moor under a black sun with a far city of spires, gallows and skulls on pikes. Battlefield is a storm with a castle burning on the hill and the enemy host on the ridge. All original pixel art.
