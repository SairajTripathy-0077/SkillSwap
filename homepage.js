import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, getDoc, doc, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Use your specific Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyAwZ7MACRLX0fW1l65q4xRo95iTGj7fDkw",
    authDomain: "login-page-75c91.firebaseapp.com",
    projectId: "login-page-75c91",
    storageBucket: "login-page-75c91.firebasestorage.app",
    messagingSenderId: "31726323937",
    appId: "1:31726323937:web:9ef8c5eb0a0aec6204cfa0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setLogLevel('Debug'); // Enable Firebase logging

// Get the app ID (project ID in this case) for the DB path
const appId = firebaseConfig.projectId || 'default-app-id';

/**
 * Creates a promise that resolves with the user's initial auth state.
 * This prevents redirecting before Firebase has checked the session.
 */
const getInitialUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Stop listening after the first state is confirmed
      resolve(user);
    }, reject);
  });
};

// --- Main logic to run on page load ---
(async () => {
  const user = await getInitialUser();

  if (user) {
    // The user is signed in.
    const userId = user.uid; 
    console.log("Homepage: User is logged in. Fetching data for UID:", userId);

    // --- Create a reference to the user's document using the correct path ---
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/profile/info`); 

    getDoc(docRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          // Document exists, get the data
          const userData = docSnap.data();
          
          // Populate the HTML elements
          const fNameEl = document.getElementById('loggedUserFName');
          const lNameEl = document.getElementById('loggedUserLName');
          const emailEl = document.getElementById('loggedUserEmail');
          const bioEl = document.getElementById('loggedUserBio'); // Get the new bio element

          if (fNameEl) fNameEl.innerText = userData.firstName || 'N/A';
          if (lNameEl) lNameEl.innerText = userData.lastName || 'N/A';
          if (emailEl) emailEl.innerText = userData.email || 'N/A';
          // --- Populate the bio field ---
          if (bioEl) bioEl.innerText = userData.bio || 'No bio set.'; 
            
        } else {
          console.error("Homepage: User is authenticated, but no matching profile document was found at:", docRef.path);
        }
      })
      .catch((error) => {
        console.error("Error getting document:", error);
      });

  } else {
    // User is signed out
    console.log("Homepage: User is not logged in. Redirecting to login page.");
    window.location.href = 'index.html'; 
  }
})(); // Immediately invoke the async function


// --- Logout Button Logic ---
const logoutButton = document.getElementById('logout');
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      signOut(auth)
        .then(() => {
          console.log("Sign-out successful.");
          // After sign out, redirect to index.html
          window.location.href = 'index.html'; 
        })
        .catch((error) => {
          console.error('Error Signing out:', error);
        });
    });
}

