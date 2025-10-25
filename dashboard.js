import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    getDoc, 
    doc, 
    setLogLevel,
    collection,
    query,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
 * This prevents the "flicker" redirect bug.
 */
const getInitialUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Stop listening after the first state is confirmed
      resolve(user);
    }, reject);
  });
};

/**
 * Fetches the public user directory and renders it.
 */
function loadUserDirectory(currentUserId) {
    const userListContainer = document.getElementById('userListContainer');
    if (!userListContainer) return;

    // Path to the PUBLIC user directory
    const usersCollectionRef = collection(db, `artifacts/${appId}/public/data/user_directory`);
    const q = query(usersCollectionRef);

    onSnapshot(q, (snapshot) => {
        const users = [];
        snapshot.forEach((doc) => {
            // Add all users EXCEPT the current one
            if (doc.id !== currentUserId) {
                users.push({ id: doc.id, ...doc.data() });
            }
        });

        // Render the list
        if (users.length === 0) {
            userListContainer.innerHTML = `<p class="text-gray-500 col-span-full">No other users have joined yet.</p>`;
            return;
        }

        userListContainer.innerHTML = users.map(user => `
            <button data-userid="${user.id}" class="user-profile-button w-full text-left p-4 bg-white hover:bg-gray-50 rounded-lg shadow transition duration-150 flex items-center space-x-3">
                <i class="fas fa-user-circle text-gray-400 text-2xl"></i>
                <span class="font-medium text-lg text-primary-600">${user.firstName} ${user.lastName}</span>
            </button>
        `).join('');

        // Add click listeners to all the new buttons
        document.querySelectorAll('.user-profile-button').forEach(button => {
            button.addEventListener('click', () => {
                showUserProfile(button.dataset.userid);
            });
        });

    }, (error) => {
        console.error("Error listening for user directory:", error);
        userListContainer.innerHTML = `<p class="text-red-500 col-span-full">Could not load user list.</p>`;
    });
}

/**
 * Fetches a specific user's PRIVATE profile and shows it in the modal.
 */
async function showUserProfile(userId) {
    // 1. Get modal elements
    const modal = document.getElementById('userModal');
    const backdrop = document.getElementById('userModalBackdrop');
    const nameEl = document.getElementById('modalUserName');
    const emailEl = document.getElementById('modalUserEmail');
    const bioEl = document.getElementById('modalUserBio');

    // 1b. Show modal with loading state
    nameEl.innerText = "Loading...";
    emailEl.innerText = "Loading...";
    bioEl.innerText = "Loading...";
    backdrop.classList.remove('hidden');
    modal.classList.remove('hidden');

    // 2. Fetch the user's PRIVATE profile data
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/info`);
    try {
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            console.error("No profile data found for this user.");
            nameEl.innerText = "Error";
            bioEl.innerText = "Could not load user profile.";
            emailEl.innerText = "N/A";
            return;
        }
        
        const userData = userDoc.data();

        // 3. Populate modal
        nameEl.innerText = `${userData.firstName} ${userData.lastName}`;
        emailEl.innerText = userData.email;
        bioEl.innerText = userData.bio || "This user has not set a bio.";

    } catch (error) {
        console.error("Error fetching user profile:", error);
        nameEl.innerText = "Error";
        bioEl.innerText = "Could not load user profile.";
        emailEl.innerText = "N/A";
    }
}

/**
 * Sets up listeners to close the modal.
 */
function setupModalClose() {
    const modal = document.getElementById('userModal');
    const backdrop = document.getElementById('userModalBackdrop');
    const closeBtn = document.getElementById('closeUserModal');

    const closeModal = () => {
        backdrop.classList.add('hidden');
        modal.classList.add('hidden');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);
}


// --- Main logic to run on page load ---
(async () => {
  const user = await getInitialUser();

  if (user) {
    // The user is signed in.
    const userId = user.uid; 
    console.log("Dashboard: User is logged in. Fetching data for UID:", userId);

    // --- Create a reference to the user's document using the correct path ---
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/profile/info`); 

    getDoc(docRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const welcomeEl = document.getElementById('welcomeMessage');
          if (welcomeEl) {
             welcomeEl.innerText = `Welcome, ${userData.firstName || 'User'}!`;
          }
        } else {
          console.error("Dashboard: User is authenticated, but no matching profile document was found.");
          const welcomeEl = document.getElementById('welcomeMessage');
          if (welcomeEl) {
             welcomeEl.innerText = `Welcome! We couldn't find your profile.`;
          }
        }
      })
      .catch((error) => {
        console.error("Error getting document:", error);
      });
      
    // --- NEW: Load the user directory ---
    loadUserDirectory(userId);
    
    // --- NEW: Setup modal close buttons ---
    setupModalClose();


  } else {
    // User is signed out
    console.log("Dashboard: User is not logged in. Redirecting to login page.");
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

