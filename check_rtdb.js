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
  const liveRef = ref(db, "live_data");
  const telemetryLogsRef = ref(db, "telemetry/logs");

  const liveSnap = await get(liveRef);
  console.log("live_data:", liveSnap.val());

  const logsSnap = await get(telemetryLogsRef);
  const logsData = logsSnap.val();
  console.log("telemetry/logs count:", logsData ? Object.keys(logsData).length : 0);
  process.exit(0);
}

check().catch(console.error);
