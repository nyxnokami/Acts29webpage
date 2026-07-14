// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDKz4jH6u5Y8nO2RAT-_EMNFlpDiOjl1HE",
  authDomain: "acts29-bbce3.firebaseapp.com",
  projectId: "acts29-bbce3",
  storageBucket: "acts29-bbce3.firebasestorage.app",
  messagingSenderId: "643156121924",
  appId: "1:643156121924:web:2c313758d684ba778bdf11",
  measurementId: "G-G99DH6T1CN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); 

export const db = getFirestore(app);
