const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "daq-system-rig",
});

async function check() {
  const db = getFirestore();
  const snapshot = await db.collection("reports_five_minute").limit(5).get();
  if (snapshot.empty) {
    console.log("No documents in reports_five_minute");
  } else {
    console.log(`Found documents in reports_five_minute: ${snapshot.size}`);
    snapshot.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  }
  process.exit(0);
}

check().catch(console.error);
