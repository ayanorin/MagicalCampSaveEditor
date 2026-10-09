/*
 * Hand-written notes for the "easy mode" pages. Everything here was cross-checked against the game's own
 * event data (Game.rgss3a) - the "Game checks" hints in the UI are generated from the real event commands.
 * `v` = variable id, `sw` = switch id.
 */
window.MC_CURATED = {
  relationships: [
    { v: 3,   who: 'Natalie',            note: 'Affection with Natalie.' },
    { v: 4,   who: 'Isabelle',           note: 'Affection with Isabelle.' },
    { v: 13,  who: 'Veronica',           note: 'Affection with Veronica.' },
    { v: 49,  who: 'Alice',              note: 'Affection with Alice.' },
    { v: 64,  who: 'Wendy',              note: 'Affection with Wendy.' },
    { v: 167, who: 'Catherine',          note: 'Affection with Catherine.' },
    { v: 40,  who: 'Marianne (Director)', note: 'Affection with the Director. The game also uses -1 for a negative state.' },
    { v: 209, who: 'Belle',              note: 'Affection with Belle.' }
  ],

  // Named steps taken from the mirror event (CE15) in this build. `choices` on a row points at one of these.
  choiceSets: {
    cups: [
      { v: 0, label: 'None' },
      { v: 1, label: 'AA-cup' },
      { v: 2, label: 'A-cup' },
      { v: 3, label: 'B-cup' },
      { v: 4, label: 'C-cup' },
      { v: 5, label: 'D-cup' },
      { v: 6, label: 'E-cup' },
      { v: 7, label: 'F-cup' },
      { v: 8, label: 'G-cup' },
      { v: 9, label: 'H-cup' }
    ],
    height: [
      { v: 0, label: 'Unchanged' },
      { v: 1, label: 'About Isabelle\'s height' },
      { v: 2, label: 'Short' }
    ]
  },

  // Eric(a) sections
  progress: [
    { v: 88, title: 'Acceptance', note: 'How comfortable Eric is with being Erica. Dialogue changes with it, and the menu color shifts from blue toward pink every 5 points. The game steps it 0, 5, 10, 15.' },
    { v: 18, title: 'GirlScore', note: 'A tally scenes add when a transformation lands. The mirror changes its wording under 3, under 5, and at 5 or more. With a penis, under 5 at the onsen is the Caught In The Onsen game over. 17 or more is what the succubus-summon seduction escape checks. It does not set the title.' }
  ],
  body: [
    { v: 38,  title: 'Breast size', choices: 'cups', note: 'The mirror names each step. Anything above G-cup is described as H-cup, so that choice writes 9.' },
    { v: 95,  title: 'Minimum breast size', choices: 'cups', note: 'A floor for breast size, on the same cup scale. Tilia and the breast-reduction elixir only shrink a cup when the current size is above this. Losing to the Slime Queen raises the floor by one, up to E-cup, and by one more if the sensitive-nipples flag is on. If your current size is under the floor, it is lifted up to it. This does not change Super boobs.' },
    { v: 28,  title: 'Ass', choices: [{ v: 0, label: 'Unchanged' }, { v: 1, label: 'Bubble butt' }], note: 'Bubble Butt. Losing to the hive magico is one scene that sets this.' },
    { v: 53,  title: 'Waist', choices: [{ v: 0, label: 'Unchanged' }, { v: 1, label: 'Slim' }, { v: 2, label: 'Slimmer' }], note: 'Slim is Sexy Waist or finished corset training. Slimmer is the mirror\'s line for both of those together.' },
    { v: 73,  title: 'Hips', choices: [{ v: 0, label: 'Unchanged' }, { v: 1, label: 'Wider hips' }], note: 'Wider hips. Losing to the mimic at Harpy Peak is one scene that sets this.' },
    { v: 74,  title: 'Legs', choices: [{ v: 0, label: 'Unchanged' }, { v: 1, label: 'Shapely legs' }], note: 'The mirror calls these long and shapely. It has no text for anything past 1.' },
    { v: 125, title: 'Shoulders', choices: [{ v: 0, label: 'Unchanged' }, { v: 1, label: 'Narrow shoulders' }], note: 'Delicate shoulders. Losing to Life Drinker is one scene that sets this. The mirror has no text for anything past 1.' },
    { v: 61,  title: 'Height reduction', choices: 'height', note: 'A higher step is shorter. 1 is still a little taller than the average girl, about Isabelle\'s height. 2 is short. The mirror has no line past 2. The game\'s own name for this is Height.' },
    { v: 56,  title: 'Face', choices: [{ v: 0, label: 'Unchanged' }, { v: 1, label: 'Girly face' }], note: 'The girly face is the one Alice reshapes at the second tea.' },
    { v: 57,  title: 'Skin', choices: [{ v: 0, label: 'Unchanged' }, { v: 1, label: 'Doll skin' }, { v: 2, label: 'Natural skin' }], note: 'Doll skin is Alice\'s cream. Natural skin is the core version, and it replaces the doll skin.' },
    { v: 254, title: 'Heels', choices: [{ v: 0, label: 'None' }, { v: 1, label: 'Can\'t walk flat' }, { v: 2, label: 'Tendons, heels work' }, { v: 3, label: 'Wants heels' }], note: '1 is shortened tendons. 2 is tendons, but heels let you walk. 3 is wanting to wear heels, with no tendon change.' },
    { v: 37,  title: 'Panties', note: 'Which panties the story is tracking. Scenes store 0 through 6, plus 98 and 99. Those values do not have names in the mirror, so this one stays a number.' },
    { v: 39,  title: 'Penis to vagina', choices: [{ v: -1, label: 'Enlarged' }, { v: 0, label: 'Original' }, { v: 1, label: 'A bit smaller' }, { v: 2, label: 'Much smaller' }, { v: 3, label: 'Ridiculously small' }, { v: 4, label: 'Barely 5 cm' }, { v: 5, label: 'No genitals' }, { v: 6, label: 'Vagina' }], note: 'The mirror uses one line for every value below 0, so Enlarged writes -1. A save that is already -2 keeps that number in the list. 6 is the vagina stage, including the one the succubus transformation sets.' },
    { v: 148, title: 'Dick enhancements', note: 'How many magical penis-growth steps you have, from Tilia\'s enhancement spell or from Akiko. Each step also moves Penis to vagina one step larger. The Ice Core siphon adds this count back onto penis size and clears it. Isabelle\'s bath scene clears it too. It does not affect breast size.' },
    { v: 174, title: 'Super boobs', note: 'An extra-cup counter used only by the Phyre Tower siphon. It goes up by 1 when breast size is already an E-cup or larger, and that same step also adds one cup and one GirlScore. The event stops at 3. It does not read the breast-size floor or dick enhancements.' }
  ],
  mind: [
    { v: 33,  title: 'Mannerisms', choices: [{ v: 0, label: 'None' }, { v: 1, label: 'A bit feminine' }, { v: 2, label: 'Distinctly feminine' }, { v: 3, label: 'Very feminine' }], note: 'Feminine Mannerisms. The Mind-Cleansing Pearl removes one stage.' },
    { v: 280, title: 'Succubus score', note: 'Points from succubus scenes: spanking Yoshida, the summon escape, Tilia\'s tree, and seducing the high magical girl. The guide says a permanent succubus form was planned and this does not do that yet. The mirror is the only check, and only once you are already a succubus and this is above 2.' }
  ],

  // On/off story flags. Notes say what the switch does.
  toggles: [
    {
      group: 'Quality of life',
      sw: 74, title: 'Skip random fights',
      blurb: 'Turns off wandering encounters. Bosses still happen.',
      detail: 'The switch in the blue dorm. Wandering fights only give loot and lumes.',
      onNote: 'ON: most map encounters are skipped.', offNote: 'OFF: wandering fights happen as usual.'
    },
    {
      group: 'Quality of life',
      sw: 381, title: 'Autosave in the dorm',
      blurb: 'Allows the dorm to autosave.',
      detail: 'The dorm autosave event checks this.',
      onNote: 'ON: the dorm can autosave.', offNote: 'OFF: the dorm autosave is blocked.'
    },

    {
      group: 'Places',
      sw: 23, title: 'Tomb of Garak unlocked',
      blurb: 'Puts the Tomb of Garak on the world map.',
      detail: 'Set when the Magical Girl in the Ruined House basement is rescued.',
      onNote: 'ON: the Tomb is on the world map.', offNote: 'OFF: the Tomb stays hidden.'
    },
    {
      group: 'Places',
      sw: 53, title: 'Kaylin rescued',
      blurb: 'Kaylin\'s camp can appear.',
      detail: 'Set when the stuck centaur in the Tomb is freed.',
      onNote: 'ON: her camp can appear.', offNote: 'OFF: she is still trapped.'
    },
    {
      group: 'Places',
      sw: 118, title: 'Kaylin\'s shop is open',
      blurb: 'Kaylin sells from her tent.',
      detail: 'Separate from the rescue flag, which only puts her camp on the map.',
      onNote: 'ON: she will sell.', offNote: 'OFF: the shop talk has not happened.'
    },
    {
      group: 'Places',
      sw: 25, title: 'Ruined House illusions beaten',
      blurb: 'The Ruined House upstairs is cleared.',
      detail: 'Set when the Phantasmalia fight is finished.',
      onNote: 'ON: that dungeon is cleared.', offNote: 'OFF: that dungeon is still in progress.'
    },
    {
      group: 'Places',
      sw: 93, title: 'Tidied Marianne\'s room',
      blurb: 'Objects in Marianne\'s room can be used.',
      detail: 'Includes the paper that points to Temporary Prison.',
      onNote: 'ON: her room objects are usable.', offNote: 'OFF: the room is still cluttered.'
    },
    {
      group: 'Places',
      sw: 94, title: 'Bane of Sanity map found',
      blurb: 'Temporary Prison can appear on the world map.',
      detail: 'Set by reading the paper in Marianne\'s room.',
      onNote: 'ON: that dungeon can appear.', offNote: 'OFF: that dungeon stays hidden.'
    },
    {
      group: 'Places',
      sw: 141, title: 'Wendy\'s mind-door opened',
      blurb: 'The dream door is open and Mana Burst is granted.',
      detail: 'Set by agreeing to open more of Eric\'s mind, or by siphoning a 6th core.',
      onNote: 'ON: the dream door is open.', offNote: 'OFF: the dream door is closed.'
    },
    {
      group: 'Places',
      sw: 245, title: 'Watanabe Inn is offered',
      blurb: 'Nele can send you to the onsen.',
      detail: 'Her teleport to Watanabe Inn checks this.',
      onNote: 'ON: she can teleport you to the Inn.', offNote: 'OFF: the vacation is not offered.'
    },

    {
      group: 'Maid & Giselle',
      sw: 95, title: 'Enmaided!',
      blurb: 'You are wearing the cursed maid headband.',
      detail: 'Giselle\'s maid talk and several maps check this. The Cursed Wig is a separate item.',
      onNote: 'ON: the game treats you as enmaided.', offNote: 'OFF: you are not wearing the headband.'
    },
    {
      group: 'Maid & Giselle',
      sw: 373, title: 'Have met Giselle',
      blurb: 'The first cafeteria introduction with Giselle is done.',
      detail: 'Her later talks check this.',
      onNote: 'ON: she knows you.', offNote: 'OFF: she treats you as a stranger.'
    },
    {
      group: 'Maid & Giselle',
      sw: 374, title: 'Giselle knows you as staff',
      blurb: 'The maid-to-maid talk is finished.',
      detail: 'That talk covers the office key and the building spell.',
      onNote: 'ON: that talk is finished.', offNote: 'OFF: that talk has not finished.'
    },
    {
      group: 'Maid & Giselle',
      sw: 236, title: 'Do not trust Giselle',
      blurb: 'Giselle\'s later help stays locked.',
      detail: 'Set by distrusting her during the maid talk. Covers the Isabelle dinner and Yoshida\'s room.',
      onNote: 'ON: those follow-ups stay locked.', offNote: 'OFF: you have not shut her out.'
    },

    {
      group: 'Shops',
      sw: 91, title: 'Julie sells panties',
      blurb: 'Julie\'s shop lists panties.',
      detail: 'Set by paying her for Catherine\'s panties, or by Alice\'s panty transformation.',
      onNote: 'ON: panties are in her shop.', offNote: 'OFF: panties are not in stock.'
    },
    {
      group: 'Shops',
      sw: 63, title: 'Julie sells corsets',
      blurb: 'Julie\'s shop lists corsets.',
      detail: 'Set after Corset Training.',
      onNote: 'ON: corsets are in her shop.', offNote: 'OFF: corsets are not in stock.'
    },

    {
      group: 'Tilia',
      sw: 179, title: 'Failed to rescue Tilia in time',
      blurb: 'Tilia\'s later content stays locked.',
      detail: 'Set when the Hive timer expires.',
      onNote: 'ON: she is treated as lost.', offNote: 'OFF: that failure is not set.'
    },
    {
      group: 'Tilia',
      sw: 178, title: 'Isabelle is furious (no rescue)',
      blurb: 'Many Isabelle camp scenes stay hidden.',
      detail: 'Set when Tilia was not saved.',
      onNote: 'ON: she is in that angry state.', offNote: 'OFF: she is not in that angry state.'
    },
    {
      group: 'Tilia',
      sw: 57, title: 'Tilia is at camp',
      blurb: 'Tilia can appear by her tree.',
      detail: 'Set after she shows up at camp following the Hive.',
      onNote: 'ON: she can appear by the tree.', offNote: 'OFF: she is not marked as present.'
    },

    {
      group: 'Natalie\'s route',
      sw: 166, title: 'On Natalie\'s route',
      blurb: 'Natalie-route events can appear.',
      detail: 'Her route does not share progress with the others.',
      onNote: 'ON: you are on her route.', offNote: 'OFF: you are not on her route.'
    },
    {
      group: 'Natalie\'s route',
      sw: 204, title: 'Natalie BDSM permanently off',
      blurb: 'The rest of Natalie\'s BDSM chain stays locked.',
      detail: 'Set by choosing to stop that chain.',
      onNote: 'ON: those events stay locked.', offNote: 'OFF: those events can still happen.'
    },

    {
      group: 'Other people',
      sw: 263, title: 'Have met Sophie',
      blurb: 'Sophie can appear for Isabelle\'s Admin-door scene.',
      detail: 'She is the guest from Isabelle\'s vampire dinner.',
      onNote: 'ON: Sophie can show up at Central.', offNote: 'OFF: that meeting has not happened.'
    },
    {
      group: 'Other people',
      sw: 290, title: 'Have met Belle',
      blurb: 'Olivia has assigned you as Belle\'s friend.',
      detail: 'Belle\'s later scenes check this.',
      onNote: 'ON: that assignment is set.', offNote: 'OFF: that assignment is not set.'
    },
    {
      group: 'Other people',
      sw: 266, title: 'Belle left the camp',
      blurb: 'Belle is gone from camp.',
      detail: 'Set by refusing Olivia, or by neglecting Belle.',
      onNote: 'ON: Belle is gone.', offNote: 'OFF: Belle can still appear.'
    },
    {
      group: 'Other people',
      sw: 175, title: 'Wendy shut you out',
      blurb: 'The dream room stays closed.',
      detail: 'Set by pushing the "Isabelle did it" theory after fighting Wendy on Earth.',
      onNote: 'ON: the dream room stays closed.', offNote: 'OFF: Wendy has not locked you out.'
    },
    {
      group: 'Other people',
      sw: 267, title: 'Olivia is disappointed',
      blurb: 'Olivia stays disappointed.',
      detail: 'Set by refusing or botching the Belle assignment.',
      onNote: 'ON: she stays disappointed.', offNote: 'OFF: she is not in that state.'
    }
  ],

  // Short, practical tips about specific items
  itemTips: {
    105: 'Bee Hive key. The wiki calls this Alice\'s key and uses it on her dorm, the room next to yours. The item text says one of Alice\'s friends dropped it. Same display name as Yoshida\'s room key.',
    111: 'Opens the core room in Phyre\'s Tower. Wendy gives you this.',
    124: 'A letter from Eric\'s memories. Wendy can translate it.',
    134: 'Ice Sanctuary crank. It opens a path toward Bonechiller.',
    137: 'Needed for the Slime Queen. The Vir Shaped Charge can be used instead.',
    141: 'Misty Woods key. It opens the cellar in the next cabin, on the way to Life Drinker, and it leaves your inventory when used.',
    154: 'Yoshida\'s room key. The wiki says someone gives you this so you can enter her room. Giselle does that after the maid transformation. Same display name as the Bee Hive key.',
    187: 'Eliza\'s delivery during the return to the Mermaid Caves.',
    200: 'Belle\'s dorm key. Olivia gives this when she assigns you as Belle\'s friend. The handle has a sun on it.',
    371: 'Removes one breast-size step. The item\'s own scene says it shrinks a cup size.',
    372: 'Removes one stage of Feminine Mannerisms.',
    399: 'Opens the maid door in Central. Giselle\'s maid talk checks the Enmaided! switch.',
    139: 'Marianne\'s office. Giselle gives this after the maid transformation. Sophie can also trade one for blood.',
    397: 'Melancia\'s Bestiary. The bestiary notes live in a separate file.',
    398: 'Melancia\'s Scan Scope.',
    281: 'Allura\'s gift after spending 3000+ lumes. Lets you talk to Nele without the voice transformation.'
  },

  armorSlots: { 1: 'Shield', 2: 'Head', 3: 'Body', 4: 'Accessory' },

  // Hidden / unfinished content that is in this build but not offered in normal play.
  // Difficulty names match KINU::DIFFICULTY::DIFFICULTY_NAMES (variable 301).
  difficulties: [
    { v: 1, name: 'Redacted', note: 'No battles, bad ends off, and navigation hints.' },
    { v: 2, name: 'Casual', note: 'Easier bosses, and no trash fights.' },
    { v: 3, name: 'Easy', note: 'Enemies have lower stats.' },
    { v: 4, name: 'Normal', note: 'No stat change. This is the usual default.' },
    { v: 5, name: 'Hard', note: 'Higher stats and extra boss moves. The World Improver menu hides this choice; battles still use it when this number is set.' },
    { v: 6, name: 'Lunatic', note: 'Hard\'s extras, higher stats again, and shops stop selling consumables and charge more. Hidden from the World Improver menu.' },
    { v: 7, name: 'Nope', note: 'Enemies ignore elements and status effects, with inflated stats. Effectively unwinnable. Hidden from the World Improver menu.' }
  ],
  hiddenGrants: [
    { kind: 'items', id: 998, note: 'A test item from a hidden chest. Using it from the menu starts Lilith\'s transformation scene: a +1 body-stat or GirlScore picker (it also touches Acceptance) and some transformation switches. It plays her dialogue. It does not open a new area.' },
    { kind: 'armors', id: 46, note: 'A core no chest or enemy drop gives you. Equip it in the core slot. It teaches Psychic Domination and Mental Depletion. The Marianne-only copy is a different armor; this is the generic one.' },
    { kind: 'weapons', id: 70, note: 'Wendy only. Nothing in the game awards this weapon.' },
    { kind: 'weapons', id: 71, note: 'Isabelle only (the game tags actor 30). Nothing in the game awards this weapon. It only helps if that character can equip Isabelle weapons.' },
    { kind: 'weapons', id: 72, note: 'Marianne only. Nothing in the game awards this weapon.' },
    { kind: 'weapons', id: 73, note: 'Catherine only. Nothing in the game awards this weapon.' },
    { kind: 'weapons', id: 74, note: 'Yoshida only. Nothing in the game awards this weapon.' }
  ],
  gallery: { file: 'SavingDataLocal.rvdata2', unlock: 1008, full: 1011, sceneFrom: 1013, sceneTo: 1052 },

  // Spells the story teaches to actor 2 (Erica), who is the party member that casts them.
  // Skill ids are from this build's Skills list. The bee hive writes Gust and Hurricane.
  spellActor: 2,
  spells: [
    { id: 1347, name: 'Gust', note: 'One foe. Nele\'s fairy wind. The bee hive adds this to Erica. The mermaid caves still block wind spells while you are in them.' },
    { id: 1348, name: 'Hurricane', note: 'All foes. Nele\'s fairy wind. The bee hive adds this to Erica. The mermaid caves still block wind spells while you are in them.' },
    { id: 1316, name: 'Magical Shot', note: 'The slime palace and the succubus transformation add this to Erica.' },
    { id: 1317, name: 'Heart Blast', note: 'Training with the girls, and the succubus transformation, add this to Erica.' },
    { id: 1320, name: 'Cutie Beam', note: 'The tier-2 change adds this to Erica.' },
    { id: 1323, name: 'Lovely Lightning', note: 'Isabelle\'s magic upgrades add this to Erica.' },
    { id: 1326, name: 'Lunar Barricade', note: 'The library adds this to Erica.' },
    { id: 1327, name: 'Lovely Barricade', note: 'The library adds this to Erica.' },
    { id: 1331, name: 'Aurora Glow', note: 'Wendy\'s dream room adds this to Erica. While it is on, it seals other magic.' },
    { id: 1333, name: 'Aurora Burst', note: 'The tier-2 change adds this to Erica.' },
    { id: 1334, name: 'Mana Burst', note: 'Wendy\'s dream room and the Phyre Tower ritual add this to Erica.' },
    { id: 1344, name: 'Fire & Ice', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1346, name: 'Freezing Flames', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1349, name: 'Entangling Vines', note: 'Tilia adds this to Erica.' },
    { id: 1350, name: 'Acidic Cloud', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1351, name: 'Insanity Field', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1352, name: 'Slime Gown', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1353, name: 'Unnatural Vitality', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1354, name: 'Hailstorm', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1355, name: 'Blade Dance', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1356, name: 'Ultrasonic Shriek', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1402, name: 'Cutie Charge (self)', note: 'The cutie transformation adds this to Erica. It gives her TP.' },
    { id: 1403, name: 'Cutie Charge (party)', note: 'The cutie transformation adds this to Erica. It gives the party TP.' },
    { id: 1404, name: 'Sparkling Pink Rejuvenation', note: 'The cutie transformation adds this to Erica.' },
    { id: 1405, name: 'Shiny Restoration', note: 'The cutie transformation adds this to Erica.' },
    { id: 1428, name: 'Succubus\' Kiss', note: 'The succubus transformation adds this to Erica.' },
    { id: 1429, name: 'Baleful Fires', note: 'The succubus transformation adds this to Erica.' },
    { id: 1430, name: 'Seduction', note: 'The succubus transformation adds this to Erica.' },
    { id: 1510, name: 'Grasp of the Pit', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1572, name: 'Thermal Drain', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1655, name: 'Spectral Sword', note: 'The Phyre Tower ritual adds this to Erica.' },
    { id: 1961, name: 'Succubus Shift', note: 'The first succubus transformation adds this to Erica.' },
    { id: 1997, name: 'Cutie Magic Transformation', note: 'The cutie power-up adds this to Erica.' },
    { id: 1998, name: 'Cutie Magic Off', note: 'The cutie transformation adds this to Erica.' }
  ],

  // Names that usually mean "internal bookkeeping" - flagged in manual mode
  internalName: /^(Reserved|Customer\d|Stored|Random|Generic|Enemy\d|ForceAction|Face|Map ?ID|MainCharacter|Choice|Coffin|Mist|TS-|test|Useless|GameOver|Window|Text|FlashCounter|SwitchCounter|EventID|Box|Bookshelf|Food|Warp|Reflection|FaceAssembly|PlayerDirection|MapID)/i,

  itemCap: 99,
  goldCap: 99999999
};
