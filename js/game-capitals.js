// game-capitals.js
// Spelläge 2: Gissa huvudstaden till ett land. Skrivfält med Levenshtein-tolerans
// så småstavfel inte dödar streaken (se spelkoncept.md, UX-rekommendation).
//
// Paritet med flaggspelet (UX-feedback): regionval + "byt region" i
// rondsammanfattningen, precis som game-flags.js. Ingen ökad stavfelsstränghet
// längre in i rundan - det skulle straffa legitima klumpfingrar snarare än
// att testa kunskap, vilket inte är samma sorts svårighet som fler
// flaggalternativ.
import { sampleCountries, REGION_OPTIONS } from "./countries-data.js";
import {
  renderProgress,
  renderTallyBar,
  showFeedback,
  showRoundSummary,
  pickEncouragement,
} from "./ui.js";
import { submitStreak } from "./local-highscores.js";

const ROUND_LENGTH = 10;

export function initCapitalGame(container, allCountries) {
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
      // Länder där huvudstaden heter som landet (Monaco, Singapore, Panama
      // City ...) avslöjar svaret i frågan - de hoppas över i det här läget.
      const pool = region.filter(allCountries).filter((c) => !capitalGivesAwayAnswer(c));
      if (pool.length < 1) {
        alert("Inga länder i den här regionen - välj en annan region.");
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
    submitStreak("capitals", state.bestStreak, { region: state.region.label });
    showRoundSummary(container, {
      bestStreak: state.bestStreak,
      correctCount: state.correctCount,
      total: state.questions.length,
      onReplay: () => startRound(container, allCountries, state.pool, state.region),
      onChangeRegion: () => renderRegionSelect(container, allCountries),
    });
    return;
  }

  const answer = state.questions[state.index];
  container.innerHTML = "";
  state.answered = false;
  renderProgress(container, state.index, state.questions.length);
  renderTallyBar(container, { correctCount: state.correctCount, totalAnswered: state.index, combo: state.streak });

  const card = document.createElement("div");
  card.className = "fq-capital-card";
  card.innerHTML = `
    <img src="${answer.flagUrl}" alt="${answer.nameSv}s flagga" width="120" />
    <h2>Vad heter huvudstaden i ${answer.nameSv}?</h2>
    <form class="fq-capital-form">
      <input type="text" name="capital" autocomplete="off" autocorrect="off" autocapitalize="words"
        spellcheck="false" enterkeyhint="done" lang="sv" aria-label="Huvudstad" placeholder="Skriv ditt svar..." />
      <button type="submit">Svara</button>
    </form>
  `;
  container.appendChild(card);

  const form = card.querySelector("form");
  const input = card.querySelector("input");
  input.focus();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // Spärr mot "fusk"/dubbelklick: när frågan väl är besvarad ignoreras alla
    // ytterligare submits (annars kunde man trycka Svara flera gånger på samma
    // rätta svar och pumpa upp streaken).
    if (state.answered) return;
    state.answered = true;
    input.readOnly = true;
    // Stäng mobiltangentbordet så att det inte täcker facit och Nästa-knappen.
    input.blur();
    form.querySelector("button[type='submit']").disabled = true;
    handleAnswer(container, allCountries, state, input.value, answer);
  });
}

function handleAnswer(container, allCountries, state, guess, answer) {
  const correct = isCorrectCapital(guess, answer, allCountries);
  const hadBigStreak = state.streak >= 5;

  if (correct) {
    state.streak += 1;
    state.correctCount += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
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

  showFeedback(container, {
    correct,
    country: answer,
    nearMissCountry: null,
    message,
    onNext: () => {
      state.index += 1;
      renderQuestion(container, allCountries, state);
    },
  });
}

// Normaliserar ett svar: gemener, utan accenter och skiljetecken, och med
// "St"/"St." tolkat som "Saint" - så att "Washington DC", "St Johns" och
// "N'Djamena"/"Ndjamena" räknas som samma sak som facit.
function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´.]/g, "")
    .replace(/[-,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^st /, "saint ");
}

/** Alla godkända svar för ett land: huvudstaden + eventuella alternativ (capitalAlt). */
function acceptedAnswers(country) {
  return [country.capital, ...(country.capitalAlt || [])].map(normalize);
}

function capitalGivesAwayAnswer(country) {
  const cap = normalize(country.capital);
  return cap.includes(normalize(country.nameSv)) || cap.includes(normalize(country.nameEn));
}

/**
 * Rätt om svaret matchar huvudstaden eller ett godkänt alternativ, med ett
 * tecken stavfel tillåtet (för namn på minst 5 tecken). Ett svar som exakt är
 * ett ANNAT lands huvudstad räknas dock alltid som fel - annars skulle t.ex.
 * "Kingstown" (Saint Vincent) godtas för "Kingston" (Jamaica).
 */
function isCorrectCapital(guess, answer, allCountries) {
  const g = normalize(guess);
  if (!g) return false;
  const accepted = acceptedAnswers(answer);
  if (accepted.includes(g)) return true;
  const isOtherCapital = allCountries.some((c) => c.cca2 !== answer.cca2 && acceptedAnswers(c).includes(g));
  if (isOtherCapital) return false;
  return accepted.some((a) => a.length >= 5 && levenshtein(g, a) <= 1);
}

// Enkel Levenshtein-avstånd för stavfelstolerans.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}
