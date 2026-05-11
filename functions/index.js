const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getDatabase } = require("firebase-admin/database");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

admin.initializeApp({
  databaseURL: "https://daq-system-rig-default-rtdb.firebaseio.com"
});

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
    if (key === 'occupancy' || key === 'ultrasonic_occupancy') {
      results[key] = latest[key]; // Use instantaneous (latest) value
    } else {
      results[key] = Number((sums[key] / counts[key]).toFixed(2)); // Use average for others
    }
  }
  return results;
}

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
  const energy_5min_Wh = Number(((averagePower * (5 / 60))).toFixed(6));
  
  if (Object.keys(averages).length > 0) {
    await firestore.collection("reports_five_minute").add({
      ...averages,
      energy_5min_Wh: energy_5min_Wh,
      timestamp: timestamp,
      timeString: new Date(timestamp).toISOString(),
      logCount: logs.length
    });
    console.log(`Saved five-minute average from ${logs.length} logs.`);

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
