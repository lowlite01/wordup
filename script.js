const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const TOPICS = Object.keys(WORD_GROUPS).filter(g => !LEVELS.includes(g));

// Group keys: CEFR levels use their name ("B1"); topic levels use
// "Topic" for level 1 and "Topic@2" for level 2 (kept backwards-compatible
// with saved progress, where plain topic names were already used).
function keyParts(key) {
  const [name, lvl] = key.split("@");
  return { name, level: lvl ? parseInt(lvl, 10) : 1 };
}
function keyLabel(key) {
  const { name, level } = keyParts(key);
  if (LEVELS.includes(name)) return name;
  return level > 1 ? `${name} · Level ${level}` : `${name} · Level 1`;
}
function wordsForKey(key) {
  const { name, level } = keyParts(key);
  if (level === 1) return WORD_GROUPS[name];
  return TOPIC_LEVEL2[name] || [];
}
function topicLevelKeys(name) {
  const keys = [name];
  if (TOPIC_LEVEL2[name]) keys.push(name + "@2");
  return keys;
}
function allKeys() {
  const keys = [...LEVELS];
  TOPICS.forEach(t => keys.push(...topicLevelKeys(t)));
  return keys;
}
function isKeyComplete(key) {
  return knownSet(key).size >= wordsForKey(key).length;
}

// ---- Part-of-speech filter (CEFR levels only) ----
// Words keep a single progress record per level; the pos chips just filter
// which words flashcards/quiz/list show.
const POS_CATS = [["verb", "Verbs"], ["noun", "Nouns"], ["adj", "Adjectives"], ["adverb", "Adverbs"]];
let currentPosFilter = "all";
function matchesPos(w, cat) {
  return cat === "all" || w.pos.split("/").map(s => s.trim()).includes(cat);
}
function filteredLevelWords(key) {
  const words = wordsForKey(key);
  if (!LEVELS.includes(key)) return words;
  return words.filter(w => matchesPos(w, currentPosFilter));
}
function isKeyUnlocked(key) {
  const { name, level } = keyParts(key);
  if (level === 1) return true;
  // a level unlocks when the previous level of the same topic is complete
  const prevKey = level === 2 ? name : `${name}@${level - 1}`;
  return isKeyComplete(prevKey);
}

const STORAGE_KEY = "wordup-progress-v2";
const OLD_STORAGE_KEY = "wordup-progress-v1";

// progress = { known: { key: [words] }, learning: { key: [words] } }
function loadProgress() {
  try {
    const v2 = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (v2 && v2.known) return v2;
    const v1 = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
    if (v1) return { known: v1, learning: {} };
  } catch (e) { /* fall through */ }
  return { known: {}, learning: {} };
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
let progress = loadProgress();

function knownSet(key) {
  return new Set(progress.known[key] || []);
}
function learningSet(key) {
  return new Set(progress.learning[key] || []);
}
function setWordState(key, word, state) {
  // state: "known" | "learning" | "none"
  const known = knownSet(key);
  const learning = learningSet(key);
  known.delete(word);
  learning.delete(word);
  if (state === "known") known.add(word);
  if (state === "learning") learning.add(word);
  progress.known[key] = Array.from(known);
  progress.learning[key] = Array.from(learning);
  saveProgress();
  updateBadges();
}
function resetKeyProgress(key) {
  delete progress.known[key];
  delete progress.learning[key];
  saveProgress();
  updateBadges();
}

function collectWords(setFn) {
  // -> [{...word, key}] for every word in the given per-key set
  const out = [];
  allKeys().forEach(key => {
    const set = setFn(key);
    wordsForKey(key).forEach(w => {
      if (set.has(w.word)) out.push({ ...w, key });
    });
  });
  return out;
}
const allLearningWords = () => collectWords(learningSet);
const allKnownWords = () => collectWords(knownSet);

// ---- Pronunciation & transcription ----
// IPA + real audio come from the Free Dictionary API and are cached in
// localStorage; browser TTS covers words the API doesn't know.
const DICT_CACHE_KEY = "wordup-dict-v1";
let dictCache = {};
try { dictCache = JSON.parse(localStorage.getItem(DICT_CACHE_KEY)) || {}; } catch (e) { /* ignore */ }
const dictMisses = new Set(); // failed lookups — retry only next session

function dictEntry(word) {
  return dictCache[word.toLowerCase()] || null;
}
async function fetchDict(word) {
  const w = word.toLowerCase();
  if (dictCache[w]) return dictCache[w];
  if (dictMisses.has(w)) return null;
  try {
    const res = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w));
    if (!res.ok) throw new Error("lookup failed");
    const data = await res.json();
    let ipa = "", audio = "";
    data.forEach(entry => {
      if (!ipa && entry.phonetic) ipa = entry.phonetic;
      (entry.phonetics || []).forEach(p => {
        if (!ipa && p.text) ipa = p.text;
        if (!audio && p.audio) audio = p.audio;
      });
    });
    dictCache[w] = { ipa, audio };
    localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(dictCache));
    return dictCache[w];
  } catch (e) {
    dictMisses.add(w);
    return null;
  }
}
function speakWord(word) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  u.rate = 0.9;
  speechSynthesis.speak(u);
}
async function pronounceWord(word) {
  const d = await fetchDict(word);
  if (d && d.audio) {
    try { await new Audio(d.audio).play(); return; } catch (e) { /* fall back to TTS */ }
  }
  speakWord(word);
}
function youglishUrl(word) {
  return "https://youglish.com/pronounce/" + encodeURIComponent(word) + "/english";
}

// ---- Recently studied groups ----
const RECENT_KEY = "wordup-recent-v1";
function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; }
}
function recordRecent(key) {
  const list = loadRecent().filter(r => r.key !== key);
  list.unshift({ key, ts: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
}
function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
function renderRecent() {
  const list = loadRecent().filter(r => (wordsForKey(r.key) || []).length);
  document.getElementById("recent-section").classList.toggle("hidden", list.length === 0);
  const box = document.getElementById("recent-list");
  box.innerHTML = "";
  list.forEach(r => {
    const chip = document.createElement("button");
    chip.className = "recent-chip";
    chip.innerHTML = `${keyLabel(r.key)} <span>${timeAgo(r.ts)}</span>`;
    chip.addEventListener("click", () => openGroup(keyParts(r.key).name, r.key));
    box.appendChild(chip);
  });
}

// ---- Quiz mistake statistics ----
const STATS_KEY = "wordup-quiz-stats-v1";
let quizStats = {};
try { quizStats = JSON.parse(localStorage.getItem(STATS_KEY)) || {}; } catch (e) { /* ignore */ }
function recordQuizResult(word, pickedWord) {
  const s = quizStats[word] || (quizStats[word] = { right: 0, wrong: 0, confused: {} });
  if (pickedWord === word) {
    s.right++;
  } else {
    s.wrong++;
    s.confused[pickedWord] = (s.confused[pickedWord] || 0) + 1;
  }
  localStorage.setItem(STATS_KEY, JSON.stringify(quizStats));
}

// ---- Themes ----
const THEME_KEY = "wordup-theme";
const THEMES = ["plum", "ocean", "forest", "mono", "light"];
function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = "plum";
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll(".theme-dot").forEach(d =>
    d.classList.toggle("active", d.dataset.theme === theme));
}
document.querySelectorAll(".theme-dot").forEach(d =>
  d.addEventListener("click", () => applyTheme(d.dataset.theme)));

// ---- Screen management ----
const screens = {
  groups: document.getElementById("screen-groups"),
  mode: document.getElementById("screen-mode"),
  flashcards: document.getElementById("screen-flashcards"),
  quiz: document.getElementById("screen-quiz"),
  result: document.getElementById("screen-result"),
  list: document.getElementById("screen-list"),
  learning: document.getElementById("screen-learning"),
  known: document.getElementById("screen-known"),
  grammar: document.getElementById("screen-grammar"),
  stats: document.getElementById("screen-stats"),
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  const tabScreens = ["learning", "known", "grammar", "stats"];
  document.getElementById("tab-groups").classList.toggle("active", !tabScreens.includes(name));
  document.getElementById("tab-learning").classList.toggle("active", name === "learning");
  document.getElementById("tab-known").classList.toggle("active", name === "known");
  document.getElementById("tab-grammar").classList.toggle("active", name === "grammar");
  document.getElementById("tab-stats").classList.toggle("active", name === "stats");
}

let currentTopic = null; // topic or CEFR-level name shown on the mode screen
let currentKey = null;   // active group key incl. topic level, e.g. "City@2"

// ---- Tabs ----
document.getElementById("tab-groups").addEventListener("click", showGroupsScreen);
document.getElementById("tab-learning").addEventListener("click", showLearningScreen);
document.getElementById("tab-known").addEventListener("click", showKnownScreen);
document.getElementById("tab-grammar").addEventListener("click", showGrammarScreen);
document.getElementById("tab-stats").addEventListener("click", showStatsScreen);

// ---- Grammar guide ----
let grammarRendered = false;
function showGrammarScreen() {
  if (!grammarRendered) {
    renderGrammar();
    grammarRendered = true;
  }
  showScreen("grammar");
}
function renderGrammar() {
  const box = document.getElementById("grammar-content");
  box.innerHTML = "";
  GRAMMAR.forEach(section => {
    const h = document.createElement("h3");
    h.className = "gram-section";
    h.textContent = section.section;
    box.appendChild(h);
    section.items.forEach(item => {
      const card = document.createElement("div");
      card.className = "gram-card";
      const signals = item.signals
        ? `<p class="gram-signals">Signal words: ${item.signals.map(s => `<span>${s}</span>`).join(" ")}</p>`
        : "";
      card.innerHTML = `
        <button class="gram-head">
          <span class="gram-title">${item.title}</span>
          <span class="gram-chev">▾</span>
        </button>
        <div class="gram-body">
          <p class="gram-formula">${item.formula}</p>
          <ul class="gram-use">${item.use.map(u => `<li>${u}</li>`).join("")}</ul>
          ${signals}
          <div class="gram-examples">
            ${item.examples.map(([en, note]) => `
              <p class="gram-example">“${en}”${note ? ` <span class="gram-note">— ${note}</span>` : ""}</p>
            `).join("")}
          </div>
        </div>
      `;
      card.querySelector(".gram-head").addEventListener("click", () => {
        card.classList.toggle("open");
      });
      box.appendChild(card);
    });
  });
}

function updateBadges() {
  const learning = allLearningWords().length;
  const lb = document.getElementById("learning-badge");
  lb.textContent = learning;
  lb.classList.toggle("hidden", learning === 0);
  const known = allKnownWords().length;
  const kb = document.getElementById("known-badge");
  kb.textContent = known;
  kb.classList.toggle("hidden", known === 0);
}

// ---- Group cards ----
function renderGroupGrid(container, names) {
  container.innerHTML = "";
  names.forEach(name => {
    const keys = LEVELS.includes(name) ? [name] : topicLevelKeys(name);
    const total = keys.reduce((n, k) => n + wordsForKey(k).length, 0);
    const known = keys.reduce((n, k) => n + knownSet(k).size, 0);
    const levelsDone = keys.filter(isKeyComplete).length;
    const card = document.createElement("div");
    card.className = "group-card";
    card.innerHTML = `
      <span class="g-name">${name}</span>
      <span class="g-count">${total} words${keys.length > 1 ? ` · ${keys.length} levels` : ""}</span>
      ${known ? `<span class="g-mastered">${known} known${keys.length > 1 && levelsDone ? ` · ${levelsDone}/${keys.length} levels done` : ""}</span>` : ""}
    `;
    card.addEventListener("click", () => openGroup(name));
    container.appendChild(card);
  });
}

function showGroupsScreen() {
  renderGroupGrid(document.getElementById("grid-levels"), LEVELS);
  renderGroupGrid(document.getElementById("grid-topics"), TOPICS);
  renderRecent();
  showScreen("groups");
}

// ---- Shared word row (used by search, learning tab and word list) ----
function wordRow(w, opts = {}) {
  let tag = "";
  if (opts.showStatus) {
    if (knownSet(w.key).has(w.word)) tag = '<span class="g-mastered">✓ known</span>';
    else if (learningSet(w.key).has(w.word)) tag = '<span class="w-learning-tag">still learning</span>';
  }
  const cached = dictEntry(w.word);
  const row = document.createElement("div");
  row.className = "word-row";
  row.innerHTML = `
    <div class="w-top">
      <span class="w-word">${w.word}</span>
      <span class="w-ipa">${cached && cached.ipa ? cached.ipa : ""}</span>
      <span class="w-pos">${w.pos}</span>
      ${tag}
      ${opts.showGroup ? `<span class="w-group-tag w-group-link" title="Open this group">${keyLabel(w.key)}</span>` : ""}
    </div>
    <div class="w-def">${w.def}</div>
    <div class="w-example">${w.example}</div>
    <div class="w-actions">
      <button class="icon-btn small" title="Play pronunciation">🔊</button>
      <a class="icon-btn small" href="${youglishUrl(w.word)}" target="_blank" rel="noopener"
         title="Real examples from YouTube videos (YouGlish)">▶ YouTube</a>
    </div>
  `;
  row.querySelector(".w-actions button").addEventListener("click", async () => {
    await pronounceWord(w.word);
    const d = dictEntry(w.word);
    if (d && d.ipa) row.querySelector(".w-ipa").textContent = d.ipa;
  });
  if (opts.showGroup) {
    row.querySelector(".w-group-link").addEventListener("click", () =>
      openGroup(keyParts(w.key).name, w.key));
  }
  return row;
}

// ---- Search across all groups ----
let searchIndex = null;
function buildSearchIndex() {
  if (!searchIndex) {
    searchIndex = [];
    allKeys().forEach(key =>
      wordsForKey(key).forEach(w => searchIndex.push({ ...w, key })));
  }
  return searchIndex;
}
const searchInput = document.getElementById("search-input");
searchInput.addEventListener("input", () =>
  renderSearch(searchInput.value.trim().toLowerCase()));

function renderSearch(q) {
  const box = document.getElementById("search-results");
  const searching = q.length > 0;
  document.getElementById("screen-groups").classList.toggle("searching", searching);
  box.classList.toggle("hidden", !searching);
  box.innerHTML = "";
  if (!searching) return;

  const matches = buildSearchIndex().filter(w =>
    w.word.toLowerCase().includes(q) || w.def.toLowerCase().includes(q));
  matches.sort((a, b) => {
    const aw = a.word.toLowerCase().startsWith(q);
    const bw = b.word.toLowerCase().startsWith(q);
    if (aw !== bw) return aw ? -1 : 1;
    return a.word.localeCompare(b.word);
  });

  if (matches.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = `No words found for “${q}”.`;
    box.appendChild(p);
    return;
  }
  matches.slice(0, 40).forEach(w =>
    box.appendChild(wordRow(w, { showGroup: true, showStatus: true })));
  if (matches.length > 40) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = `…and ${matches.length - 40} more — keep typing to narrow the search.`;
    box.appendChild(p);
  }
}

function openGroup(name, preferredKey) {
  currentTopic = name;
  const keys = LEVELS.includes(name) ? [name] : topicLevelKeys(name);
  // default to the first incomplete unlocked level
  currentKey = preferredKey ||
    keys.find(k => isKeyUnlocked(k) && !isKeyComplete(k)) ||
    keys[keys.length - 1];
  if (!preferredKey) currentPosFilter = "all"; // keep the filter when returning from a mode
  document.getElementById("mode-group-title").textContent = name;
  if (LEVELS.includes(name)) renderPosChips();
  else renderLevelChips(keys);
  updateModeCount();
  showScreen("mode");
}

function renderPosChips() {
  const box = document.getElementById("level-chips");
  const words = wordsForKey(currentKey);
  const cats = [["all", "All"], ...POS_CATS.filter(([c]) => words.some(w => matchesPos(w, c)))];
  box.classList.remove("hidden");
  box.innerHTML = "";
  cats.forEach(([cat, label]) => {
    const n = words.filter(w => matchesPos(w, cat)).length;
    const chip = document.createElement("button");
    chip.className = "level-chip" + (currentPosFilter === cat ? " active" : "");
    chip.textContent = `${label} (${n})`;
    chip.addEventListener("click", () => {
      currentPosFilter = cat;
      renderPosChips();
      updateModeCount();
    });
    box.appendChild(chip);
  });
}

function renderLevelChips(keys) {
  const box = document.getElementById("level-chips");
  box.classList.toggle("hidden", keys.length <= 1);
  box.innerHTML = "";
  keys.forEach((key, i) => {
    const unlocked = isKeyUnlocked(key);
    const complete = isKeyComplete(key);
    const chip = document.createElement("button");
    chip.className = "level-chip" +
      (key === currentKey ? " active" : "") +
      (unlocked ? "" : " locked");
    chip.textContent = `Level ${i + 1}` + (complete ? " ✓" : unlocked ? "" : " 🔒");
    chip.disabled = !unlocked;
    chip.title = unlocked ? "" : "Know all words of the previous level to unlock";
    chip.addEventListener("click", () => {
      currentKey = key;
      renderLevelChips(keys);
      updateModeCount();
    });
    box.appendChild(chip);
  });
}

function updateModeCount() {
  const words = filteredLevelWords(currentKey);
  const known = knownSet(currentKey);
  const learning = learningSet(currentKey);
  const knownN = words.filter(w => known.has(w.word)).length;
  const learnN = words.filter(w => learning.has(w.word)).length;
  const filterLabel = (LEVELS.includes(currentKey) && currentPosFilter !== "all")
    ? ` (${POS_CATS.find(([c]) => c === currentPosFilter)[1].toLowerCase()})` : "";
  document.getElementById("mode-group-count").textContent =
    `${keyLabel(currentKey)}${filterLabel} — ${words.length} words · ${knownN} known · ${learnN} still learning`;
}

document.getElementById("btn-back-to-groups").addEventListener("click", showGroupsScreen);

// ============ FLASHCARDS ============
// Deck contains only words NOT marked known; marking a word known removes it
// immediately, so each loop naturally narrows to the words still being learned.
let fcDeck = [];       // [{...word, key}]
let fcIndex = 0;
let fcFlipped = false;
let fcMode = "group";  // "group" | "learning-mix" | "all"

function keyDeck(key, includeKnown) {
  const known = knownSet(key);
  return filteredLevelWords(key)
    .filter(w => includeKnown || !known.has(w.word))
    .map(w => ({ ...w, key }));
}

function startFlashcards(deck, mode) {
  fcDeck = deck;
  fcIndex = 0;
  fcFlipped = false;
  fcMode = mode;
  if (mode !== "learning-mix" && currentKey) recordRecent(currentKey);
  renderFlashcard();
  showScreen("flashcards");
}

document.getElementById("btn-mode-flashcards").addEventListener("click", () => {
  startFlashcards(keyDeck(currentKey, false), "group");
});

function nextLockedLevelKey() {
  // if the current key is a completed topic level with a next level, return it
  if (fcMode !== "group" || !currentKey) return null;
  const { name } = keyParts(currentKey);
  if (LEVELS.includes(name)) return null;
  const keys = topicLevelKeys(name);
  const idx = keys.indexOf(currentKey);
  return idx >= 0 && idx + 1 < keys.length ? keys[idx + 1] : null;
}

function renderFlashcard() {
  const completeBox = document.getElementById("deck-complete");
  const stage = document.querySelector(".card-stage");
  const controls = document.querySelector(".flash-controls");
  const resetBtn = document.getElementById("btn-fc-reset");

  if (fcDeck.length === 0) {
    completeBox.classList.remove("hidden");
    stage.classList.add("hidden");
    controls.classList.add("hidden");
    resetBtn.classList.add("hidden");
    document.getElementById("flash-progress").textContent = "";
    document.getElementById("flash-known-count").textContent = "";
    const nextKey = nextLockedLevelKey();
    const nextBtn = document.getElementById("btn-deck-next-level");
    nextBtn.classList.toggle("hidden", !nextKey);
    document.getElementById("deck-complete-msg").textContent = nextKey
      ? `You know every word here — ${keyLabel(nextKey)} is unlocked!`
      : "You know every word in this deck.";
    return;
  }
  completeBox.classList.add("hidden");
  stage.classList.remove("hidden");
  controls.classList.remove("hidden");
  resetBtn.classList.toggle("hidden", fcMode !== "group");

  if (fcIndex >= fcDeck.length) fcIndex = 0;
  const w = fcDeck[fcIndex];
  document.getElementById("fc-pos").textContent =
    w.pos + (fcMode === "learning-mix" ? ` · ${keyLabel(w.key)}` : "");
  document.getElementById("fc-word").textContent = w.word;
  document.getElementById("fc-def").textContent = w.def;
  document.getElementById("fc-example").textContent = w.example;
  document.getElementById("fc-youglish").href = youglishUrl(w.word);
  document.getElementById("fc-mic-feedback").textContent = "";
  const ipaBox = document.getElementById("fc-ipa");
  const cached = dictEntry(w.word);
  ipaBox.textContent = cached && cached.ipa ? cached.ipa : "";
  if (!cached) {
    fetchDict(w.word).then(d => {
      // only fill in if this card is still on screen
      if (d && d.ipa && fcDeck[fcIndex] && fcDeck[fcIndex].word === w.word)
        ipaBox.textContent = d.ipa;
    });
  }
  document.getElementById("flashcard").classList.remove("flipped");
  fcFlipped = false;
  document.getElementById("flash-progress").textContent =
    `Card ${fcIndex + 1} / ${fcDeck.length} left`;
  document.getElementById("flash-known-count").textContent =
    fcMode === "group" ? `${knownSet(currentKey).size} known` : `${allLearningWords().length} still learning`;
}

document.getElementById("flashcard").addEventListener("click", () => {
  fcFlipped = !fcFlipped;
  document.getElementById("flashcard").classList.toggle("flipped", fcFlipped);
});

// buttons and links inside the card must not flip it
document.getElementById("btn-fc-speak").addEventListener("click", e => {
  e.stopPropagation();
  if (fcDeck[fcIndex]) pronounceWord(fcDeck[fcIndex].word);
});
document.getElementById("fc-youglish").addEventListener("click", e => e.stopPropagation());

// ---- Speaking practice (Web Speech API, Chrome/Edge) ----
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBtn = document.getElementById("btn-fc-mic");
if (SpeechRec) micBtn.classList.remove("hidden");
let recognizing = false;
micBtn.addEventListener("click", e => {
  e.stopPropagation();
  if (!SpeechRec || recognizing || !fcDeck.length) return;
  const target = fcDeck[fcIndex].word;
  const feedback = document.getElementById("fc-mic-feedback");
  const rec = new SpeechRec();
  rec.lang = "en-US";
  rec.maxAlternatives = 5;
  recognizing = true;
  micBtn.classList.add("listening");
  feedback.textContent = "🎙️ Listening… say the word";
  feedback.className = "fc-mic-feedback";
  rec.onresult = ev => {
    const alts = ev.results[0];
    const heard = [];
    for (let i = 0; i < alts.length; i++) heard.push(alts[i].transcript.trim().toLowerCase());
    const norm = s => s.toLowerCase().replace(/[^a-z' ]/g, "");
    if (heard.some(h => norm(h) === norm(target))) {
      feedback.textContent = "✓ Sounds right!";
      feedback.className = "fc-mic-feedback good";
    } else {
      feedback.textContent = `✗ Heard “${heard[0] || "…"}” — try again`;
      feedback.className = "fc-mic-feedback bad";
    }
  };
  rec.onerror = ev => {
    feedback.textContent = ev.error === "not-allowed"
      ? "Microphone blocked — allow access and try again."
      : "Couldn't hear you — try again.";
    feedback.className = "fc-mic-feedback bad";
  };
  rec.onend = () => {
    recognizing = false;
    micBtn.classList.remove("listening");
    if (feedback.textContent.startsWith("🎙️")) feedback.textContent = "";
  };
  try { rec.start(); } catch (err) {
    recognizing = false;
    micBtn.classList.remove("listening");
  }
});

document.getElementById("btn-fc-prev").addEventListener("click", () => {
  fcIndex = (fcIndex - 1 + fcDeck.length) % fcDeck.length;
  renderFlashcard();
});
document.getElementById("btn-fc-next").addEventListener("click", () => {
  fcIndex = (fcIndex + 1) % fcDeck.length;
  renderFlashcard();
});
document.getElementById("btn-fc-known").addEventListener("click", () => {
  const w = fcDeck[fcIndex];
  setWordState(w.key, w.word, "known");
  fcDeck.splice(fcIndex, 1); // drop from the loop — next rounds only show unknown words
  renderFlashcard();
});
document.getElementById("btn-fc-unknown").addEventListener("click", () => {
  const w = fcDeck[fcIndex];
  setWordState(w.key, w.word, "learning");
  fcIndex = (fcIndex + 1) % fcDeck.length;
  renderFlashcard();
});
document.getElementById("btn-fc-reset").addEventListener("click", () => {
  if (confirm(`Reset progress for "${keyLabel(currentKey)}"?`)) {
    resetKeyProgress(currentKey);
    startFlashcards(keyDeck(currentKey, false), "group");
  }
});
document.getElementById("btn-deck-next-level").addEventListener("click", () => {
  const nextKey = nextLockedLevelKey();
  if (nextKey) {
    currentKey = nextKey;
    startFlashcards(keyDeck(currentKey, false), "group");
  }
});
document.getElementById("btn-deck-study-all").addEventListener("click", () => {
  if (fcMode === "learning-mix") showLearningScreen();
  else startFlashcards(keyDeck(currentKey, true), "all");
});
document.getElementById("btn-deck-back").addEventListener("click", backFromFlashcards);
document.getElementById("btn-back-from-flashcards").addEventListener("click", backFromFlashcards);
function backFromFlashcards() {
  if (fcMode === "learning-mix") showLearningScreen();
  else openGroup(currentTopic, currentKey);
}

// ============ STILL LEARNING TAB ============
function showLearningScreen() {
  const words = allLearningWords();
  document.getElementById("learning-summary").textContent = words.length
    ? `${words.length} word${words.length === 1 ? "" : "s"} marked "still learning" across all groups.`
    : "No words here yet — mark words as \"Still learning\" in flashcards and they'll collect here.";
  document.getElementById("btn-practice-learning").classList.toggle("hidden", words.length === 0);

  const table = document.getElementById("learning-table");
  table.innerHTML = "";
  words.forEach(w => table.appendChild(wordRow(w, { showGroup: true })));
  showScreen("learning");
}

document.getElementById("btn-practice-learning").addEventListener("click", () => {
  startFlashcards(allLearningWords(), "learning-mix");
});

// ============ KNOWN WORDS TAB ============
let knownFilter = "all";
function showKnownScreen() {
  const all = allKnownWords();

  // filter chips: All + one per group that has known words (levels merged per topic)
  const names = [];
  all.forEach(w => {
    const n = keyParts(w.key).name;
    if (!names.includes(n)) names.push(n);
  });
  if (knownFilter !== "all" && !names.includes(knownFilter)) knownFilter = "all";
  const chipBox = document.getElementById("known-filters");
  chipBox.classList.toggle("hidden", names.length === 0);
  chipBox.innerHTML = "";
  [["all", `All (${all.length})`], ...names.map(n =>
    [n, `${n} (${all.filter(w => keyParts(w.key).name === n).length})`]
  )].forEach(([value, label]) => {
    const chip = document.createElement("button");
    chip.className = "level-chip" + (knownFilter === value ? " active" : "");
    chip.textContent = label;
    chip.addEventListener("click", () => {
      knownFilter = value;
      showKnownScreen();
    });
    chipBox.appendChild(chip);
  });

  const words = knownFilter === "all" ? all : all.filter(w => keyParts(w.key).name === knownFilter);
  document.getElementById("known-summary").textContent = all.length === 0
    ? "Nothing here yet — words you mark as known will appear here."
    : knownFilter === "all"
      ? `${all.length} word${all.length === 1 ? "" : "s"} you already know. Well done!`
      : `${words.length} known word${words.length === 1 ? "" : "s"} in ${knownFilter}.`;
  const table = document.getElementById("known-table");
  table.innerHTML = "";
  words.forEach(w => {
    const row = document.createElement("div");
    row.className = "word-row compact";
    row.innerHTML = `
      <div class="w-top">
        <span class="w-word">${w.word}</span>
        <span class="w-dash">—</span>
        <span class="w-def-inline">${w.def}</span>
        <span class="w-group-tag">${keyLabel(w.key)}</span>
      </div>
    `;
    table.appendChild(row);
  });
  showScreen("known");
}

// ============ QUIZ ============
let quizWords = [];
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

document.getElementById("btn-mode-quiz").addEventListener("click", startQuiz);

function startQuiz() {
  quizWords = shuffle([...filteredLevelWords(currentKey)]);
  quizIndex = 0;
  quizScore = 0;
  recordRecent(currentKey);
  renderQuizQuestion();
  showScreen("quiz");
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderQuizQuestion() {
  quizAnswered = false;
  document.getElementById("btn-quiz-next").classList.add("hidden");
  document.getElementById("quiz-feedback").textContent = "";
  document.getElementById("quiz-feedback").className = "quiz-feedback";

  const correct = quizWords[quizIndex];
  document.getElementById("quiz-progress").textContent = `Question ${quizIndex + 1} / ${quizWords.length}`;
  document.getElementById("quiz-score").textContent = `Score: ${quizScore}`;
  document.getElementById("quiz-def").textContent = correct.def;

  // prefer distractors of the same part of speech; top up from the whole group
  let pool = filteredLevelWords(currentKey).filter(w => w.word !== correct.word);
  if (pool.length < 3) {
    const inPool = new Set(pool.map(w => w.word));
    pool = pool.concat(wordsForKey(currentKey)
      .filter(w => w.word !== correct.word && !inPool.has(w.word)));
  }
  const distractors = shuffle([...pool]).slice(0, Math.min(3, pool.length));
  const options = shuffle([correct, ...distractors]);

  const container = document.getElementById("quiz-options");
  container.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = opt.word;
    btn.addEventListener("click", () => handleQuizAnswer(btn, opt, correct));
    container.appendChild(btn);
  });
}

function handleQuizAnswer(btn, opt, correct) {
  if (quizAnswered) return;
  quizAnswered = true;
  const allBtns = document.querySelectorAll(".quiz-option");
  allBtns.forEach(b => b.disabled = true);
  recordQuizResult(correct.word, opt.word);

  const feedback = document.getElementById("quiz-feedback");
  if (opt.word === correct.word) {
    btn.classList.add("correct");
    quizScore++;
    feedback.textContent = "Correct!";
    feedback.className = "quiz-feedback correct-text";
    setWordState(currentKey, correct.word, "known");
  } else {
    btn.classList.add("wrong");
    allBtns.forEach(b => { if (b.textContent === correct.word) b.classList.add("correct"); });
    feedback.textContent = `Not quite — the answer was "${correct.word}".`;
    feedback.className = "quiz-feedback wrong-text";
    setWordState(currentKey, correct.word, "learning");
  }
  document.getElementById("quiz-score").textContent = `Score: ${quizScore}`;
  document.getElementById("btn-quiz-next").classList.remove("hidden");
}

document.getElementById("btn-quiz-next").addEventListener("click", () => {
  quizIndex++;
  if (quizIndex >= quizWords.length) {
    document.getElementById("result-score").textContent = `${quizScore} / ${quizWords.length} correct`;
    showScreen("result");
  } else {
    renderQuizQuestion();
  }
});

document.getElementById("btn-quiz-retry").addEventListener("click", startQuiz);
document.getElementById("btn-quiz-groups").addEventListener("click", showGroupsScreen);
document.getElementById("btn-back-from-quiz").addEventListener("click", () => openGroup(currentTopic, currentKey));

// ============ WORD LIST ============
document.getElementById("btn-mode-list").addEventListener("click", () => {
  document.getElementById("list-title").textContent = keyLabel(currentKey);
  recordRecent(currentKey);
  const table = document.getElementById("word-table");
  table.innerHTML = "";
  filteredLevelWords(currentKey).forEach(w =>
    table.appendChild(wordRow({ ...w, key: currentKey }, { showStatus: true })));
  showScreen("list");
});
document.getElementById("btn-back-from-list").addEventListener("click", () => openGroup(currentTopic, currentKey));

// ============ MISTAKE STATS TAB ============
function showStatsScreen() {
  const entries = Object.entries(quizStats)
    .filter(([, s]) => s.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong || a[1].right - b[1].right);

  document.getElementById("stats-summary").textContent = entries.length
    ? "Words you miss in quizzes, most-missed first."
    : "No quiz mistakes recorded yet — take a quiz and your tricky words will collect here.";
  document.getElementById("btn-stats-reset").classList.toggle("hidden", entries.length === 0);

  const table = document.getElementById("stats-table");
  table.innerHTML = "";
  entries.forEach(([word, s]) => {
    const total = s.right + s.wrong;
    const confused = Object.entries(s.confused)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w, n]) => `“${w}”${n > 1 ? ` ×${n}` : ""}`)
      .join(", ");
    const row = document.createElement("div");
    row.className = "word-row";
    row.innerHTML = `
      <div class="w-top">
        <span class="w-word">${word}</span>
        <span class="stat-wrong">✗ ${s.wrong}</span>
        <span class="stat-right">✓ ${s.right}</span>
        <span class="w-group-tag">${Math.round(s.right / total * 100)}% correct</span>
      </div>
      ${confused ? `<div class="w-def muted">You picked instead: ${confused}</div>` : ""}
    `;
    table.appendChild(row);
  });
  showScreen("stats");
}
document.getElementById("btn-stats-reset").addEventListener("click", () => {
  if (confirm("Clear all quiz mistake statistics?")) {
    quizStats = {};
    localStorage.removeItem(STATS_KEY);
    showStatsScreen();
  }
});

// ---- init ----
applyTheme(localStorage.getItem(THEME_KEY) || "plum");
updateBadges();
showGroupsScreen();
