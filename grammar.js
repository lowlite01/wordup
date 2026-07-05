// Grammar guide data: tenses and basic rules with formulas and examples.
// Each item: { title, formula, use: [bullets], signals: [words]?, examples: [[sentence, note]] }

const GRAMMAR = [
  {
    section: "Tenses",
    items: [
      {
        title: "Present Simple",
        formula: "I/you/we/they + verb · he/she/it + verb-s",
        use: [
          "Habits and routines",
          "Facts and general truths",
          "Timetables and schedules"
        ],
        signals: ["always", "usually", "often", "every day", "never"],
        examples: [
          ["She works in a bank.", "fact"],
          ["I play football every Sunday.", "habit"],
          ["The train leaves at 9:00.", "schedule"]
        ]
      },
      {
        title: "Present Continuous",
        formula: "am / is / are + verb-ing",
        use: [
          "Actions happening right now",
          "Temporary situations",
          "Fixed plans in the near future"
        ],
        signals: ["now", "at the moment", "currently", "today", "this week"],
        examples: [
          ["She is reading a book right now.", "happening now"],
          ["I'm staying with my aunt this month.", "temporary"],
          ["We are meeting Tom tomorrow.", "fixed plan"]
        ]
      },
      {
        title: "Present Perfect",
        formula: "have / has + past participle (V3)",
        use: [
          "Life experience (no exact time)",
          "A past action with a result now",
          "Actions that started in the past and continue"
        ],
        signals: ["ever", "never", "just", "already", "yet", "since", "for"],
        examples: [
          ["I have visited Japan twice.", "experience"],
          ["She has lost her keys, so she can't get in.", "result now"],
          ["We have lived here since 2015.", "still true"]
        ]
      },
      {
        title: "Present Perfect Continuous",
        formula: "have / has been + verb-ing",
        use: [
          "An activity that started in the past and is still going",
          "Emphasising how long something has lasted"
        ],
        signals: ["for", "since", "all day", "lately", "recently"],
        examples: [
          ["I have been learning English for three years.", "duration"],
          ["It has been raining all morning.", "still raining"]
        ]
      },
      {
        title: "Past Simple",
        formula: "verb-ed (regular) or 2nd form (irregular) · question/negative with did",
        use: [
          "Finished actions at a known time in the past",
          "A sequence of past events"
        ],
        signals: ["yesterday", "last week", "ago", "in 2010", "when"],
        examples: [
          ["We watched a film yesterday.", "finished action"],
          ["She got up, had breakfast and left.", "sequence"],
          ["Did you see him last night?", "question with did"]
        ]
      },
      {
        title: "Past Continuous",
        formula: "was / were + verb-ing",
        use: [
          "An action in progress at a past moment",
          "A long action interrupted by a short one",
          "Setting the scene in stories"
        ],
        signals: ["while", "when", "at 8 pm yesterday", "all evening"],
        examples: [
          ["At 8 pm I was doing my homework.", "in progress"],
          ["I was cooking when the phone rang.", "interrupted"],
          ["The sun was shining and birds were singing.", "scene"]
        ]
      },
      {
        title: "Past Perfect",
        formula: "had + past participle (V3)",
        use: [
          "The earlier of two past actions ('the past of the past')"
        ],
        signals: ["before", "after", "by the time", "already", "when"],
        examples: [
          ["The film had started before we arrived.", "earlier action"],
          ["She had never flown before that trip.", "experience up to a past moment"]
        ]
      },
      {
        title: "Future Simple (will)",
        formula: "will + base verb",
        use: [
          "Predictions and opinions about the future",
          "Spontaneous decisions made now",
          "Promises and offers"
        ],
        signals: ["tomorrow", "next year", "soon", "I think", "probably"],
        examples: [
          ["It will rain tomorrow.", "prediction"],
          ["I'm tired — I'll go to bed.", "spontaneous decision"],
          ["I will always help you.", "promise"]
        ]
      },
      {
        title: "Going to (future plans)",
        formula: "am / is / are + going to + base verb",
        use: [
          "Plans and intentions decided before speaking",
          "Predictions based on what you can see"
        ],
        signals: ["tonight", "next week", "look!"],
        examples: [
          ["We are going to buy a new car.", "plan"],
          ["Look at those clouds — it's going to rain.", "evidence"]
        ]
      }
    ]
  },
  {
    section: "Basic rules",
    items: [
      {
        title: "Articles: a / an / the",
        formula: "a + consonant sound · an + vowel sound · the = specific thing",
        use: [
          "Use a/an for something mentioned the first time or one of many",
          "Use the when both people know which one is meant",
          "No article with most plural or uncountable general statements"
        ],
        examples: [
          ["I saw a dog. The dog was black.", "first mention → then specific"],
          ["She is an engineer.", "an + vowel sound"],
          ["I love music.", "no article — general"]
        ]
      },
      {
        title: "Plural nouns",
        formula: "+s · +es after s/sh/ch/x · -y → -ies · irregular forms",
        use: [
          "Most nouns just add -s",
          "Add -es after hissing sounds (bus → buses)",
          "Consonant + y changes to -ies (city → cities)",
          "Learn irregulars by heart"
        ],
        examples: [
          ["one box → two boxes", "-es"],
          ["one baby → two babies", "-ies"],
          ["man → men, child → children, foot → feet", "irregular"]
        ]
      },
      {
        title: "Comparatives & superlatives",
        formula: "short adj: -er / the -est · long adj: more / the most",
        use: [
          "One-syllable adjectives take -er/-est (tall → taller → the tallest)",
          "Longer adjectives use more/most (more interesting)",
          "good/bad/far are irregular"
        ],
        examples: [
          ["This street is quieter than mine.", "comparative"],
          ["It's the most expensive hotel in town.", "superlative"],
          ["good → better → the best · bad → worse → the worst", "irregular"]
        ]
      },
      {
        title: "Countable & uncountable",
        formula: "many / a few + countable · much / a little + uncountable · some / any + both",
        use: [
          "Countable nouns have a plural (apple → apples)",
          "Uncountable nouns have no plural (water, advice, information)",
          "Use some in positives, any in questions and negatives"
        ],
        examples: [
          ["How many apples do we need?", "countable"],
          ["There isn't much time.", "uncountable"],
          ["Is there any milk? — Yes, there's some in the fridge.", "any/some"]
        ]
      },
      {
        title: "First conditional (real future)",
        formula: "If + present simple, will + base verb",
        use: [
          "A real or likely situation in the future and its result"
        ],
        examples: [
          ["If it rains, we will stay at home.", ""],
          ["You'll pass the exam if you study.", "order of clauses can swap"]
        ]
      },
      {
        title: "Second conditional (unreal present)",
        formula: "If + past simple, would + base verb",
        use: [
          "Imaginary or unlikely situations now or in the future"
        ],
        examples: [
          ["If I had a million dollars, I would travel the world.", "imaginary"],
          ["If I were you, I would apologise.", "advice — 'were' for all persons"]
        ]
      },
      {
        title: "Word order & adverbs of frequency",
        formula: "Subject + Verb + Object · frequency adverb before the main verb",
        use: [
          "English keeps a fixed Subject–Verb–Object order",
          "always/usually/often/never go before the main verb, after 'be'"
        ],
        examples: [
          ["She speaks three languages.", "S + V + O"],
          ["I usually get up at seven.", "before main verb"],
          ["He is never late.", "after 'be'"]
        ]
      },
      {
        title: "Modal verbs basics",
        formula: "can / must / should + base verb (no 'to')",
        use: [
          "can = ability or permission",
          "must = strong obligation",
          "should = advice"
        ],
        examples: [
          ["She can swim very well.", "ability"],
          ["You must wear a seatbelt.", "obligation"],
          ["You should see a doctor.", "advice"]
        ]
      }
    ]
  }
];
