import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDibshIxJuwPnb-m3J8_esJXHIzas3bE5U",
  authDomain: "daq-system-rig.firebaseapp.com",
  projectId: "daq-system-rig",
  storageBucket: "daq-system-rig.firebasestorage.app",
  messagingSenderId: "1071451471622",
  appId: "1:1071451471622:web:c89f63cb035592d23c2887",
  databaseURL: "https://daq-system-rig-default-rtdb.firebaseio.com"
};

console.log("Initializing app...");
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log("Connecting database...");
const connectedRef = ref(db, ".info/connected");
onValue(connectedRef, (snap) => {
  console.log("Connection status:", snap.val());
});

const liveRef = ref(db, "live_data");
onValue(liveRef, (snap) => {
  console.log("Database payload:", snap.val());
  process.exit(0);
}, (err) => {
  console.error("Database error:", err);
  process.exit(1);
});

setTimeout(() => {
  console.error("Timed out waiting for Firebase");
  process.exit(1);
}, 5000);
