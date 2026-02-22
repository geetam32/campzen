import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyAlmqhlkLawrRyaU8_lAntnwvACHbWSfM0",
  authDomain: "campus-net-cfc4a.firebaseapp.com",
  projectId: "campus-net-cfc4a",
  storageBucket: "campus-net-cfc4a.firebasestorage.app",
  messagingSenderId: "964009879504",
  appId: "1:964009879504:web:a7c66b32353f421eb3fbd5",
  measurementId: "G-LZCWR88T11"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence based on platform
const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });

const db = getFirestore(app);

export { app, db, auth };
