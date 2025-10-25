import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    getDoc, 
    doc, 
    setLogLevel, 
    updateDoc,
    setDoc // Import setDoc for the merge fix
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Your specific Firebase Config ---
// This is the config you provided earlier.
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

// --- Auth State Logic ---
// This robust listener prevents the "flicker" redirect bug.
let authReady = false; // Flag to track if initial auth check is done
let currentUserId = null; // Store the user ID globally for this script

const authListener = onAuthStateChanged(auth, (user) => {
    authReady = true; // Mark auth as ready
    if (user) {
        // User is signed in.
        currentUserId = user.uid;
        
        // Define the path to the user's PRIVATE profile document
        const privateDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/info`);

        getDoc(privateDocRef)
            .then((docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    
                    // --- COMBINED NAME LOGIC ---
                    // Combine first and last name for display
                    const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`;
                    
                    // Populate the HTML elements
                    const nameEl = document.getElementById('loggedUserName');
                    const emailEl = document.getElementById('loggedUserEmail');
                    const bioEl = document.getElementById('loggedUserBio');

                    if (nameEl) nameEl.innerText = fullName.trim();
                    if (emailEl) emailEl.innerText = userData.email || 'No email found';
                    if (bioEl) bioEl.innerText = userData.bio || 'No bio provided';

                } else {
                    console.error("User is authenticated, but no matching document was found in Firestore at path:", privateDocRef.path);
                    // This might happen if signup failed to create the doc
                    const emailEl = document.getElementById('loggedUserEmail');
                    if (emailEl) emailEl.innerText = user.email;
                    const nameEl = document.getElementById('loggedUserName');
                    if (nameEl) nameEl.innerText = "Profile data not found";
                }
            })
            .catch((error) => {
                console.error("Error getting document:", error);
            });

    } else {
        // User is signed out
        currentUserId = null;
        console.log("User is not logged in. Redirecting to login page.");
        window.location.href = 'index.html';
    }
});

// --- Logout Button Logic ---
const logoutButton = document.getElementById('logout');
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        signOut(auth)
            .then(() => {
                console.log("Sign-out successful.");
                // The onAuthStateChanged listener above will automatically
                // detect the sign-out and redirect to index.html.
            })
            .catch((error) => {
                console.error('Error Signing out:', error);
            });
    });
}

// --- Edit Profile Modal Logic ---

// Get all modal elements
const editModal = document.getElementById('editModal');
const editModalBackdrop = document.getElementById('editModalBackdrop');
const editProfileButton = document.getElementById('editProfileButton');
const closeEditModalBtn = document.getElementById('closeEditModal'); 
const cancelEditButton = document.getElementById('cancelEditButton');
const saveChangesButton = document.getElementById('saveChangesButton');
const editMessage = document.getElementById('editMessage');

// Get modal form inputs
const editFName = document.getElementById('editFName');
const editLName = document.getElementById('editLName');
const editBio = document.getElementById('editBio');

/**
 * Helper function to show messages inside the modal
 */
function showEditMessage(message, isError = false) {
    if (!editMessage) return;
    editMessage.textContent = message;
    editMessage.className = isError 
        ? "p-3 rounded-md text-sm bg-red-100 text-red-700" 
        : "p-3 rounded-md text-sm bg-green-100 text-green-700";
    editMessage.classList.remove('hidden');
}

/**
 * Opens the edit modal and pre-fills it with current data.
 */
function openEditModal() {
    if (!editModal || !editModalBackdrop) return;

    // --- SPLIT NAME LOGIC ---
    // Get the combined name from the page and split it
    const loggedUserName = document.getElementById('loggedUserName').innerText;
    const names = loggedUserName.split(' ');
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || ''; // Handle names with multiple parts

    // Pre-fill the form
    if (editFName) editFName.value = firstName;
    if (editLName) editLName.value = lastName;
    
    // Get bio from the page, but check if it's the "loading" or "not found" text
    const currentBio = document.getElementById('loggedUserBio').innerText;
    if (editBio) {
        if (currentBio.toLowerCase().includes('loading...') || currentBio.toLowerCase().includes('no bio')) {
            editBio.value = '';
        } else {
            editBio.value = currentBio;
        }
    }
    
    // Hide any old messages
    if (editMessage) editMessage.classList.add('hidden');

    // Show the modal
    editModal.classList.remove('hidden');
    editModalBackdrop.classList.remove('hidden');
}

/**
 * Closes the edit modal.
 */
function closeEditModalFunction() { // Renamed to avoid conflict with element ID
    if (!editModal || !editModalBackdrop) return;
    editModal.classList.add('hidden');
    editModalBackdrop.classList.add('hidden');
}

/**
 * Saves the changes from the modal to Firestore.
 */
async function saveProfileChanges() {
    if (!authReady) {
        showEditMessage('Auth not ready, please wait.', true);
        return;
    }
    if (!currentUserId) {
        showEditMessage('Error: You are not logged in.', true);
        closeEditModalFunction();
        return;
    }

    // 1. Get new values from the form
    const newFirstName = editFName.value.trim();
    const newLastName = editLName.value.trim();
    const newBio = editBio.value.trim();
    
    // 2. Validate
    if (!newFirstName || !newLastName || !newBio) {
        showEditMessage('Error: All fields are required.', true);
        return;
    }

    // 3. Define the data and paths
    // Note: We only update fields that can be changed. Email is not editable here.
    const privateData = { 
        firstName: newFirstName, 
        lastName: newLastName, 
        bio: newBio 
    };
    const publicData = { 
        firstName: newFirstName, 
        lastName: newLastName 
    };

    const privateDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/info`);
    const publicDocRef = doc(db, `artifacts/${appId}/public/data/user_directory`, currentUserId);

    try {
        // 4. Update both documents
        // We use updateDoc (not setDoc) for the private one to avoid overwriting email.
        await updateDoc(privateDocRef, privateData);
        
        // --- FIX for public profile ---
        // Use setDoc with merge:true. This will CREATE the doc if it's missing
        // or UPDATE it if it already exists.
        await setDoc(publicDocRef, publicData, { merge: true });
        // --- END FIX ---

        // 5. Update the UI on the page
        const nameEl = document.getElementById('loggedUserName');
        const bioEl = document.getElementById('loggedUserBio');
        if (nameEl) nameEl.innerText = `${newFirstName} ${newLastName}`;
        if (bioEl) bioEl.innerText = newBio;
        
        // 6. Show success and close
        showEditMessage('Profile updated successfully!', false);
        setTimeout(closeEditModalFunction, 1500); // Close after 1.5s

    } catch (error) {
        console.error("Error updating profile: ", error);
        showEditMessage('Error: Could not save changes.', true);
    }
}

// --- Attach all Event Listeners ---
// We wait for the DOM to be ready to ensure all elements exist
document.addEventListener('DOMContentLoaded', () => {
    // Re-select buttons just in case
    const editBtn = document.getElementById('editProfileButton');
    const closeBtn = document.getElementById('closeEditModal');
    const cancelBtn = document.getElementById('cancelEditButton');
    const saveBtn = document.getElementById('saveChangesButton');
    const backdrop = document.getElementById('editModalBackdrop');
    
    if (editBtn) {
        editBtn.addEventListener('click', openEditModal);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeEditModalFunction);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeEditModalFunction);
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfileChanges);
    }
    if (backdrop) {
        backdrop.addEventListener('click', closeEditModalFunction);
    }
});

