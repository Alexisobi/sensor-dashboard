const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "daq-system-rig",
  databaseURL: "https://daq-system-rig-default-rtdb.firebaseio.com"
});

const firestore = admin.firestore();

async function check() {
  // Check latest 5 reports_five_minute docs
  console.log("=== Latest 5 reports_five_minute documents ===\n");
  const fiveMinSnap = await firestore.collection("reports_five_minute")
    .orderBy("timestamp", "desc")
    .limit(5)
    .get();

  fiveMinSnap.forEach(doc => {
    const d = doc.data();
    console.log(`  ID: ${doc.id}`);
    console.log(`  Time: ${d.timeString}`);
    console.log(`  Power: ${d.power || 'N/A'}W`);
    console.log(`  energy_5min_kWh: ${d.energy_5min_kWh !== undefined ? d.energy_5min_kWh : 'MISSING'}`);
    console.log(`  Accumulated Energy: ${d.energy || 'N/A'} kWh`);
    console.log(`  Log Count: ${d.logCount}`);
    console.log('---');
  });

  // Check all reports_daily docs
  console.log("\n=== All reports_daily documents ===\n");
  const dailySnap = await firestore.collection("reports_daily")
    .orderBy("timestamp", "desc")
    .get();

  console.log(`  Total documents: ${dailySnap.size}`);
  dailySnap.forEach(doc => {
    const d = doc.data();
    console.log(`  ID: ${doc.id} | Time: ${d.timeString} | LogCount: ${d.logCount}`);
  });

  // Check all reports_hourly docs
  console.log("\n=== All reports_hourly documents ===\n");
  const hourlySnap = await firestore.collection("reports_hourly")
    .orderBy("timestamp", "desc")
    .get();

  console.log(`  Total documents: ${hourlySnap.size}`);
  hourlySnap.forEach(doc => {
    const d = doc.data();
    console.log(`  ID: ${doc.id} | Time: ${d.timeString} | LogCount: ${d.logCount}`);
  });

  process.exit(0);
}

check().catch(err => { console.error(err); process.exit(1); });
