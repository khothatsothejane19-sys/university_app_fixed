// firebase-config.js

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtXP3V07tdONcboYjlkcke0I6nDxZyb34",
  authDomain: "uniapply-39179.firebaseapp.com",
  projectId: "uniapply-39179",
  storageBucket: "uniapply-39179.firebasestorage.app",
  messagingSenderId: "346861064515",
  appId: "1:346861064515:web:ffe59363b3c1b9380d1ff6"
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);