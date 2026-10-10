// game-flags.js
// Spelläge 1: Visa en flagga, välj rätt land bland åtta alternativ.
//
// v3-uppgradering (se spelkoncept.md och feedback från användartest):
// - Ingen tidspress längre - spelaren får svara i sin egen takt.
// - Poängsystemet är borttaget - highscore baseras istället på längsta antal
//   rätt i rad (state.bestStreak) under en rond (se local-highscores.js).
//   Under spelets gång visas X/Y rätt + streak, och varje svar får ett kort,
//   situationsanpassat uppmuntringsmeddelande (t.ex. "5 rätt i rad - du är på
//   en streak!" eller "Kom igen, du kan bättre!").
// - Svårare distraktorer (feedback: spelet var för lätt): fler svarsalternativ
//   ju längre in i rundan, och alternativen väljs inte längre helt slumpmässigt
//   - kända förväxlingspar och länder i samma subregion/region prioriteras
//   eftersom de är visuellt/geografiskt mest lika och därmed svårast att skilja.
import { sampleCountries, REGION_OPTIONS } from "./countries-data.js";
import {
  renderProgress,
  renderTallyBar,
  showFeedback,
  showRoundSummary,
  showStreakPopup,
  pickEncouragement,
} from "./ui.js";
import { submitStreak } from "./local-highscores.js";

const ROUND_LENGTH = 10;

// Svårighetsnivå utan tidspress: alltid åtta svarsalternativ hela rundan
// (feedback: spelet var för lätt med färre alternativ i början - fler
// förväxlingsbara alternativ gör varje fråga svårare att gissa rätt på).
const OPTION_COUNT = 8;

function optionsForIndex() {
  return OPTION_COUNT;
}

/**
 * Väljer svarsalternativ som är svårare att skilja från rätt svar än ett
 * rent slumpmässigt urval:
 * 1. Kända förväxlingspar (trivia.nearMissWith), t.ex. Tchad/Rumänien.
 * 2. Länder i samma subregion (t.ex. Västafrika) - liknar varandra visuellt.
 * 3. Länder i samma region om subregionen inte räcker till.
 * 4. Slumpat ur den valda regionpoolen (eller alla länder) som sista utfyllnad.
 */
function pickDistractors(answer, count, pool, allCountries) {
  const chosen = [];
  const usedCodes = new Set([answer.cca2]);

  function fillFrom(candidates) {
    const shuffled = sampleCountries(candidates, candidates.length);
    for (const c of shuffled) {
      if (chosen.length >= count) break;
      if (usedCodes.has(c.cca2)) continue;
      chosen.push(c);
      usedCodes.add(c.cca2);
    }
  }

  const nearMissCodes = answer.trivia?.nearMissWith || [];
  for (const code of nearMissCodes) {
    if (chosen.length >= count) break;
    if (usedCodes.has(code)) continue;
    const match = allCountries.find((c) => c.cca2 === code);
    if (match) {
      chosen.push(match);
      usedCodes.add(code);
    }
  }

  fillFrom(allCountries.filter((c) => !usedCodes.has(c.cca2) && c.subregion && c.subregion === answer.subregion));
  fillFrom(allCountries.filter((c) => !usedCodes.has(c.cca2) && c.region && c.region === answer.region));
  fillFrom((pool.length > count ? pool : allCountries).filter((c) => !usedCodes.has(c.cca2)));

  return chosen.slice(0, count);
}

export function initFlagGame(container, allCountries) {
  renderRegionSelect(container, allCountries);
}

function renderRegionSelect(container, allCountries) {
  container.innerHTML = `
    <div class="fq-region-select">
      <h2>Välj region</h2>
      <div class="fq-region-grid">
        ${REGION_OPTIONS.map(
          (r) => `<button type="button" class="fq-region-card" data-key="${r.key}">${r.label}</button>`
        ).join("")}
      </div>
    </div>
  `;
  container.querySelectorAll(".fq-region-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const region = REGION_OPTIONS.find((r) => r.key === btn.dataset.key);
      const pool = region.filter(allCountries);
      if (pool.length < 4) {
        alert("För få länder i den här regionen för att bygga svarsalternativ - välj en annan region.");
        return;
      }
      startRound(container, allCountries, pool, region);
    });
  });
}

function startRound(container, allCountries, pool, region) {
  const state = {
    pool,
    region,
    questions: sampleCountries(pool, Math.min(ROUND_LENGTH, pool.length)),
    index: 0,
    bestStreak: 0,
    streak: 0,
    correctCount: 0,
  };

  renderQuestion(container, allCountries, state);
}

function renderQuestion(container, allCountries, state) {
  if (state.index >= state.questions.length) {
    submitStreak("flags", state.bestStreak, { region: state.region.label });
    showRoundSummary(container, {
      bestStreak: state.bestStreak,
      correctCount: state.correctCount,
      total: state.questions.length,
      onReplay: () => startRound(container, allCountries, state.pool, state.region),
      onChangeRegion: () => renderRegionSelect(container, allCountries),
    });
    return;
  }

  const optionCount = optionsForIndex(state.index);
  const answer = state.questions[state.index];
  const distractors = pickDistractors(answer, optionCount - 1, state.pool, allCountries);
  const options = shuffle([answer, ...distractors]);

  container.innerHTML = "";
  renderProgress(container, state.index, state.questions.length);
  renderTallyBar(container, { correctCount: state.correctCount, totalAnswered: state.index, combo: state.streak });

  const card = document.createElement("div");
  card.className = "fq-flag-card fq-fade-in";
  card.innerHTML = `<img src="${answer.flagUrl}" alt="Flagga att gissa" width="320" />`;
  container.appendChild(card);
  state.cardEl = card;

  const optionsEl = document.createElement("div");
  optionsEl.className = "fq-options";
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fq-option-btn";
    btn.textContent = opt.nameSv;
    btn.dataset.cca2 = opt.cca2;
    btn.addEventListener("click", () => handleAnswer(container, allCountries, state, opt, answer, btn));
    optionsEl.appendChild(btn);
  });
  container.appendChild(optionsEl);
}

function handleAnswer(container, allCountries, state, chosen, answer, clickedBtn) {
  const correct = chosen && chosen.cca2 === answer.cca2;
  const hadBigStreak = state.streak >= 5;

  // Inaktivera alla knappar direkt så man inte kan hinna klicka igen under feedbacken.
  container.querySelectorAll(".fq-option-btn").forEach((b) => (b.disabled = true));

  // Taktil feedback direkt på knapparna: studs+grönt vid rätt, skak+rött vid fel,
  // och visa alltid rätt svar i grönt om man svarade fel.
  const correctBtn = container.querySelector(`.fq-option-btn[data-cca2="${answer.cca2}"]`);
  if (correct && clickedBtn) {
    clickedBtn.classList.add("fq-option-correct");
  } else {
    if (clickedBtn) clickedBtn.classList.add("fq-option-incorrect");
    if (correctBtn) correctBtn.classList.add("fq-option-reveal-correct");
  }

  // Fäll ihop svaret så att facit och Nästa-knappen kommer inom synhåll direkt
  // (viktigt på mobil med åtta alternativ): dölj alla knappar utom den man valde
  // och det rätta svaret, och krymp flaggan.
  container.querySelectorAll(".fq-option-btn").forEach((b) => {
    if (b !== clickedBtn && b !== correctBtn) b.classList.add("fq-option-collapsed");
  });
  container.querySelector(".fq-options")?.classList.add("fq-options-answered");
  if (state.cardEl) state.cardEl.classList.add("fq-flag-card-answered");

  if (correct) {
    state.streak += 1;
    state.correctCount += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    if ([3, 5, 8, 12].includes(state.streak)) {
      showStreakPopup(state.cardEl || container, state.streak);
    }
  } else {
    state.streak = 0;
  }

  const totalAnswered = state.index + 1;
  const message = pickEncouragement({
    correct,
    streakAfter: state.streak,
    hadBigStreak: !correct && hadBigStreak,
    correctCount: state.correctCount,
    totalAnswered,
  });
  renderTallyBar(container, { correctCount: state.correctCount, totalAnswered, combo: state.streak });

  // "Så nära!" visas bara om spelaren faktiskt valde landet som brukar
  // förväxlas med rätt svar - inte vid vilket fel svar som helst.
  const nearMissCountry =
    !correct && chosen && (answer.trivia?.nearMissWith || []).includes(chosen.cca2) ? chosen : null;

  showFeedback(container, {
    correct,
    country: answer,
    nearMissCountry,
    message,
    onNext: () => {
      state.index += 1;
      renderQuestion(container, allCountries, state);
    },
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
