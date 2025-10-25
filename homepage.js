import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// WARNING: Your API key is visible here.
// For a real project, restrict your key in the Google Cloud Console.
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
const auth = getAuth();
const db = getFirestore();

// Listen for authentication state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    // --- THIS IS THE FIX ---
    // The user is signed in.
    // Use user.uid (the official auth ID) to get their document.
    const userId = user.uid; 
    console.log("User is logged in. Fetching data for UID:", userId);

    // Create a reference to the user's document in Firestore
    const docRef = doc(db, "users", userId); 

    getDoc(docRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          // Document exists, get the data
          const userData = docSnap.data();
          
          // Populate the HTML elements
          document.getElementById('loggedUserFName').innerText = userData.firstName;
          document.getElementById('loggedUserEmail').innerText = userData.email;
          document.getElementById('loggedUserLName').innerText = userData.lastName;
            
        } else {
          // This is a common error!
          // It means the user is authenticated, but you never created
          // their document in the 'users' collection in Firestore.
          console.error("User is authenticated, but no matching document was found in Firestore for UID:", userId);
          console.error("Check your sign-up code to make sure you are creating the user document.");
        }
      })
      .catch((error) => {
        console.error("Error getting document:", error);
      });

  } else {
    // User is signed out
    console.log("User is not logged in. Redirecting to login page.");
    // Automatically redirect to the login page
    window.location.href = 'index.html'; 
  }
});

// --- Logout Button Logic ---

const logoutButton = document.getElementById('logout');

logoutButton.addEventListener('click', () => {
  // You don't need to manually manage localStorage for auth
  
  signOut(auth)
    .then(() => {
      // Sign-out successful.
      // The onAuthStateChanged listener above will automatically
      // detect the sign-out and redirect to index.html.
      console.log("Sign-out successful.");
    })
    .catch((error) => {
      console.error('Error Signing out:', error);
    });
});