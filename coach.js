// ===== SAMPLE ROUND DATA (latest round at end) =====
const allRounds = [
  76.0, 75.4, 75.0, 74.6, 74.0,
  73.8, 73.2, 73.0, 72.8, 72.6,
  72.4, 72.2, 71.5, 70.8, 70.2,
  69.8, 69.5, 69.1, 68.8, 68.4
];

// matching sample metrics for the same 20 rounds
const allRoundStats = [
  { fir: 57, gir: 58, putts: 32.4, vsPar: 4.0 },
  { fir: 58, gir: 59, putts: 32.1, vsPar: 3.4 },
  { fir: 59, gir: 60, putts: 31.9, vsPar: 3.0 },
  { fir: 60, gir: 60, putts: 31.7, vsPar: 2.6 },
  { fir: 60, gir: 61, putts: 31.6, vsPar: 2.0 },
  { fir: 61, gir: 61, putts: 31.5, vsPar: 1.8 },
  { fir: 61, gir: 62, putts: 31.4, vsPar: 1.2 },
  { fir: 62, gir: 62, putts: 31.3, vsPar: 1.0 },
  { fir: 62, gir: 63, putts: 31.2, vsPar: 0.8 },
  { fir: 63, gir: 63, putts: 31.1, vsPar: 0.6 },
  { fir: 63, gir: 64, putts: 31.0, vsPar: 0.4 },
  { fir: 64, gir: 64, putts: 30.9, vsPar: 0.2 },
  { fir: 64, gir: 65, putts: 30.8, vsPar: -0.5 },
  { fir: 65, gir: 65, putts: 30.7, vsPar: -1.2 },
  { fir: 65, gir: 66, putts: 30.6, vsPar: -1.8 },
  { fir: 66, gir: 66, putts: 30.5, vsPar: -2.2 },
  { fir: 66, gir: 67, putts: 30.4, vsPar: -2.5 },
  { fir: 67, gir: 67, putts: 30.3, vsPar: -2.9 },
  { fir: 67, gir: 68, putts: 30.2, vsPar: -3.2 },
  { fir: 68, gir: 68, putts: 30.0, vsPar: -3.6 }
];

// ===== STATE =====
let currentSampleSize = 15;

// ===== HELPERS =====
function getSampleRounds() {
  return allRounds.slice(-currentSampleSize);
}

function getSampleStats() {
  return allRoundStats.slice(-currentSampleSize);
}

function getAverage(arr) {
  if (!arr.length) return 0;
  const total = arr.reduce((sum, value) => sum + value, 0);
  return total / arr.length;
}

function formatVsPar(value) {
  if (value > 0) return `+${value.toFixed(1)}`;
  if (value < 0) return `${value.toFixed(1)}`;
  return "E";
}

// ===== SNAPSHOT =====
function updateSnapshot() {
  const rounds = getSampleRounds();
  const stats = getSampleStats();

  const avgScore = getAverage(rounds);
  const avgVsPar = getAverage(stats.map(item => item.vsPar));
  const avgFir = getAverage(stats.map(item => item.fir));
  const avgGir = getAverage(stats.map(item => item.gir));
  const avgPutts = getAverage(stats.map(item => item.putts));

  const metricValues = document.querySelectorAll(".snapshot-panel .metric-value");

  if (metricValues[0]) metricValues[0].textContent = avgScore.toFixed(1);
  if (metricValues[1]) metricValues[1].textContent = formatVsPar(avgVsPar);
  if (metricValues[2]) metricValues[2].textContent = `${Math.round(avgFir)}%`;
  if (metricValues[3]) metricValues[3].textContent = `${Math.round(avgGir)}%`;
  if (metricValues[4]) metricValues[4].textContent = avgPutts.toFixed(1);
  if (metricValues[5]) metricValues[5].textContent = String(rounds.length);

  const roundCountLabel = document.getElementById("roundCountLabel");
  if (roundCountLabel) {
    roundCountLabel.textContent = `${rounds.length} Rounds · Updated Today`;
  }

  const trendHeaderRange = document.querySelector(".trend-panel .panel-header span");
  if (trendHeaderRange) {
    trendHeaderRange.textContent = `Last ${rounds.length} Rounds`;
  }

  const recent5 = getAverage(allRounds.slice(-5));
  const seasonBest = Math.min(...allRounds);
  const lowRoundCount = allRounds.filter(score => score < 70).length;

  const trendMiniValues = document.querySelectorAll(".trend-summary .metric-value");
  if (trendMiniValues[0]) trendMiniValues[0].textContent = recent5.toFixed(1);
  if (trendMiniValues[1]) trendMiniValues[1].textContent = seasonBest.toFixed(0);
  if (trendMiniValues[2]) trendMiniValues[2].textContent = String(lowRoundCount);
}

function updateTrendSampleLabel() {
  const el = document.getElementById("trendSampleLabel");
  if (!el) return;

  el.innerHTML = `Coach read based on: <strong>Last ${currentSampleSize} rounds</strong>`;
}

function updateTrendInsight() {
  const rounds = getSampleRounds();
  const insightEl = document.getElementById("trendInsightNote");
  if (!insightEl || rounds.length < 2) return;

  const firstScore = rounds[0];
  const lastScore = rounds[rounds.length - 1];
  const change = lastScore - firstScore;
  const absChange = Math.abs(change);

let text = "";
let toneClass = "steady"; // default

if (absChange <= 0.5) {
  toneClass = "steady";
  text = `<strong>Trend:</strong> Steady — scoring is holding within ${absChange.toFixed(1)} strokes over this sample.`;

} else if (change < 0) {
  toneClass = "improving";
  text = `<strong>Trend:</strong> Improving — scoring down <strong>${absChange.toFixed(1)}</strong> strokes over this sample. This is a meaningful move.`;

} else if (absChange >= 1.5) {
  toneClass = "alert";
  text = `<strong>Trend:</strong> Scores rising — up <strong>${absChange.toFixed(1)}</strong> strokes over this sample.`;

} else {
  toneClass = "caution";
  text = `<strong>Trend:</strong> Slight dip — scoring up ${absChange.toFixed(1)} strokes over this sample.`;
}

// APPLY STYLE + TEXT
insightEl.className = `insight-note ${toneClass}`;
insightEl.innerHTML = text;
}


function getSelectedDashboardRounds() {
  if (typeof getSampleStats === "function") {
    return getSampleStats() || [];
  }

  return [];
}

function getAverageMetric(rounds, key) {
  const values = rounds
    .map(item => Number(item?.[key]))
    .filter(value => !Number.isNaN(value));

  if (!values.length) return null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getStrengthLeakSummary(rounds) {
  if (!rounds || rounds.length < 3) {
    return {
      strengthTitle: "More rounds needed",
      strengthText: "Add at least 3 saved rounds before this becomes coach-useful.",
      leakTitle: "More rounds needed",
      leakText: "Once a few rounds are saved, this will highlight the clearest pattern."
    };
  }

  const fir = getAverageMetric(rounds, "fir");
  const gir = getAverageMetric(rounds, "gir");
  const putts = getAverageMetric(rounds, "putts");
  const vsPar = getAverageMetric(rounds, "vsPar");

  const strengthCandidates = [];
  const leakCandidates = [];

  // STRENGTH candidates
  if (fir !== null) {
    strengthCandidates.push({
      area: "Driving Accuracy",
      score: fir,
      text: `Fairways hit are averaging ${fir.toFixed(0)}%. That gives the player better starting position and tends to calm the entire round.`
    });
  }

  if (gir !== null) {
    strengthCandidates.push({
      area: "Approach Play",
      score: gir + 4,
      text: `Greens in regulation are averaging ${gir.toFixed(0)}%. That is often the clearest sign of repeatable scoring potential.`
    });
  }

  if (putts !== null) {
    strengthCandidates.push({
      area: "Putting",
      score: 100 - putts,
      text: `Putts per round are averaging ${putts.toFixed(1)}. That suggests the player is converting enough chances to support scoring.`
    });
  }

  // LEAK candidates
  if (fir !== null) {
    leakCandidates.push({
      area: "Driving Accuracy",
      score: 70 - fir,
      text: `Fairways hit are averaging ${fir.toFixed(0)}%. More fairways would reduce pressure on the rest of the round.`
    });
  }

  if (gir !== null) {
    leakCandidates.push({
      area: "Approach Play",
      score: 72 - gir,
      text:
        gir >= 64
          ? `Greens in regulation are averaging ${gir.toFixed(0)}%. This is already solid, but it still looks like the clearest place to create even more birdie chances.`
          : `Greens in regulation are averaging ${gir.toFixed(0)}%. More consistent approach play would create more makeable birdie and par chances.`
    });
  }

  if (putts !== null) {
    leakCandidates.push({
      area: "Putting",
      score: putts - 29,
      text: `Putts per round are averaging ${putts.toFixed(1)}. Cleaning this up even slightly could make a visible scoring difference.`
    });
  }

  if (vsPar !== null) {
    leakCandidates.push({
      area: "Overall Scoring",
      score: vsPar + 5,
      text: `Average scoring relative to par is ${vsPar.toFixed(1)}. There is still room to convert this profile into lower scoring.`
    });
  }

  const validLeakCandidates = leakCandidates.filter(item => item.score > 0);

  strengthCandidates.sort((a, b) => b.score - a.score);
  validLeakCandidates.sort((a, b) => b.score - a.score);

  const topStrength = strengthCandidates[0] || null;
  const secondStrength = strengthCandidates[1] || null;
  const topLeak = validLeakCandidates[0] || null;

  let strengthTitle = topStrength?.area || "--";
  let strengthText = topStrength?.text || "--";

  if (topStrength && secondStrength) {
    const strengthGap = topStrength.score - secondStrength.score;

    if (strengthGap < 2) {
      strengthTitle = "Balanced strengths";
      strengthText = `No single category is clearly separating from the others right now. ${topStrength.area} and ${secondStrength.area} are both showing up as meaningful strengths in this sample.`;
    }
  }

  return {
    strengthTitle: strengthTitle,
    strengthText: strengthText,
    leakTitle: topLeak?.area || "No major weakness showing",
    leakText: topLeak?.text || "This sample does not show one clear stat weakness right now."
  };
}

function renderStrengthLeakCard() {
  const rounds = getSelectedDashboardRounds();
  const summary = getStrengthLeakSummary(rounds);

  const strengthTitleEl = document.getElementById("biggestStrengthTitle");
  const strengthTextEl = document.getElementById("biggestStrengthText");
  const leakTitleEl = document.getElementById("biggestLeakTitle");
  const leakTextEl = document.getElementById("biggestLeakText");

  if (strengthTitleEl) strengthTitleEl.textContent = summary.strengthTitle;
  if (strengthTextEl) strengthTextEl.textContent = summary.strengthText;
  if (leakTitleEl) leakTitleEl.textContent = summary.leakTitle;
  if (leakTextEl) leakTextEl.textContent = summary.leakText;
}

function getBenchmarkRead() {
  const rounds = getSampleRounds();
  const stats = getSampleStats();

  if (!rounds.length || !stats.length) {
    return {
      title: "No data",
      text: "Not enough rounds to evaluate benchmark level."
    };
  }

  const avgScore = getAverage(rounds);
  const avgVsPar = getAverage(stats.map(s => s.vsPar));
  const avgGir = getAverage(stats.map(s => s.gir));
  const avgFir = getAverage(stats.map(s => s.fir));
  const avgPutts = getAverage(stats.map(s => s.putts));

  // === LEVEL DETERMINATION (simple but strong first pass) ===
  let level = "";
  let tone = "";
  let summary = "";

  if (avgScore <= 72) {
    level = "Tracking in D1 range";
    tone = "high";

  } else if (avgScore <= 75) {
    level = "Borderline D1 / Strong D2 profile";
    tone = "good";

  } else if (avgScore <= 78) {
    level = "D2 competitive range";
    tone = "mid";

  } else {
    level = "Developing college-level profile";
    tone = "low";
  }

  // === CONTEXT (coach-style read) ===
  let context = "";

  if (avgGir >= 65) {
    context = "Ball striking is already at a high level.";
  } else if (avgGir >= 58) {
    context = "Approach play is solid but still has room to separate.";
  } else {
    context = "Approach play is likely the biggest limiter right now.";
  }

  if (avgPutts <= 30) {
    context += " Putting is helping convert opportunities.";
  } else if (avgPutts >= 32) {
    context += " Putting may be costing strokes.";
  }

  summary = `Averages ${avgScore.toFixed(1)} (${formatVsPar(avgVsPar)}). ${context}`;

  return {
    title: level,
    text: summary
  };
}

function renderBenchmarkStatus() {
  const read = getBenchmarkRead();

  const titleEl = document.getElementById("benchmarkStatusTitle");
  const textEl = document.getElementById("benchmarkStatusText");

  if (titleEl) titleEl.textContent = read.title;
  if (textEl) textEl.textContent = read.text;
}

function getBenchmarkBand(avgScore) {
  if (avgScore <= 72) return "d1-top";
  if (avgScore <= 75) return "d1-mid";
  if (avgScore <= 78) return "d1-low";
  if (avgScore <= 76) return "d2-top";
  return "d2-typical";
}

function positionBenchmarkArrow() {
  const arrow = document.getElementById("benchmarkArrow");
  const rowWrap = document.querySelector(".benchmark-row-wrap");
  if (!arrow || !rowWrap) return;

  const rounds = getSampleRounds();
  if (!rounds.length) return;

  const avgScore = getAverage(rounds);
  const band = getBenchmarkBand(avgScore);
  const targetCard = rowWrap.querySelector(`.benchmark-card[data-band="${band}"]`);
  if (!targetCard) return;

  const wrapRect = rowWrap.getBoundingClientRect();
  const cardRect = targetCard.getBoundingClientRect();

  const arrowHalfWidth = 16; // matches border-left/right
  const centerX = (cardRect.left - wrapRect.left) + (cardRect.width / 2);

  arrow.style.transform = `translateX(${centerX - arrowHalfWidth}px)`;
}

function getBenchmarkBand(avgScore) {
  if (avgScore <= 72) return "d1-top";
  if (avgScore <= 75) return "d1-mid";
  if (avgScore <= 78) return "d1-low";
  if (avgScore <= 76) return "d2-top";
  return "d2-typical";
}

function positionBenchmarkArrow() {
  const arrow = document.getElementById("benchmarkArrow");
  const rowWrap = document.querySelector(".benchmark-row-wrap");
  if (!arrow || !rowWrap) return;

  const rounds = getSampleRounds();
  if (!rounds.length) return;

  const avgScore = getAverage(rounds);
  const band = getBenchmarkBand(avgScore);
  const targetCard = rowWrap.querySelector(`.benchmark-card[data-band="${band}"]`);
  if (!targetCard) return;

  const wrapRect = rowWrap.getBoundingClientRect();
  const cardRect = targetCard.getBoundingClientRect();

  const arrowHalfWidth = 16;
  const centerX = (cardRect.left - wrapRect.left) + (cardRect.width / 2);

  arrow.style.transform = `translateX(${centerX - arrowHalfWidth}px)`;
}



function getBenchmarkBand(avgScore) {
  if (avgScore <= 72) return "d1-top";
  if (avgScore <= 75) return "d1-mid";
  if (avgScore <= 78) return "d1-low";
  if (avgScore <= 76) return "d2-top";
  return "d2-typical";
}

function positionBenchmarkArrow() {
  const arrow = document.getElementById("benchmarkArrow");
  const rowWrap = document.querySelector(".benchmark-row-wrap");
  if (!arrow || !rowWrap) return;

  const rounds = getSampleRounds();
  if (!rounds.length) return;

  const avgScore = getAverage(rounds);
  const band = getBenchmarkBand(avgScore);
  const targetCard = rowWrap.querySelector(`.benchmark-card[data-band="${band}"]`);
  if (!targetCard) return;

  const wrapRect = rowWrap.getBoundingClientRect();
  const cardRect = targetCard.getBoundingClientRect();

  const arrowHalfWidth = 16;
  const centerX = (cardRect.left - wrapRect.left) + (cardRect.width / 2);

  arrow.style.transform = `translateX(${centerX - arrowHalfWidth}px)`;
}

// ===== CHART =====
function drawScoreTrendChart() {
  const canvas = document.getElementById("scoreTrendChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rounds = getSampleRounds();
  if (!rounds.length) return;

  const parent = canvas.parentElement;
  const width = Math.max(320, parent.clientWidth - 8);
  const height = Math.max(220, parent.clientHeight - 8);

  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);

  const padding = { top: 28, right: 24, bottom: 42, left: 54 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const minData = Math.min(...rounds);
  const maxData = Math.max(...rounds);
  const minScore = Math.floor(minData - 1);
  const maxScore = Math.ceil(maxData + 1);

  ctx.strokeStyle = "#d8e6dd";
  ctx.lineWidth = 1;

  for (let value = minScore; value <= maxScore; value += 1) {
    const y =
      padding.top + ((maxScore - value) / (maxScore - minScore || 1)) * chartHeight;

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = "#698474";
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), padding.left - 10, y);
  }

  ctx.strokeStyle = "#2ea957";
  ctx.lineWidth = 4;
  ctx.beginPath();

  rounds.forEach((score, index) => {
    const x =
      padding.left + (index / Math.max(rounds.length - 1, 1)) * chartWidth;
    const y =
      padding.top + ((maxScore - score) / (maxScore - minScore || 1)) * chartHeight;

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  rounds.forEach((score, index) => {
    const x =
      padding.left + (index / Math.max(rounds.length - 1, 1)) * chartWidth;
    const y =
      padding.top + ((maxScore - score) / (maxScore - minScore || 1)) * chartHeight;

    ctx.beginPath();
    ctx.fillStyle = "#2ea957";
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#546d5d";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(index + 1), x, height - padding.bottom + 12);
  });

  ctx.fillStyle = "#4f6858";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Round", padding.left + chartWidth / 2, height - 8);

  ctx.save();
  ctx.translate(16, padding.top + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Score", 0, 0);
  ctx.restore();
}

function flashUpdate(el) {
  if (!el) return;
  el.classList.remove("flash-update");
  void el.offsetWidth; // restart animation
  el.classList.add("flash-update");
}


/* ========================================
   FLASH HELPER (restarts animation cleanly)
======================================== */
function flashUpdate(el) {
  if (!el) return;
  el.classList.remove("flash-update");
  void el.offsetWidth; // forces reflow so animation restarts
  el.classList.add("flash-update");
}


// ===== BUTTONS =====
function wireSampleButtons() {
  const buttons = document.querySelectorAll(".sample-btn");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const selected = button.dataset.count;

      // update ALL buttons everywhere
      buttons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.count === selected);
      });

      currentSampleSize = parseInt(selected, 10);

    updateSnapshot();
      updateTrendInsight();
      drawScoreTrendChart();
      renderStrengthLeakCard();
      renderBenchmarkStatus();
      positionBenchmarkArrow();  

     /* ========================================
   FLASH UPDATED SECTIONS (visual feedback)
======================================== */
flashUpdate(document.getElementById("trendInsightNote"));
flashUpdate(document.getElementById("biggestStrengthBox"));
flashUpdate(document.getElementById("biggestLeakBox"));
flashUpdate(document.querySelector(".benchmark-status-card"));

// 🔥 FLASH FEEDBACK
flashUpdate(document.getElementById("trendInsightNote"));
flashUpdate(document.getElementById("biggestStrengthBox"));
flashUpdate(document.getElementById("biggestLeakBox"));
flashUpdate(document.querySelector(".benchmark-status-card"));
    });
  });
}

// ===== INIT =====
function initCoachDashboard() {
  wireSampleButtons();
  updateSnapshot();
  updateTrendInsight();
  drawScoreTrendChart();
  renderStrengthLeakCard();
  renderBenchmarkStatus();
  positionBenchmarkArrow();

  // NAV SCROLL
const navButtons = document.querySelectorAll(".category-tile");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    if (!targetId) return;

    // 🔹 Handle Dashboard (top)
    if (targetId === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const section = document.getElementById(targetId);
      if (!section) return;

      section.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    // active state
    navButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

const contactBtn = document.getElementById("contactEmailBtn");

if (contactBtn) {
  contactBtn.addEventListener("click", () => {
    window.location.href = "mailto:your-email-here@example.com";
  });
}
}

window.addEventListener("load", initCoachDashboard);
window.addEventListener("resize", () => {
  drawScoreTrendChart();
  positionBenchmarkArrow();
});