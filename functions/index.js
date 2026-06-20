const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDatabase } = require("firebase-admin/database");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp({
  databaseURL: "https://daq-system-rig-default-rtdb.firebaseio.com"
});

// ============================
// CONSTANTS
// ============================
const RATE_NGN_PER_KWH = 2300; // ₦2,300 per kWh (0.1 kWh = ₦230)
const LOW_CREDIT_THRESHOLD = 5; // kWh

// ============================
// HELPER: Generate secure token string
// ============================
function generateTokenString() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 to avoid confusion
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let segment = "";
    for (let i = 0; i < 4; i++) {
      const randomByte = crypto.randomBytes(1)[0];
      segment += chars[randomByte % chars.length];
    }
    segments.push(segment);
  }
  return `SDASH-${segments.join("-")}`;
}

// ============================
// HELPER: Generate receipt ID
// ============================
function generateReceiptId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RCT-${timestamp}-${random}`;
}

/**
 * Helper to compute averages from an array of objects
 */
function computeAverage(dataArray) {
  if (!dataArray || dataArray.length === 0) return {};

  const sums = {};
  const counts = {};
  const latest = {};

  for (const item of dataArray) {
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'number' && key !== 'timestamp' && key !== 'last_seen') {
        sums[key] = (sums[key] || 0) + value;
        counts[key] = (counts[key] || 0) + 1;
        latest[key] = value;
      }
    }
  }

  const results = {};
  for (const key in sums) {
    if (['occupancy', 'ultrasonic_occupancy', 'battery_soc', 'soc', 'battery_voltage', 'current_amps', 'load_watts'].includes(key)) {
      results[key] = latest[key]; // Use instantaneous (latest) value
    } else {
      results[key] = Number((sums[key] / counts[key]).toFixed(2)); // Use average for others
    }
  }
  return results;
}

// ============================
// BILLING: Generate Token (called from Admin Panel)
// ============================
exports.generateToken = onCall(async (request) => {
  const { amount_ngn, username } = request.data;

  // Validate inputs
  if (!amount_ngn || typeof amount_ngn !== "number" || amount_ngn <= 0) {
    throw new HttpsError("invalid-argument", "Amount in Naira must be a positive number.");
  }
  if (!username || typeof username !== "string") {
    throw new HttpsError("invalid-argument", "Username is required.");
  }

  // Validate minimum purchase (at least 0.1 kWh = ₦230)
  if (amount_ngn < 230) {
    throw new HttpsError("invalid-argument", "Minimum purchase is ₦230 (0.1 kWh).");
  }

  const firestore = getFirestore();
  const rtdb = getDatabase();

  // Verify user exists
  const userDoc = await firestore.collection("users").doc(username).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  // Convert Naira to kWh
  const kwh_value = Number((amount_ngn / RATE_NGN_PER_KWH).toFixed(4));

  // Read current accumulated energy from RTDB as baseline snapshot
  const liveSnapshot = await rtdb.ref("telemetry/live/energy").once("value");
  const baseline_energy = liveSnapshot.val() || 0;

  // Generate secure token
  const token = generateTokenString();
  const receipt_id = generateReceiptId();
  const timestamp = Date.now();

  // Write to energy_tokens collection
  await firestore.collection("energy_tokens").add({
    token: token,
    kwh_value: kwh_value,
    amount_ngn: amount_ngn,
    status: "active",
    username: username,
    generated_at: timestamp,
    used_at: null
  });

  // Write to billing_transactions collection
  await firestore.collection("billing_transactions").add({
    token: token,
    username: username,
    kwh_value: kwh_value,
    amount_ngn: amount_ngn,
    baseline_energy_at_purchase: baseline_energy,
    timestamp: timestamp,
    receipt_id: receipt_id
  });

  console.log(`Token generated for ${username}: ${token} (${kwh_value} kWh / ₦${amount_ngn})`);

  return {
    token,
    kwh_value,
    amount_ngn,
    receipt_id,
    baseline_energy,
    timestamp,
    username
  };
});

// ============================
// BILLING: Redeem Token (called from Dashboard)
// ============================
exports.redeemToken = onCall(async (request) => {
  const { token, username } = request.data;

  if (!token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "Token is required.");
  }
  if (!username || typeof username !== "string") {
    throw new HttpsError("invalid-argument", "Username is required.");
  }

  const firestore = getFirestore();
  const rtdb = getDatabase();

  // Find the token
  const tokenQuery = await firestore.collection("energy_tokens")
    .where("token", "==", token.trim().toUpperCase())
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (tokenQuery.empty) {
    throw new HttpsError("not-found", "Token is invalid, already used, or expired.");
  }

  const tokenDoc = tokenQuery.docs[0];
  const tokenData = tokenDoc.data();

  // Verify token belongs to this user
  if (tokenData.username !== username) {
    throw new HttpsError("permission-denied", "This token was not issued for your account.");
  }

  // Read current accumulated energy from RTDB
  const liveSnapshot = await rtdb.ref("telemetry/live/energy").once("value");
  const current_accumulated_energy = liveSnapshot.val() || 0;

  // Get or create energy_state for this user
  const energyStateRef = firestore.collection("energy_state").doc(username);
  const energyStateDoc = await energyStateRef.get();

  let total_available_credit = tokenData.kwh_value;
  let baseline_energy = current_accumulated_energy;

  if (energyStateDoc.exists) {
    const currentState = energyStateDoc.data();
    // Calculate how much credit remains from previous state
    const energy_consumed = current_accumulated_energy - (currentState.baseline_energy || 0);
    const remaining_credit = Math.max(0, (currentState.total_available_credit || 0) - energy_consumed);
    // Add new token value to remaining credit
    total_available_credit = Number((remaining_credit + tokenData.kwh_value).toFixed(4));
    baseline_energy = current_accumulated_energy;
  }

  // Update energy_state
  await energyStateRef.set({
    username: username,
    total_available_credit: total_available_credit,
    baseline_energy: baseline_energy,
    last_token_redeemed_at: Date.now(),
    updated_at: Date.now()
  });

  // Mark token as used
  await tokenDoc.ref.update({
    status: "used",
    used_at: Date.now()
  });

  // Since we just loaded credit, ensure relay is ON (write 1 = ON)
  await rtdb.ref("control/relay_cutoff").set(1);

  console.log(`Token redeemed by ${username}: ${token} (+${tokenData.kwh_value} kWh, total: ${total_available_credit} kWh)`);

  return {
    success: true,
    new_credit: total_available_credit,
    baseline_energy: baseline_energy,
    kwh_added: tokenData.kwh_value
  };
});

// ============================
// BILLING: Credit Monitor (runs every minute to check relay cutoff)
// ============================
exports.checkCreditAndRelay = onSchedule("* * * * *", async (event) => {
  const firestore = getFirestore();
  const rtdb = getDatabase();

  // Get current accumulated energy
  const liveSnapshot = await rtdb.ref("telemetry/live/energy").once("value");
  const current_energy = liveSnapshot.val() || 0;

  // Get all energy states
  const statesSnapshot = await firestore.collection("energy_state").get();

  if (statesSnapshot.empty) return;

  for (const doc of statesSnapshot.docs) {
    const state = doc.data();
    const energy_consumed = current_energy - (state.baseline_energy || 0);
    const remaining_credit = state.total_available_credit - energy_consumed;

    if (remaining_credit <= 0) {
      // Credit depleted — trigger relay cutoff (0 = OFF)
      await rtdb.ref("control/relay_cutoff").set(0);
      console.log(`CREDIT DEPLETED for ${state.username}. Relay cutoff triggered (0=OFF). Remaining: ${remaining_credit.toFixed(4)} kWh`);
    } else if (remaining_credit <= LOW_CREDIT_THRESHOLD) {
      console.log(`LOW CREDIT WARNING for ${state.username}. Remaining: ${remaining_credit.toFixed(4)} kWh`);
    }
  }
});


// ============================
// AGGREGATION FUNCTIONS (existing)
// ============================

/**
 * Helper: ESP32 UART sends some fields as strings like "29.1 V" or "100.0 %"
 */
const parseNumeric = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const match = val.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }
  return 0;
};

/**
 * 1. Five-Minute Aggregation
 * Runs every 5 minutes.
 */
exports.aggregateFiveMinute = onSchedule("*/5 * * * *", async (event) => {
  const db = getDatabase();
  const firestore = getFirestore();
  const rawLogsRef = db.ref("telemetry/logs");

  console.log("aggregateFiveMinute started. Fetching raw logs...");
  const snapshot = await rawLogsRef.once("value");
  const data = snapshot.val();
  console.log(`Fetched raw logs. Has data? ${!!data}`);

  if (!data) {
    console.log("No raw logs to aggregate.");
    return;
  }

  const logs = [];
  const keysToDelete = [];

  for (const [key, value] of Object.entries(data)) {
    logs.push(value);
    keysToDelete.push(key);
  }

  const averages = computeAverage(logs);
  const timestamp = Date.now();

  // Calculate 5-minute energy (Wh) from average power (Watts)
  const averagePower = averages.power || averages.load_watts || 0;
  const energy_5min_Wh = Number(((averagePower * (5 / 60))).toFixed(3));

  // Fetch latest battery/inverter data from telemetry/live
  const liveSnapshot = await db.ref("telemetry/live").once("value");
  const liveData = liveSnapshot.val() || {};
  const batteryFields = {
    battery_soc: parseNumeric(liveData.soc),
    battery_voltage: parseNumeric(liveData.battery_voltage),
  };
  console.log(`Fetched live battery data: SOC=${batteryFields.battery_soc}, Voltage=${batteryFields.battery_voltage}`);
  
  if (Object.keys(averages).length > 0) {
    await firestore.collection("reports_five_minute").add({
      ...averages,
      ...batteryFields,
      energy_5min_Wh: energy_5min_Wh,
      timestamp: timestamp,
      timeString: new Date(timestamp).toISOString(),
      logCount: logs.length
    });
    console.log(`Saved five-minute average from ${logs.length} logs (with live battery data).`);

    // Delete processed logs from RTDB to prevent lag
    const updates = {};
    for (const key of keysToDelete) {
      updates[key] = null;
    }
    await rawLogsRef.update(updates);
    console.log("Cleared processed logs from RTDB.");
  }
});

/**
 * 2. Hourly Aggregation
 * Runs at minute 0 past every hour.
 */
exports.aggregateHourly = onSchedule("0 * * * *", async (event) => {
  const firestore = getFirestore();
  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  const snapshot = await firestore.collection("reports_five_minute")
    .where("timestamp", ">=", oneHourAgo)
    .get();

  if (snapshot.empty) return;

  const logs = [];
  snapshot.forEach(doc => logs.push(doc.data()));

  const averages = computeAverage(logs);
  const timestamp = Date.now();

  if (Object.keys(averages).length > 0) {
    await firestore.collection("reports_hourly").add({
      ...averages,
      timestamp: timestamp,
      timeString: new Date(timestamp).toISOString(),
      logCount: logs.length
    });
    console.log(`Saved hourly average from ${logs.length} five-minute logs.`);
  }
});

/**
 * 2. Daily Aggregation
 * Runs at 00:00 every day.
 */
exports.aggregateDaily = onSchedule("0 0 * * *", async (event) => {
  const firestore = getFirestore();
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

  const snapshot = await firestore.collection("reports_hourly")
    .where("timestamp", ">=", oneDayAgo)
    .get();

  if (snapshot.empty) return;

  const logs = [];
  snapshot.forEach(doc => logs.push(doc.data()));

  const averages = computeAverage(logs);
  const timestamp = Date.now();

  if (Object.keys(averages).length > 0) {
    await firestore.collection("reports_daily").add({
      ...averages,
      timestamp: timestamp,
      timeString: new Date(timestamp).toISOString(),
      logCount: logs.length
    });
    console.log(`Saved daily average from ${logs.length} hourly logs.`);
  }
});

/**
 * 3. Weekly Aggregation
 * Runs at 00:00 on Sunday.
 */
exports.aggregateWeekly = onSchedule("0 0 * * 0", async (event) => {
  const firestore = getFirestore();
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  const snapshot = await firestore.collection("reports_daily")
    .where("timestamp", ">=", oneWeekAgo)
    .get();

  if (snapshot.empty) return;

  const logs = [];
  snapshot.forEach(doc => logs.push(doc.data()));

  const averages = computeAverage(logs);
  const timestamp = Date.now();

  if (Object.keys(averages).length > 0) {
    await firestore.collection("reports_weekly").add({
      ...averages,
      timestamp: timestamp,
      timeString: new Date(timestamp).toISOString(),
      logCount: logs.length
    });
  }
});

/**
 * 4. Monthly Aggregation
 * Runs at 00:00 on day-of-month 1.
 */
exports.aggregateMonthly = onSchedule("0 0 1 * *", async (event) => {
  const firestore = getFirestore();
  const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); // Approx 30 days

  const snapshot = await firestore.collection("reports_daily")
    .where("timestamp", ">=", oneMonthAgo)
    .get();

  if (snapshot.empty) return;

  const logs = [];
  snapshot.forEach(doc => logs.push(doc.data()));

  const averages = computeAverage(logs);
  const timestamp = Date.now();

  if (Object.keys(averages).length > 0) {
    await firestore.collection("reports_monthly").add({
      ...averages,
      timestamp: timestamp,
      timeString: new Date(timestamp).toISOString(),
      logCount: logs.length
    });
  }
});
