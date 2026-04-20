/**
 * Supabase client and query helpers for Muhannad's schema.
 * All queries use the service role key (server-side only).
 * User identity is based on profiles.id (UUID), not email.
 */
import { createClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

// Singleton Supabase client with service role key (bypasses RLS)
export function getSupabase() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
    throw new Error("Supabase credentials not configured");
  }
  return createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

/** Get a profile by email (used to link our auth user to Supabase UUID)
 * NOTE: profiles table has no email column — we match by full_name as fallback.
 * The supabaseId is stored in the JWT after first login.
 */
export async function getProfileByEmail(_email: string) {
  // profiles table has no email column — return null, supabaseId lookup happens via getProfileById
  return null;
}

/** Get a profile by UUID */
export async function getProfileById(id: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, role, coins_balance")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

/** Get all profiles (admin) */
export async function getAllProfiles() {
  const sb = getSupabase();
  // NOTE: profiles table has no email column
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, role, coins_balance, calendly_url")
    .order("full_name");
  if (error) return [];
  return data ?? [];
}

/** Get all therapist profiles with calendly_url */
export async function getTherapeutProfiles() {
  const sb = getSupabase();
  // NOTE: profiles table has no email column
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, calendly_url")
    .eq("role", "therapeut")
    .order("full_name");
  if (error) return [];
  return data ?? [];
}

// ─── Coin helpers ─────────────────────────────────────────────────────────────

/** Get coin transaction history for a user */
export async function getCoinTransactions(userId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("coin_transactions")
    .select("id, amount, reason, reference_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return data ?? [];
}

/** Insert a coin transaction (admin manual adjustment) */
export async function insertCoinTransaction(
  userId: string,
  amount: number,
  reason: string,
  referenceType: string = "manual"
) {
  const sb = getSupabase();
  const { error } = await sb.from("coin_transactions").insert({
    user_id: userId,
    amount,
    reason,
    reference_type: referenceType,
  });
  if (error) throw new Error(error.message);
  // Update coins_balance in profiles
  const { data: profile } = await sb
    .from("profiles")
    .select("coins_balance")
    .eq("id", userId)
    .single();
  const newBalance = (profile?.coins_balance ?? 0) + amount;
  await sb.from("profiles").update({ coins_balance: newBalance }).eq("id", userId);
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/** Get sessions for a patient */
export async function getPatientSessions(patientId: string) {
  const sb = getSupabase();
  // Muhannad: ratings kommen jetzt aus reviews, nicht aus sessions.rating
  // scheduled_at existiert nicht in der DB — nur created_at
  const { data, error } = await sb
    .from("sessions")
    .select("id, therapeut_id, status, created_at, profiles!sessions_therapeut_id_fkey(full_name), reviews(rating, comment)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

/** Get sessions for a therapeut */
export async function getTherapeutSessions(therapeutId: string) {
  const sb = getSupabase();
  // Muhannad: ratings kommen jetzt aus reviews, nicht aus sessions.rating
  // scheduled_at existiert nicht in der DB — nur created_at
  const { data, error } = await sb
    .from("sessions")
    .select("id, patient_id, status, created_at, profiles!sessions_patient_id_fkey(full_name), reviews(rating, comment)")
    .eq("therapeut_id", therapeutId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

/** Mark a session as done */
export async function markSessionDone(sessionId: string, therapeutId: string) {
  const sb = getSupabase();
  const { error } = await sb
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", sessionId)
    .eq("therapeut_id", therapeutId);
  if (error) throw new Error(error.message);
}

/** Book a new session (deducts 7 coins) */
export async function bookSession(patientId: string, therapeutId: string) {
  const sb = getSupabase();
  // Check coin balance
  const { data: profile } = await sb
    .from("profiles")
    .select("coins_balance")
    .eq("id", patientId)
    .single();
  if (!profile || profile.coins_balance < 7) {
    throw new Error("Nicht genug Coins (mindestens 7 erforderlich)");
  }
  // Create session
  const { data: session, error: sessionError } = await sb
    .from("sessions")
    // Muhannad: neuer Session-Status ist 'scheduled', nicht 'pending'
    .insert({ patient_id: patientId, therapeut_id: therapeutId, status: "scheduled" })
    .select("id")
    .single();
  if (sessionError) throw new Error(sessionError.message);
  // Deduct coins
  await insertCoinTransaction(patientId, -7, "Therapiesitzung gebucht", "session");
  return session;
}

// ─── Referral helpers ─────────────────────────────────────────────────────────

/** Get referrals sent by a user */
export async function getUserReferrals(userId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("referrals")
    .select("id, referral_token, status, created_at, profiles!referrals_referred_user_id_fkey(full_name)")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

/** Generate a referral token for a user */
export async function createReferral(referrerId: string) {
  const sb = getSupabase();
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  const { data, error } = await sb
    .from("referrals")
    .insert({ referrer_id: referrerId, referral_token: token, status: "invited" })
    .select("referral_token")
    .single();
  if (error) throw new Error(error.message);
  return data.referral_token;
}

// ─── Review helpers ───────────────────────────────────────────────────────────

/** Submit a review for a session */
export async function submitReview(
  sessionId: string,
  patientId: string,
  therapistId: string,
  rating: number,
  comment?: string
) {
  const sb = getSupabase();
  const { error } = await sb.from("reviews").insert({
    session_id: sessionId,
    patient_id: patientId,
    therapist_id: therapistId,
    rating,
    comment: comment ?? "",
  });
  if (error) throw new Error(error.message);
  // Award coins for rating
  await insertCoinTransaction(patientId, 20, "Bewertung abgegeben", "review");
}

/** Get reviews for a therapist */
export async function getTherapistReviews(therapistId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reviews")
    .select("id, rating, comment, created_at, profiles!reviews_patient_id_fkey(full_name)")
    .eq("therapist_id", therapistId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

// ─── Billing helpers ──────────────────────────────────────────────────────────

/** Get all billing requests (admin) */
export async function getAllBillingRequests() {
  const sb = getSupabase();
  // Fix Bug #4: Spalte heißt 'submitted_at' (nicht 'created_at'), FK-Hint für therapeut_id
  const { data, error } = await sb
    .from("billing_requests")
    .select("id, session_id, therapeut_id, amount, status, reviewed_by, reviewed_at, submitted_at, profiles!billing_requests_therapeut_id_fkey(full_name)")
    .order("submitted_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

/** Update billing request status (admin) */
export async function updateBillingStatus(
  requestId: string,
  status: "approved" | "rejected" | "paid",
  reviewedBy: string
) {
  const sb = getSupabase();
  const { error } = await sb
    .from("billing_requests")
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw new Error(error.message);
}

// ─── Stats helper ─────────────────────────────────────────────────────────────

/** Get aggregate stats for admin dashboard */
export async function getAdminStats() {
  const sb = getSupabase();
  const [profilesRes, sessionsRes, billingRes] = await Promise.all([
    sb.from("profiles").select("id, role, coins_balance"),
    sb.from("sessions").select("id, status"),
    sb.from("billing_requests").select("id, status, amount"),
  ]);
  const profiles = profilesRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const billing = billingRes.data ?? [];
  return {
    totalUsers: profiles.length,
    totalPatients: profiles.filter((p) => p.role === "patient").length,
    totalTherapists: profiles.filter((p) => p.role === "therapeut").length,
    totalCoins: profiles.reduce((sum, p) => sum + (p.coins_balance ?? 0), 0),
    // Status in der DB ist 'scheduled', nicht 'pending' — Fix Bug #3
    openSessions: sessions.filter((s) => s.status === "scheduled").length,
    completedSessions: sessions.filter((s) => s.status === "completed").length,
    pendingBilling: billing.filter((b) => b.status === "pending").length,
    totalBillingAmount: billing
      .filter((b) => b.status === "paid")
      .reduce((sum, b) => sum + (b.amount ?? 0), 0),
  };
}
