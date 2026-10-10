// ui.js
// Delade UI-hjälpare: faktakort, feedback (rätt/fel), progressbar, tally-bar
// och kontextuella uppmuntringsmeddelanden.
//
// Designprincip (se spelkoncept.md): spelet ska kännas som en tränare, inte
// en poängräknare. Rå poäng ("115 poäng") saknar mening i stunden - det som
// engagerar är hur man ligger till just nu (X/Y rätt, streaks) och en
// uppmuntran anpassad efter hur rundan faktiskt går. Poängsystemet är nu helt
// borttaget (kändes dubbelt upp med streak-mekaniken) - highscore baseras
// istället på längsta antal rätt i rad under en rond (se local-highscores.js).
//
// Feedback använder ALDRIG bara färg - alltid ikon/text också (tillgänglighet).

/** Segmenterad progress (Duolingo-stil): en prick per fråga i stället för en platt bar. */
export function renderProgress(container, current, total) {
  let bar = container.querySelector(".fq-progress");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "fq-progress";
    container.prepend(bar);
  }
  bar.innerHTML = Array.from({ length: total }, (_, i) => {
    const cls = i < current ? "fq-dot-done" : i === current ? "fq-dot-current" : "";
    return `<span class="fq-progress-dot ${cls}"></span>`;
  }).join("");
}

/** Visar "X/Y rätt" + combo-badge - ersätter en ren poängsumma under spelets gång. */
export function renderTallyBar(container, { correctCount, totalAnswered, combo }) {
  let el = container.querySelector(".fq-scorebar");
  if (!el) {
    el = document.createElement("div");
    el.className = "fq-scorebar";
    container.appendChild(el);
  }
  const tier = comboTier(combo);
  const comboBadge = tier > 0
    ? `<span class="fq-combo-badge fq-combo-tier-${tier}">🔥 ${combo} i rad</span>`
    : "";
  el.innerHTML = `<strong>${correctCount}/${totalAnswered}</strong> rätt ${comboBadge}`;
  if (tier > 0) {
    el.classList.add("fq-scorebar-pop");
    setTimeout(() => el.classList.remove("fq-scorebar-pop"), 300);
  }
}

/** Returnerar 0 om ingen combo är aktiv, annars en nivå 1-4 (används för badge-styling). */
export function comboTier(streak) {
  if (streak >= 12) return 4;
  if (streak >= 8) return 3;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1;
  return 0;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Väljer ett kort, situationsanpassat uppmuntringsmeddelande utifrån hur
 * rundan faktiskt går - inte bara "Rätt!"/"Fel svar" rakt av.
 * options: { correct, streakAfter, hadBigStreak, correctCount, totalAnswered }
 */
export function pickEncouragement({ correct, streakAfter, hadBigStreak, correctCount, totalAnswered }) {
  const accuracy = totalAnswered > 0 ? correctCount / totalAnswered : 1;
  const strugglingNow = totalAnswered >= 3 && accuracy < 0.5;

  if (correct) {
    if (streakAfter >= 8) return pick(["🔥 Ostoppbar! Du är på en riktig streak.", "🔥 Otroligt tempo just nu!"]);
    if (streakAfter >= 5) return pick([`🔥 ${streakAfter} rätt i rad - du är på en streak!`, "🔥 Nu rullar det på!"]);
    if (streakAfter === 3) return "🔥 3 rätt i rad, nu är du igång!";
    if (strugglingNow) return pick(["Snyggt, du hämtar in dig!", "Där ser man - du lär dig snabbt."]);
    return pick(["Snyggt!", "Där satt den!", "Rätt svar!"]);
  }

  if (hadBigStreak) return "Streaken bröts - men vilken körning det var! Kör vidare.";
  if (strugglingNow) return pick(["Kom igen, du kan bättre!", "Nästa blir din!", "Håll ut - det klarnar snart."]);
  return pick(["Ingen fara, kör på!", "Nästa blir rätt!", "Så nära - fortsätt!"]);
}

/** Rubrik för rondsammanfattningen, baserad på hur stor andel som blev rätt. */
export function pickRoundHeadline(correctCount, total) {
  const pct = total > 0 ? correctCount / total : 0;
  if (pct === 1) return "🌟 Perfekt! Du kan dina flaggor.";
  if (pct >= 0.8) return "Riktigt bra jobbat! 🎉";
  if (pct >= 0.5) return "Bra kämpat! Några till nästa runda?";
  return "Nu vet du vilka du ska öva på - kör igen!";
}

/** Visar en flytande streak-chip (t.ex. "🔥 5 i rad!") som sedan tonas bort. */
export function showStreakPopup(container, streakCount) {
  const popup = document.createElement("div");
  popup.className = "fq-score-popup";
  popup.textContent = `🔥 ${streakCount} i rad!`;
  container.appendChild(popup);
  setTimeout(() => popup.remove(), 900);
}

/**
 * Visar feedback på ett svar + ett faktakort med trivia.
 * options: { correct, country, nearMissCountry, message, onNext }
 */
export function showFeedback(container, { correct, country, nearMissCountry, message, note, onNext }) {
  let panel = container.querySelector(".fq-feedback");
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "fq-feedback";
    container.appendChild(panel);
  }

  const icon = correct ? "✓" : "✗"; // bock / kryss - inte bara färg
  const iconAnim = correct ? "fq-icon-bounce" : "fq-icon-shake";
  const status = correct ? "fq-correct" : "fq-incorrect";

  let nearMissHtml = "";
  if (!correct && nearMissCountry) {
    nearMissHtml = `<p class="fq-nearmiss">Så nära! <strong>${nearMissCountry.nameSv}</strong> och <strong>${country.nameSv}</strong> förväxlas ofta.</p>`;
  }

  // Faktaraden visas EN gång: kuraterad trivia om vi har den, annars bara huvudstad/region.
  const factHtml = country.trivia ? `<p class="fq-fact">${country.trivia.fact}</p>` : "";
  // Valfri extra info-rad - används t.ex. av kartläget för att visa hur
  // många km fel man klickade och vilket land man faktiskt pekade närmast.
  const noteHtml = note ? `<p class="fq-map-note">${note}</p>` : "";

  panel.className = `fq-feedback ${status} fq-visible`;
  panel.innerHTML = `
    <div class="fq-feedback-head"><span class="fq-feedback-icon ${iconAnim}">${icon}</span> ${message || (correct ? "Rätt!" : "Fel svar")}</div>
    <h3>${country.nameSv}</h3>
    <p class="fq-meta">Huvudstad: ${country.capital} &middot; ${country.subregionSv || country.regionSv || country.subregion || country.region}</p>
    ${nearMissHtml}
    ${noteHtml}
    ${factHtml}
    <button type="button" class="fq-next-btn">Nästa &rarr;</button>
  `;

  const nextBtn = panel.querySelector(".fq-next-btn");
  nextBtn.addEventListener("click", () => {
    panel.classList.remove("fq-visible");
    window.scrollTo({ top: 0 });
    onNext();
  });

  // Mobil: se till att facit och Nästa-knappen hamnar inom skärmen direkt
  // efter svaret (de låg tidigare under skärmkanten på mindre telefoner).
  // Fokus på Nästa gör också att Enter går vidare till nästa fråga.
  requestAnimationFrame(() => {
    const rect = panel.getBoundingClientRect();
    if (rect.bottom > window.innerHeight || rect.top < 0) {
      panel.scrollIntoView({ behavior: "smooth", block: rect.height > window.innerHeight ? "start" : "end" });
    }
    nextBtn.focus({ preventScroll: true });
  });
}

export function formatNumber(n) {
  if (typeof n !== "number") return "-";
  return n.toLocaleString("sv-SE");
}

export function showRoundSummary(container, { bestStreak, correctCount, total, onReplay, onChangeRegion, changeRegionLabel = "Byt region" }) {
  const perfect = correctCount === total;
  const headline = pickRoundHeadline(correctCount, total);
  container.innerHTML = `
    <div class="fq-summary">
      ${perfect ? '<div class="fq-perfect-badge">⭐ Perfekt rond!</div>' : ""}
      <h2>${headline}</h2>
      <p class="fq-summary-tally">${correctCount}/${total} rätt</p>
      <p class="fq-summary-score">Bästa streak: ${bestStreak} i rad</p>
      <button type="button" class="fq-replay-btn">Spela igen</button>
      ${onChangeRegion ? `<button type="button" class="fq-region-btn">${changeRegionLabel}</button>` : ""}
      <button type="button" class="fq-share-btn">Dela resultat</button>
    </div>
  `;
  container.querySelector(".fq-replay-btn").addEventListener("click", onReplay);
  if (onChangeRegion) {
    container.querySelector(".fq-region-btn").addEventListener("click", onChangeRegion);
  }
  container.querySelector(".fq-share-btn").addEventListener("click", () => {
    const text = `🔥 Jag fick ${bestStreak} rätt i rad på Flaggquiz! Klarar du bättre?`;
    if (navigator.share) {
      navigator.share({ text, url: location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => alert("Resultat kopierat - klistra in var du vill dela det!"))
        .catch(() => alert(text));
    } else {
      alert(text);
    }
  });

  if (perfect) launchConfetti(container.querySelector(".fq-summary"));
}

const CONFETTI_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

/** Ren CSS/JS-konfetti (inga bibliotek) - en kort skur av fallande, roterande bitar. */
function launchConfetti(target, count = 22) {
  if (!target) return;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "fq-confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDuration = `${0.9 + Math.random() * 0.7}s`;
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    target.appendChild(piece);
    setTimeout(() => piece.remove(), 2200);
  }
}
