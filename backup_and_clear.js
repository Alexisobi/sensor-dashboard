import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, remove } from "firebase/database";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from 'fs';

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
const firestoreDb = getFirestore(app);

const backupData = {
  firestore: {},
  rtdb: {}
};

async function backupAndClear() {
  console.log("Starting backup and clear process...");

  // 1. Backup and Clear RTDB
  console.log("Fetching RTDB telemetry data...");
  const telemetryRef = ref(db, 'telemetry');
  const snapshot = await get(telemetryRef);
  
  if (snapshot.exists()) {
    backupData.rtdb.telemetry = snapshot.val();
    console.log("Backed up RTDB telemetry data.");
    
    // Clear RTDB
    await remove(telemetryRef);
    console.log("Cleared RTDB telemetry data.");
  } else {
    console.log("No data found in RTDB telemetry.");
  }

  // 2. Backup and Clear Firestore
  const collectionsToClear = [
    'reports_five_minute',
    'reports_ten_minute', // including the old one just in case
    'reports_hourly',
    'reports_daily',
    'reports_weekly',
    'reports_monthly'
  ];

  for (const collectionName of collectionsToClear) {
    console.log(`Fetching Firestore collection: ${collectionName}...`);
    const colRef = collection(firestoreDb, collectionName);
    const colSnapshot = await getDocs(colRef);
    
    if (!colSnapshot.empty) {
      backupData.firestore[collectionName] = [];
      const deletePromises = [];
      
      colSnapshot.forEach((document) => {
        backupData.firestore[collectionName].push({ id: document.id, ...document.data() });
        deletePromises.push(deleteDoc(doc(firestoreDb, collectionName, document.id)));
      });
      
      console.log(`Backed up ${colSnapshot.size} documents from ${collectionName}.`);
      
      // Clear Firestore Collection
      await Promise.all(deletePromises);
      console.log(`Cleared collection ${collectionName}.`);
    } else {
      console.log(`Collection ${collectionName} is empty.`);
    }
  }

  // 3. Write backup to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `firebase_backup_${timestamp}.json`;
  fs.writeFileSync(backupFilename, JSON.stringify(backupData, null, 2));
  
  console.log(`\n🎉 Process complete!`);
  console.log(`Backup saved to: ${backupFilename}`);
  
  process.exit(0);
}

backupAndClear().catch(err => {
  console.error("Error during backup and clear:", err);
  process.exit(1);
});
