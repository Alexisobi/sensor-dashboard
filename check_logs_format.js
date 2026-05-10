import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDibshIxJuwPnb-m3J8_esJXHIzas3bE5U",
  authDomain: "daq-system-rig.firebaseapp.com",
  projectId: "daq-system-rig",
  storageBucket: "daq-system-rig.firebasestorage.app",
  messagingSenderId: "1071451471622",
  appId: "1:1071451471622:web:c89f63cb035592d23c2887",
  databaseURL: "https://daq-system-rig-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function check() {
  const telemetryLogsRef = ref(db, "telemetry/logs");
  const logsSnap = await get(telemetryLogsRef);
  const data = logsSnap.val();
  if (data) {
    console.log("Sample log:", Object.values(data)[0]);
  } else {
    console.log("No data");
  }
  process.exit(0);
}

check().catch(console.error);
