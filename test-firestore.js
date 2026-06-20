import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));

if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

async function check() {
  try {
    const docSnap = await db.collection('system').doc('config').get();
    if (docSnap.exists) {
      console.log("Firestore system/config:", JSON.stringify(docSnap.data(), null, 2));
    } else {
      console.log("Firestore system/config does not exist!");
    }
  } catch (err) {
    console.error("Error reading Firestore:", err);
  }
  process.exit();
}

check();
