let allRounds = [];
let allRoundStats = [];

let chartPointRegions = [];
let chartRoundStats = [];

let allFullRounds = []; // FULL round data including holes_json (+Stats)

let selectedPlusStatsRound = null;

async function loadRoundsFromSupabase() {
  if (!window.supabaseClient) {
    console.error("Supabase client missing");
    return;
  }

// ===== LOAD V1 ROUNDS =====
const { data: v1Data, error: v1Error } = await window.supabaseClient
  .from("completed_rounds")
  .select("*")
  .order("round_date", { ascending: false });

if (v1Error) {
  console.error("Error loading V1 rounds:", v1Error);
  return;
}

// ===== LOAD P2 ROUNDS =====
const { data: p2Data, error: p2Error } = await window.supabaseClient
  .from("completed_rounds_p2")
  .select("*")
  .order("round_date", { ascending: false });

if (p2Error) {
  console.error("Error loading P2 rounds:", p2Error);
}

console.log("P2 ROUNDS FROM SUPABASE:", p2Data);
console.log("P2 ROUNDS ERROR:", p2Error);

// ===== COMBINE V1 + P2 =====
const data = [
  ...(v1Data || []).map(r => ({ ...r, source: "V1" })),
  ...(p2Data || []).map(r => ({ ...r, source: "P2" }))
];

// Trend chart should read left-to-right: oldest → newest
data.sort((a, b) => new Date(a.round_date) - new Date(b.round_date));

  console.log("REAL ROUNDS:", data);

  allFullRounds = data; // <-- ADD THIS LINE

// Keep one-hole / partial test uploads out of the scoring chart
// const chartReadyData = data.filter(r => Number(r.total_score || 0) >= 50);
const chartReadyData = data;

allRounds = chartReadyData.map(r => Number(r.total_score || 0));

allRoundStats = chartReadyData.map(r => ({
  id: r.id || "",
  source: r.source || "V1",
  hasPlusStats: r.source === "P2",
  round_payload: r.round_payload || null,
  holes_json: r.holes_json || null,

  round_date: r.round_date || "",
  round_type: r.round_type || "",
  course_name: r.course_name || "",
  total_score: Number(r.total_score || 0),
  course_par: Number(r.course_par || 0),
  tee_yardage: Number(r.tee_yardage || 0),
  tee_rating: r.tee_rating || "",
  tee_slope: r.tee_slope || "",

  fir: Number(r.fir_pct || 0),
  gir: Number(r.gir_pct || 0),
  putts: Number(r.total_putts || 0),
  vsPar: Number(r.vs_par || 0)
}));

  updateSnapshot();
  updateTrendInsight();
  drawScoreTrendChart();
  renderStrengthLeakCard();
  renderBenchmarkStatus();
  positionBenchmarkArrow();
  
  renderCoachInsights(); 
}

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
    trendHeaderRange.textContent = `${rounds.length} Rounds`;
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

  el.innerHTML = `Coach read based on: <strong> ${currentSampleSize} rounds</strong>`;
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
const stats = getSampleStats();

chartPointRegions = [];
chartRoundStats = stats.slice();

if (!rounds.length) return;

  const parent = canvas.parentElement;
  const width = Math.max(320, parent.clientWidth - 8);
  const height = Math.max(220, parent.clientHeight - 8);

  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);

  const padding = { top: 28, right: 24, bottom: 60, left: 72 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

const validScores = rounds.filter(s => s > 0);

const minData = Math.min(...validScores);
const maxData = Math.max(...validScores);

// 🔥 Rounded + padded scale
const minScore = Math.floor(minData / 5) * 5 - 5;
const maxScore = Math.ceil(maxData / 5) * 5 + 5;

  ctx.strokeStyle = "#d8e6dd";
  ctx.lineWidth = 1;

const range = maxScore - minScore;

let yStep = 5;

if (range > 60) yStep = 10;
else if (range > 30) yStep = 5;
else if (range > 15) yStep = 2;
else yStep = 1;

for (let value = minScore; value <= maxScore; value += yStep) {
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
    chartPointRegions.push({
  index,
  x,
  y,
  hitRadius: 18
});

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
  ctx.fillText("Round", padding.left + chartWidth / 2, height - 18);

  ctx.save();
  ctx.translate(22, padding.top + chartHeight / 2);
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

window.addEventListener("load", async () => {
  initCoachDashboard();

  const scoreTrendCanvas = document.getElementById("scoreTrendChart");

  if (scoreTrendCanvas) {
    scoreTrendCanvas.addEventListener("click", handleScoreTrendChartTap);
  }

  await loadRoundsFromSupabase();
});

window.addEventListener("resize", () => {
  drawScoreTrendChart();
  positionBenchmarkArrow();
});

/* ========================================
   TOP BUTTON + MOBILE NAV HINT
======================================== */
(function () {
  const topBtn = document.getElementById("topBtn");
  const stickyNavWrap = document.getElementById("stickyNavWrap");

  function updateTopButton() {
    if (!topBtn) return;

    if (window.scrollY > 260) {
      topBtn.classList.add("show");
    } else {
      topBtn.classList.remove("show");
    }
  }

  function updateNavHint() {
    if (!stickyNavWrap || window.innerWidth > 700) {
      if (stickyNavWrap) stickyNavWrap.classList.remove("nav-hint-right");
      return;
    }

    const maxScrollLeft = stickyNavWrap.scrollWidth - stickyNavWrap.clientWidth;
    const hasOverflow = maxScrollLeft > 8;
    const nearEnd = stickyNavWrap.scrollLeft >= maxScrollLeft - 8;

    if (hasOverflow && !nearEnd) {
      stickyNavWrap.classList.add("nav-hint-right");
    } else {
      stickyNavWrap.classList.remove("nav-hint-right");
    }
  }

  if (topBtn) {
    topBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (stickyNavWrap) {
    stickyNavWrap.addEventListener("scroll", updateNavHint, { passive: true });
  }

  window.addEventListener("scroll", updateTopButton, { passive: true });
  window.addEventListener("resize", function () {
    updateTopButton();
    updateNavHint();
  });

  window.addEventListener("load", function () {
    updateTopButton();
    updateNavHint();
  });
})();

function handleScoreTrendChartTap(event) {
  const canvas = document.getElementById("scoreTrendChart");
  if (!canvas || !chartPointRegions.length) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  const hit = chartPointRegions.find(point => {
    const dx = clickX - point.x;
    const dy = clickY - point.y;
    return Math.sqrt(dx * dx + dy * dy) <= point.hitRadius;
  });

  if (!hit) return;

  const stat = chartRoundStats[hit.index];

openRoundSummaryModal(stat, hit.index + 1);
}


/* =========================================================
   ROUND SUMMARY POPUP (P2 DEV VERSION)

   Purpose:
   - Opens when a user clicks a point on the Score Trend Chart
   - Displays standard coach-facing round stats:
     Score, To Par, FIR, GIR, Putts

   Notes:
   - This is a simplified P2 version (safe dev environment)
   - Will be extended to include +Stats insights and coach reads
   - Does NOT affect V1 dashboard (coach.js remains untouched)

   Future:
   - Add P2 badge for +Stats rounds
   - Add "View +Stats Details" panel
   - Add coach-style interpretation (patterns, tendencies)

========================================================= */

function openRoundSummaryModal(stat, roundNumber) {
  if (!stat) return;

// Use the full Supabase row when available so +Stats can access round_payload.holes
selectedPlusStatsRound =
  (allFullRounds || []).find(r => String(r.id || "") === String(stat.id || "")) || stat;

  let modal = document.getElementById("roundSummaryModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "roundSummaryModal";
    document.body.appendChild(modal);
  }

  const score = Number(stat.total_score || 0);
  const fir = Number(stat.fir || 0);
  const gir = Number(stat.gir || 0);
  const putts = Number(stat.putts || 0);
  const vsPar = Number(stat.vsPar || 0);

  const vsParText =
    vsPar > 0 ? `+${vsPar}` :
    vsPar < 0 ? `${vsPar}` : "E";

  const sourceBadge = stat.source === "P2"
    ? `<span style="background:#1f7a3f;color:white;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;">P2 +Stats</span>`
    : `<span style="background:#e5e7eb;color:#333;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;">V1</span>`;

  modal.className = "";
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  `;

  modal.innerHTML = `
    <div style="
      background:white;
      color:#183427;
      width:min(480px,95vw);
      border-radius:16px;
      overflow:hidden;
      box-shadow:0 12px 30px rgba(0,0,0,0.35);
    ">
      <div style="
        background:#1f7a3f;
        color:white;
        padding:14px;
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        overflow-y:auto;
      ">
        <strong>Round ${roundNumber} Summary</strong>
        <button onclick="closeRoundSummaryModal()" style="
          background:white;
          color:#1f7a3f;
          border:none;
          border-radius:50%;
          width:30px;
          height:30px;
          font-size:18px;
          font-weight:700;
          cursor:pointer;
        ">×</button>
      </div>

      <div style="padding:16px;">
        <div style="margin-bottom:10px;">
          ${sourceBadge}
        </div>

        <div style="font-size:15px;color:#555;margin-bottom:4px;">
          ${stat.round_date || "Date not listed"} · ${stat.round_type || "Round"}
        </div>

        <div style="font-size:18px;font-weight:800;margin-bottom:12px;">
          ${stat.course_name || "Course not listed"}
        </div>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-bottom:14px;
        ">
          <div><strong>Score:</strong> ${score || "--"}</div>
          <div><strong>To Par:</strong> ${vsParText}</div>
          <div><strong>FIR:</strong> ${Math.round(fir)}%</div>
          <div><strong>GIR:</strong> ${Math.round(gir)}%</div>
          <div><strong>Putts:</strong> ${putts || "--"}</div>
          <div><strong>Yardage:</strong> ${stat.tee_yardage || "--"}</div>
        </div>

        <div style="
          padding:12px;
          border-radius:12px;
          background:#f4faf5;
          border:1px solid #d8eadc;
          font-size:14px;
          line-height:1.4;
          color:#2f473b;
        ">
          <strong>Coach Read:</strong><br>
          ${getSimpleRoundCoachRead(stat)}
        </div>

        ${stat.source === "P2" ? `
          <div style="text-align:center;margin-top:14px;">
           <button type="button" onclick="closeRoundSummaryModal(); openPlusStatsSimpleView()" style="
              padding:9px 14px;
              border-radius:999px;
              border:none;
              background:#111;
              color:white;
              font-weight:800;
              cursor:pointer;
            ">
              View +Stats Details
            </button>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function closeRoundSummaryModal() {
  const modal = document.getElementById("roundSummaryModal");
  if (modal) {
    modal.style.display = "none";
    modal.innerHTML = "";
  }
}


// 👇 PUT IT HERE
function getSimpleRoundCoachRead(stat) {
  const score = Number(stat.total_score || 0);
  const gir = Number(stat.gir || 0);
  const putts = Number(stat.putts || 0);

  let read = "";

  if (score && Number(stat.vsPar || 0) <= 2) {
    read += "Scoring held in a competitive range. ";
  } else {
    read += "This round leaves room to tighten scoring consistency. ";
  }

  if (gir >= 60) {
    read += "GIR suggests solid ball-striking and approach play. ";
  } else {
    read += "Approach play may be the first place to look for scoring improvement. ";
  }

  if (putts <= 31) {
    read += "Putting total supported the round.";
  } else {
    read += "Putting may have cost strokes relative to the scoring profile.";
  }

  return read;
}


// 👇 +Stats detail in point popups

function openPlusStatsSimpleView() {
  const stat = selectedPlusStatsRound;

  if (!stat) {
    alert("Could not find +Stats for this round.");
    return;
  }

  // Make sure the Round Summary popup is gone before opening +Stats Detail.
  // This prevents the double-dim background.
  const roundSummaryModal = document.getElementById("roundSummaryModal");
  if (roundSummaryModal) roundSummaryModal.remove();

  function parseMaybeJson(value) {
    if (!value) return null;

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (err) {
        return null;
      }
    }

    return value;
  }

  const payload =
    parseMaybeJson(stat.round_payload) ||
    parseMaybeJson(stat.roundPayload) ||
    parseMaybeJson(stat.payload) ||
    stat;

  function findHolesArray(obj) {
    if (!obj || typeof obj !== "object") return [];

    // Preferred P2 storage shape: round_payload.holes
    if (Array.isArray(obj.holes) && obj.holes.length) return obj.holes;

    // Alternate storage shape: holes_json
    if (Array.isArray(obj.holes_json) && obj.holes_json.length) return obj.holes_json;

    const parsedHolesJson = parseMaybeJson(obj.holes_json);
    if (Array.isArray(parsedHolesJson) && parsedHolesJson.length) return parsedHolesJson;

    // If the object itself is an array, decide whether it looks like hole data.
    if (Array.isArray(obj)) {
      const looksLikeHoles = obj.some(item =>
        item &&
        typeof item === "object" &&
        (
          "holeNumber" in item ||
          "hole" in item ||
          "teeShot" in item ||
          "tee_shot" in item ||
          "approach" in item ||
          "shortGame" in item ||
          "short_game" in item ||
          "putting" in item
        )
      );

      if (looksLikeHoles) return obj;

      for (const item of obj) {
        const found = findHolesArray(item);
        if (found.length) return found;
      }
    }

    for (const key of Object.keys(obj)) {
      const found = findHolesArray(obj[key]);
      if (found.length) return found;
    }

    return [];
  }

  const holes = findHolesArray(payload);

  console.log("PLUS STATS STAT:", stat);
  console.log("PLUS STATS PAYLOAD:", payload);
  console.log("FINAL +STATS HOLES USED:", holes);

  let detailHtml = "";

  if (!holes.length) {
    detailHtml = `
      <div style="padding:14px; color:#555;">
        No hole-by-hole +Stats were found for this P2 round yet.
      </div>
    `;
  } else {
    detailHtml = holes.map((hole, index) => {
      console.log("PLUS STATS HOLE:", hole);
      return `
        <div style="
          border:1px solid #d8eadc;
          border-radius:12px;
          padding:12px;
          margin-bottom:10px;
          background:#f9fcfa;
        ">
<div style="font-weight:800; margin-bottom:8px;">
  Hole ${hole.holeNumber || hole.hole || index + 1}
  ${hole.par ? ` • Par ${hole.par}` : ""}
  ${hole.yardage ? ` • ${hole.yardage} yds` : ""}
</div>   

          <div><strong>Tee Shot:</strong> ${formatPlusStatValue(getPlusStatField(hole, ["teeShot", "tee_shot", "tee", "teeStats", "teeShotStats", "drive", "driving"]))}</div>
          <div><strong>Approach:</strong> ${formatPlusStatValue(getPlusStatField(hole, ["approach", "approachShot", "approachStats", "approach_stat"]))}</div>
          <div><strong>Short Game:</strong> ${formatPlusStatValue(getPlusStatField(hole, ["shortGame", "short_game", "shortgame", "shortGameStats", "shortStats"]))}</div>
          <div><strong>Putting:</strong> ${formatPlusStatValue(getPlusStatField(hole, ["putting", "putts", "puttingStats", "puttStats"]))}</div>
          </div>
      `;
    }).join("");
  }

  const oldOverlay = document.getElementById("plusStatsDetailOverlay");
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement("div");
  overlay.id = "plusStatsDetailOverlay";
  overlay.style.cssText = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,0.62);
    z-index:100000;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:16px;
  `;

  overlay.innerHTML = `
    <div class="plus-stats-detail-box" style="
      background:white;
      background:white;
      color:#183427;
      width:min(620px,96vw);
      max-height:88vh;
      overflow-y:auto;
      border-radius:16px;
      box-shadow:0 14px 34px rgba(0,0,0,0.35);
    ">
      <div style="
        background:#1f7a3f;
        color:white;
        padding:14px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        position:sticky;
        top:0;
        z-index:20;
      ">
        <div style="line-height:1.15;">
  <div style="
    font-size:24px;
    font-weight:900;
    margin-bottom:8px;
    letter-spacing:-0.3px;
  ">
    +Stats Details
  </div>

  <div style="
    font-size:18px;
    font-weight:700;
    margin-bottom:2px;
  ">
    ${stat.round_type || "Round"} · ${stat.round_date || ""}
  </div>

  <div style="
    font-size:16px;
    font-weight:500;
    opacity:0.96;
  ">
    ${stat.course_name || "Course not listed"}
    ${stat.tee_rating ? ` (${stat.tee_rating}, ${stat.tee_slope}, ${stat.tee_yardage} yds)` : ""}
  </div>
</div>

        <button onclick="closePlusStatsSimpleView()" style="
          background:white;
          color:#1f7a3f;
          border:none;
          border-radius:50%;
          width:30px;
          height:30px;
          font-size:18px;
          font-weight:700;
          cursor:pointer;
        ">×</button>
      </div>

      <div style="padding:16px; position:relative; z-index:1;">
        <div style="
          padding:12px;
          border-radius:12px;
          background:#eef8f0;
          border:1px solid #cfe9d5;
          margin-bottom:14px;
          font-size:14px;
          line-height:1.4;
        ">
          <strong>Coach View:</strong><br>
<div style="
  max-height:120px;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  margin-top:6px;
  padding-right:6px;
">
  This round shows a player with a fairly mature understanding of course management and scoring control. 
  The overall scoring profile remained competitive throughout the round, and these Performance Stats suggest the player 
  was consistently giving himself opportunities rather than relying solely on recovery play. Tee-shot patterns 
  appeared generally playable, while approach dispersion showed a mix of aggressive scoring attempts and 
  manageable misses that kept momentum intact over the course of the round.
  <br><br>
  The additional shot-level detail is encouraging because it reflects a player who is tracking performance with 
  intention and consistency. Short-game entries and putting outcomes suggest the player avoided major score 
  inflation after missed greens and was able to stabilize holes effectively. From a coaching perspective, the round 
  indicates a player with a functional competitive foundation, while continued refinement in approach precision and 
  scoring conversion could meaningfully lower scores as consistency develops.
</div>

        ${detailHtml}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function closePlusStatsSimpleView() {
  const overlay = document.getElementById("plusStatsDetailOverlay");
  if (overlay) overlay.remove();
}


function getPlusStatField(hole, possibleNames) {
  if (!hole || typeof hole !== "object") return null;

  const normalize = value =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const wanted = possibleNames.map(normalize);

  function search(obj, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 4) return null;

    for (const [key, value] of Object.entries(obj)) {
      if (wanted.includes(normalize(key)) && value) {
        return value;
      }
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") {
        const found = search(value, depth + 1);
        if (found) return found;
      }
    }

    return null;
  }

  return search(hole);
}



function formatPlusStatValue(value) {
  if (!value) return "—";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value.distance && value.direction) {
    const direction = String(value.direction || "").trim();
    return `Shot Distance: ${value.distance} yds • Result: ${direction}`;
  }

  if (value.result && (value.distance || value.base)) {
    const holeDistance = value.base || value.distance;
    const shotDistance = value.distance || value.base;
    return `Hole Distance: ${holeDistance} yds • Result: ${shotDistance} yds, ${value.result}`;
  }

  if (value.lie || value.type || value.leave) {
    const parts = [];
    if (value.distance) parts.push(`Hole Distance: ${value.distance} yds`);
    if (value.lie) parts.push(`Lie: ${value.lie}`);
    if (value.type) parts.push(`Type: ${value.type}`);
    if (value.result) parts.push(`Result: ${value.result}`);
    if (value.leave) parts.push(`Leave: ${value.leave}`);
    return parts.join(" • ");
  }

  if (value.putts && Array.isArray(value.putts)) {
    const putts = value.putts.filter(p => p && (p.start || p.result));
    const count = putts.length || Number(value.activePutt || 0);

    const detail = putts.map((p, i) => {
      const start = p.start ? `${p.start} ft` : "";
      const result = p.result || "";
      return `Putt ${i + 1}: ${[start, result].filter(Boolean).join(", ")}`;
    }).join(" • ");

    return `Result: ${count} Putt${count === 1 ? "" : "s"}${detail ? " • " + detail : ""}`;
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([_, val]) => typeof val !== "object")
      .filter(([key]) => key !== "base")
      .map(([key, val]) => `${key}: ${val}`)
      .join(" • ");
  }

  return String(value);
}

/* ========================================
   COACH INSIGHTS — +STATS BASED
======================================== */

function renderCoachInsights() {
  const list = document.getElementById("coachInsightsList");
  if (!list) return;

  if (!allFullRounds || !allFullRounds.length) {
    list.innerHTML = "<li>No rounds available.</li>";
    return;
  }

  // ===== Collect all holes =====
  let allHoles = [];

  allFullRounds.forEach(round => {
let holes = [];

try {
  // ===== P2 format (preferred)
  if (round.round_payload && Array.isArray(round.round_payload.holes)) {
    holes = round.round_payload.holes;

  // ===== fallback: holes_json (older or alternate format)
  } else if (Array.isArray(round.holes_json)) {
    holes = round.holes_json;

  } else if (typeof round.holes_json === "string") {
    holes = JSON.parse(round.holes_json);
  }

} catch (err) {
  console.warn("Bad hole data", err);
}

    if (Array.isArray(holes)) {
      allHoles = allHoles.concat(holes);
    }
  });

  if (!allHoles.length) {
    list.innerHTML = "<li>No hole data found.</li>";
    return;
  }

console.log("FIRST HOLE:", allHoles[0]);
console.log("ALL HOLES SAMPLE:", allHoles.slice(0, 3));

console.log("FIRST P2 HOLE WITH +STATS:",
  allHoles.find(h =>
    h.teeShot ||
    h.approach ||
    h.shortGame ||
    h.putting ||
    h.tee_shot ||
    h.short_game
  )
);




  // ========================================
  // TEE SHOT DIRECTION (L / C / R)
  // ========================================
  const teeShots = allHoles.map(h => h.teeShot).filter(Boolean);

  const left = teeShots.filter(t => t.direction === "left").length;
  const center = teeShots.filter(t => t.direction === "center").length;
  const right = teeShots.filter(t => t.direction === "right").length;

  const totalTee = teeShots.length;

  const centerPct = totalTee ? Math.round((center / totalTee) * 100) : 0;

  // ========================================
  // APPROACH CONTROL
  // ========================================
  const approaches = allHoles.map(h => h.approach).filter(Boolean);

const pinHigh = approaches.filter(a =>
  String(a.result || "").toLowerCase().includes("pin high")
).length;

const short = approaches.filter(a =>
  String(a.result || "").toLowerCase().includes("short")
).length;

const long = approaches.filter(a =>
  String(a.result || "").toLowerCase().includes("long")
).length;

  const totalApproach = approaches.length;

  const pinHighPct = totalApproach ? Math.round((pinHigh / totalApproach) * 100) : 0;

  // ========================================
  // SHORT GAME QUALITY
  // ========================================
  const shortGames = allHoles.map(h => h.shortGame).filter(Boolean);

  const goodSG = shortGames.filter(s => {
    return (
      s.result === "holed" ||
      s.result === "inside-3ft" ||
      s.result === "inside-6ft"
    );
  }).length;

  const totalSG = shortGames.length;

  const sgPct = totalSG ? Math.round((goodSG / totalSG) * 100) : 0;

  // ========================================
  // PUTTING (basic read)
  // ========================================
  const putts = allHoles.map(h => h.putting).filter(Boolean);

  const totalPutts = putts.length;

  // ========================================
  // BUILD INSIGHTS
  // ========================================
  let insights = [];

  // Tee Shot Insight
  insights.push(`
    <li class="coach-insight-card">
      <strong>Tee Shot Direction</strong>
      <span>${centerPct}% of tee shots are finishing center. Left: ${left}, Right: ${right}. This shows directional control, not just FIR.</span>
    </li>
  `);

  // Approach Insight
  insights.push(`
    <li class="coach-insight-card">
      <strong>Approach Control</strong>
      <span>${pinHighPct}% of approaches are pin-high. Short: ${short}, Long: ${long}. Pin-high is a strong indicator of distance control.</span>
    </li>
  `);

  // Short Game Insight
  insights.push(`
    <li class="coach-insight-card">
      <strong>Short Game Conversion</strong>
      <span>${sgPct}% of short game shots finish inside 6ft or better. This shows how well missed greens are being saved.</span>
    </li>
  `);

  // Putting Insight
  insights.push(`
    <li class="coach-insight-card">
      <strong>Putting Sample</strong>
      <span>${totalPutts} putting entries tracked. This will evolve into make % and 3-putt avoidance as more data builds.</span>
    </li>
  `);

  // Render all
  list.innerHTML = insights.join("");
}

