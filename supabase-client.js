const SUPABASE_URL = "https://xncgytnnekaytqmypdqv.supabase.co";
const SUPABASE_KEY = "sb_publishable_UiLB55XsY_iD9m_wUNlSwA_UEjBa5fR";

const supabaseClientInstance = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

window.supabaseClient = supabaseClientInstance;

window.supabaseClient = supabaseClientInstance;

window.uploadCompletedRoundToSupabase = async function (round) {
  console.log("[SUPABASE UPLOAD] function started", round);

  if (!round || !window.supabaseClient) {
    console.error("Missing round or Supabase client");
    return { success: false, error: "Missing round or Supabase client" };
  }

  // Support both saved-round shapes:
  // - round.details
  // - round.roundDetails
  const details = round.details || round.roundDetails || {};

  // Support both standard holes array and missing holes fallback
  const roundHoles = Array.isArray(round.holes) ? round.holes : [];
  const savedHoles = roundHoles.filter(h => h && h.saved);

  const totalScore = savedHoles.reduce((sum, h) => {
    return sum + Number(h.score || 0);
  }, 0);

  const coursePar = Number(details.coursePar || 0);
  const vsPar = coursePar > 0 ? totalScore - coursePar : null;

  const totalPutts = savedHoles.reduce((sum, h) => {
    return sum + Number(h.putts || 0);
  }, 0);

  // FIR opportunities are par 4s and par 5s
  const firOpportunities = savedHoles.filter(h => Number(h.par || 0) >= 4);
  const firMade = firOpportunities.filter(h => h.fir === true).length;
  const firPct = firOpportunities.length > 0
    ? Number(((firMade / firOpportunities.length) * 100).toFixed(2))
    : null;

  const girMade = savedHoles.filter(h => h.gir === true).length;
  const girPct = savedHoles.length > 0
    ? Number(((girMade / savedHoles.length) * 100).toFixed(2))
    : null;

  const summary = {
    totalScore,
    vsPar,
    firPct,
    girPct,
    totalPutts
  };

  // Write normalized values back onto the round so round_payload is useful
  round.details = details;
  round.summary = summary;

  const row = {
    player_name: "Isaiah Gonzales",
    round_date: details.roundDate || null,
    round_type: details.roundType || null,

    course_name: details.courseName || null,
    course_par: details.coursePar ? Number(details.coursePar) : null,
    tee_yardage: details.teeYardage ? Number(details.teeYardage) : null,
    tee_rating: details.teeRating ? Number(details.teeRating) : null,
    tee_slope: details.teeSlope ? Number(details.teeSlope) : null,

    total_score: summary.totalScore || null,
    vs_par: summary.vsPar,
    fir_pct: summary.firPct,
    gir_pct: summary.girPct,
    total_putts: summary.totalPutts || null,

    is_test: round.is_test === true,
    uploaded_from_device: navigator.userAgent || "unknown",
    round_payload: round
  };

  console.log("[SUPABASE UPLOAD] row being inserted:", row);

  const { error } = await window.supabaseClient
    .from("completed_rounds")
    .insert([row]);

  console.log("[SUPABASE UPLOAD] insert finished, error:", error);

  if (error) {
    console.error("Supabase insert failed:", error);
    return { success: false, error: error.message };
  }

  console.log("Completed round uploaded to Supabase", row);
  return { success: true };
};