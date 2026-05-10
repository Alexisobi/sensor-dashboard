const { getDatabase } = require("firebase-admin/database");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

admin.initializeApp({
  databaseURL: "https://daq-system-rig-default-rtdb.firebaseio.com",
  projectId: "daq-system-rig",
});

function computeAverage(dataArray) {
  if (!dataArray || dataArray.length === 0) return {};
  
  const sums = {};
  const counts = {};
  
  for (const item of dataArray) {
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'number' && key !== 'timestamp' && key !== 'last_seen') {
        sums[key] = (sums[key] || 0) + value;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }
  
  const averages = {};
  for (const key in sums) {
    averages[key] = Number((sums[key] / counts[key]).toFixed(2));
  }
  return averages;
}

async function run() {
  console.log("Connecting database...");
  const db = getDatabase();
  const firestore = getFirestore();
  const rawLogsRef = db.ref("telemetry/logs");
  
  const snapshot = await rawLogsRef.once("value");
  const data = snapshot.val();
  
  if (!data) {
    console.log("No raw logs to aggregate.");
    return;
  }
  
  console.log("Found logs:", Object.keys(data).length);
  
  const logs = [];
  const keysToDelete = [];
  
  for (const [key, value] of Object.entries(data)) {
    logs.push(value);
    keysToDelete.push(key);
  }
  
  const averages = computeAverage(logs);
  console.log("Averages:", averages);
  process.exit(0);
}

run().catch(console.error);
