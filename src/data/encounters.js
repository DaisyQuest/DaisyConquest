/* Encounters — random events on the world map.
   Each has a prompt, 2-3 choices, weighted outcomes. choice.outcome.roll
   is a list of weighted deltas; the encounter screen rolls one and applies
   the resulting { gold, heroHp, heroXp, troops, items, log } delta to the
   active player. */

export const ENCOUNTERS = [
  {
    id: "ruined_chapel",
    title: "A Ruined Chapel",
    icon: "⛪",
    prompt: "Crows wheel above broken stone. A chest sits half-buried in the rubble. The air feels watched.",
    choices: [
      { label: "Pry it open",    outcome: { roll:[
          { weight:60, delta:{ gold: 80, log:"Coin spills out — 80 gold." } },
          { weight:30, delta:{ items:["potionHeal"], log:"You find a draught." } },
          { weight:10, delta:{ heroHp:-15, log:"A trap! −15 HP." } },
      ]}},
      { label: "Pray instead",   outcome: { roll:[
          { weight:50, delta:{ heroXp: 30, log:"You feel emboldened. +30 XP." } },
          { weight:50, delta:{ log:"Silence answers." } },
      ]}},
      { label: "Move on",        outcome: { roll:[ { weight:100, delta:{ log:"You leave it untouched." } } ]}},
    ],
  },
  {
    id: "wandering_smith",
    title: "A Wandering Smith",
    icon: "🔨",
    prompt: "A grimy traveler offers to refit your gear — for a price.",
    choices: [
      { label: "Pay 60 gold",    outcome: { roll:[ { weight:100, delta:{ gold:-60, items:["longsword"], log:"He hands you a longsword." } } ]}},
      { label: "Haggle",         outcome: { roll:[
          { weight:60, delta:{ gold:-30, items:["longsword"], log:"He grumbles, but agrees. −30g, +Longsword." } },
          { weight:40, delta:{ log:"He spits and walks off." } },
      ]}},
      { label: "Decline",        outcome: { roll:[ { weight:100, delta:{ log:"You let him pass." } } ]}},
    ],
  },
  {
    id: "burning_village",
    title: "A Burning Village",
    icon: "🔥",
    prompt: "Smoke columns blacken the sky. Cries carry on the wind. Bandits, almost certainly.",
    choices: [
      { label: "Charge in",      outcome: { roll:[
          { weight:70, delta:{ heroHp:-10, gold:50, heroXp:40, log:"You scatter the bandits. +50g, +40 XP." } },
          { weight:30, delta:{ heroHp:-30, log:"The fight goes badly. −30 HP." } },
      ]}},
      { label: "Send a scout",   outcome: { roll:[ { weight:100, delta:{ gold:20, log:"Your scout returns with what could be saved." } } ]}},
      { label: "Ride past",      outcome: { roll:[ { weight:100, delta:{ log:"The smoke fades behind you." } } ]}},
    ],
  },
  {
    id: "old_witch",
    title: "An Old Witch",
    icon: "🔮",
    prompt: "She sits in a hut on chicken legs. \"A trade,\" she rasps, \"a memory for a gift.\"",
    choices: [
      { label: "Accept the trade", outcome: { roll:[
          { weight:50, delta:{ items:["amulet"], heroXp:-20, log:"She presses an amulet to your palm. You forget your mother's face." } },
          { weight:50, delta:{ items:["potionMana","potionHeal"], log:"Two flasks. Warm." } },
      ]}},
      { label: "Refuse",           outcome: { roll:[ { weight:100, delta:{ log:"She cackles and shuts the door." } } ]}},
    ],
  },
  {
    id: "deserters",
    title: "Deserters",
    icon: "⚔️",
    prompt: "Five battered soldiers, fled from another lord. They'd join you, if you'd have them.",
    choices: [
      { label: "Recruit them (40g)", outcome: { roll:[ { weight:100, delta:{ gold:-40, troops:[{ unit:"manAtArms", count:2 }], log:"+2 Men-at-Arms." } } ]}},
      { label: "Hang them",          outcome: { roll:[ { weight:100, delta:{ heroXp:10, log:"A grim message sent." } } ]}},
      { label: "Wave them off",      outcome: { roll:[ { weight:100, delta:{ log:"They trudge into the trees." } } ]}},
    ],
  },
  {
    id: "merchant_caravan",
    title: "Merchant Caravan",
    icon: "🛒",
    prompt: "Wagons creak past, stacked with goods. The driver eyes your retinue warily.",
    choices: [
      { label: "Offer escort (free)", outcome: { roll:[ { weight:100, delta:{ gold:50, log:"They pay you 50g for safe passage." } } ]}},
      { label: "Tax them",            outcome: { roll:[
          { weight:70, delta:{ gold:120, log:"+120g." } },
          { weight:30, delta:{ heroHp:-20, gold:60, log:"They resist. +60g, −20 HP." } },
      ]}},
      { label: "Ignore",              outcome: { roll:[ { weight:100, delta:{ log:"You let them pass." } } ]}},
    ],
  },
  {
    id: "wolf_pack",
    title: "A Wolf Pack",
    icon: "🐺",
    prompt: "Yellow eyes ring the firelight.",
    choices: [
      { label: "Fight",  outcome: { roll:[
          { weight:80, delta:{ heroHp:-10, heroXp:25, log:"You drive them off." } },
          { weight:20, delta:{ heroHp:-35, log:"A bad night." } },
      ]}},
      { label: "Tame the alpha", outcome: { roll:[
          { weight:30, delta:{ items:["direwolf"], log:"It bows its head." } },
          { weight:70, delta:{ heroHp:-20, log:"It does not." } },
      ]}},
    ],
  },
];
