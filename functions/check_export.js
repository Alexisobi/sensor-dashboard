const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "daq-system-rig",
});

async function check() {
  const db = getFirestore();
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const snapshot = await db.collection("reports_five_minute")
    .where('timestamp', '>=', startDate.getTime())
    .where('timestamp', '<=', endDate.getTime())
    .orderBy('timestamp', 'asc')
    .get();

  if (snapshot.empty) {
    console.log("No data found");
  } else {
    console.log(`Found ${snapshot.size} documents in reports_five_minute!`);
  }
  process.exit(0);
}

check().catch(console.error);
