import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    deleteUser // Needed for account deletion
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setLogLevel, 
    updateDoc,
    onSnapshot, // Use onSnapshot for real-time updates
    setDoc,
    deleteDoc // Needed for account deletion
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Your specific Firebase Config ---
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

// --- Global State ---
let currentUserId = null;
let authReady = false;
let userProfileData = {}; // Store the user's profile data
// Local state for modal editing
let modalSkillsOffering = [];
let modalSkillsSeeking = [];

// --- Page Element Refs ---
const page = {
    name: document.getElementById('loggedUserName'),
    email: document.getElementById('loggedUserEmail'),
    bio: document.getElementById('loggedUserBio'),
    logoutBtn: document.getElementById('logout'),
    editProfileBtn: document.getElementById('editProfileButton'),
    skillOfferContainer: document.getElementById('profileSkillOfferContainer'),
    skillSeekContainer: document.getElementById('profileSkillSeekContainer'),
    // --- NEW Link Elements ---
    linksContainer: document.getElementById('linksContainer'),
    profileLinkedIn: document.getElementById('profileLinkedIn'),
    profileGitHub: document.getElementById('profileGitHub'),
    profilePortfolio: document.getElementById('profilePortfolio'),
    noLinksMessage: document.getElementById('noLinksMessage'),
    // --- END NEW ---
    // Delete Account Refs
    deleteAccountBtn: document.getElementById('deleteAccountBtn'),
    deleteModal: document.getElementById('deleteAccountModal'),
    deleteModalBackdrop: document.getElementById('deleteAccountModalBackdrop'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
};

// --- Edit Modal Element Refs ---
const modal = {
    backdrop: document.getElementById('editModalBackdrop'),
    container: document.getElementById('editModal'),
    closeBtn: document.getElementById('closeEditModal'),
    cancelBtn: document.getElementById('cancelEditButton'),
    saveBtn: document.getElementById('saveChangesButton'),
    message: document.getElementById('editMessage'),
    fName: document.getElementById('editFName'),
    lName: document.getElementById('editLName'),
    bio: document.getElementById('editBio'),
    // Modal Skill Elements
    skillOfferInput: document.getElementById('modalSkillOfferInput'),
    addSkillOfferBtn: document.getElementById('modalAddSkillOfferBtn'),
    skillOfferContainer: document.getElementById('modalSkillOfferContainer'),
    skillSeekInput: document.getElementById('modalSkillSeekInput'),
    addSkillSeekBtn: document.getElementById('modalAddSkillSeekBtn'),
    skillSeekContainer: document.getElementById('modalSkillSeekContainer'),
    // --- NEW Link Inputs ---
    linkedIn: document.getElementById('editLinkedIn'),
    gitHub: document.getElementById('editGitHub'),
    portfolio: document.getElementById('editPortfolio'),
    // --- END NEW ---
};

/**
 * Renders the skill pills on the MAIN PROFILE page (display-only).
 */
function renderProfileSkills(skillsOffering = [], skillsSeeking = []) {
    if (page.skillOfferContainer) {
        if (skillsOffering.length === 0) {
            page.skillOfferContainer.innerHTML = `<p class="text-gray-500 text-sm">No skills offered yet.</p>`;
        } else {
            page.skillOfferContainer.innerHTML = skillsOffering.map(skill => 
                `<span class="skill-pill">${skill}</span>`
            ).join('');
        }
    }
    
    if (page.skillSeekContainer) {
        if (skillsSeeking.length === 0) {
            page.skillSeekContainer.innerHTML = `<p class="text-gray-500 text-sm">No skills sought yet.</p>`;
        } else {
            page.skillSeekContainer.innerHTML = skillsSeeking.map(skill => 
                `<span class="skill-pill skill-pill-seeking">${skill}</span>`
            ).join('');
        }
    }
}

/**
 * Updates the main profile page with data.
 */
function updateProfilePage(data) {
    // Check for null/undefined data to prevent errors
    if (!data) return;
    
    userProfileData = data; // Store latest data

    // --- Combine Name ---
    if (page.name) page.name.innerText = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    
    if (page.email) page.email.innerText = data.email || 'N/A';
    if (page.bio) page.bio.innerText = data.bio || 'No bio provided.';
    
    // --- NEW: Update Links ---
    const linkedIn = data.linkedIn || '';
    const gitHub = data.gitHub || '';
    const portfolio = data.portfolio || '';
    let hasLinks = false;

    if (page.profileLinkedIn) {
        if (linkedIn) {
            page.profileLinkedIn.href = linkedIn;
            page.profileLinkedIn.classList.remove('hidden');
            page.profileLinkedIn.classList.add('inline-flex'); // Use inline-flex to align icon
            hasLinks = true;
        } else {
            page.profileLinkedIn.classList.add('hidden');
            page.profileLinkedIn.classList.remove('inline-flex');
        }
    }
    
    if (page.profileGitHub) {
        if (gitHub) {
            page.profileGitHub.href = gitHub;
            page.profileGitHub.classList.remove('hidden');
            page.profileGitHub.classList.add('inline-flex');
            hasLinks = true;
        } else {
            page.profileGitHub.classList.add('hidden');
            page.profileGitHub.classList.remove('inline-flex');
        }
    }
    
    if (page.profilePortfolio) {
        if (portfolio) {
            page.profilePortfolio.href = portfolio;
            page.profilePortfolio.classList.remove('hidden');
            page.profilePortfolio.classList.add('inline-flex');
            hasLinks = true;
        } else {
            page.profilePortfolio.classList.add('hidden');
            page.profilePortfolio.classList.remove('inline-flex');
        }
    }

    // Show/hide the fallback message
    if (page.noLinksMessage) {
        page.noLinksMessage.classList.toggle('hidden', hasLinks);
    }
    // --- END NEW ---

    renderProfileSkills(data.skillsOffering, data.skillsSeeking);
}

// --- Edit Modal Functions ---

/**
 * Renders the editable skill pills inside the MODAL.
 */
function renderModalSkills() {
    if (modal.skillOfferContainer) {
        modal.skillOfferContainer.innerHTML = modalSkillsOffering.map((skill, index) => `
            <span class="skill-pill">
                ${skill}
                <i class="fas fa-times delete-skill modal-delete-skill" data-index="${index}" data-type="offering"></i>
            </span>
        `).join('');
    }

    if (modal.skillSeekContainer) {
        modal.skillSeekContainer.innerHTML = modalSkillsSeeking.map((skill, index) => `
            <span class="skill-pill skill-pill-seeking">
                ${skill}
                <i class="fas fa-times delete-skill modal-delete-skill" data-index="${index}" data-type="seeking"></i>
            </span>
        `).join('');
    }
    
    addModalDeleteListeners();
}

/**
 * Adds click listeners to all skill-delete buttons *inside the modal*.
 */
function addModalDeleteListeners() {
    modal.container.querySelectorAll('.modal-delete-skill').forEach(button => {
        // Remove old listener to prevent duplicates
        button.removeEventListener('click', handleModalSkillDelete);
        // Add new listener
        button.addEventListener('click', handleModalSkillDelete);
    });
}

/**
 * Handles the click event for deleting a modal skill.
 */
function handleModalSkillDelete(e) {
    const index = parseInt(e.target.dataset.index);
    const type = e.target.dataset.type;

    if (type === 'offering') {
        modalSkillsOffering.splice(index, 1); // Remove from local modal array
    } else if (type === 'seeking') {
        modalSkillsSeeking.splice(index, 1); // Remove from local modal array
    }
    
    renderModalSkills(); // Re-render the modal UI
}


/**
 * Opens the edit modal and pre-fills it.
 */
function openEditModal() {
    if (!modal.container || !modal.backdrop) return;

    // 1. Pre-fill text inputs (Name splitting is crucial here)
    if (modal.fName) modal.fName.value = userProfileData.firstName || '';
    if (modal.lName) modal.lName.value = userProfileData.lastName || '';
    if (modal.bio) modal.bio.value = userProfileData.bio || '';
    // --- NEW ---
    if (modal.linkedIn) modal.linkedIn.value = userProfileData.linkedIn || '';
    if (modal.gitHub) modal.gitHub.value = userProfileData.gitHub || '';
    if (modal.portfolio) modal.portfolio.value = userProfileData.portfolio || '';
    // --- END NEW ---

    // 2. Pre-fill skill arrays for the modal
    modalSkillsOffering = [...(userProfileData.skillsOffering || [])];
    modalSkillsSeeking = [...(userProfileData.skillsSeeking || [])];
    
    // 3. Render the skills into the modal
    renderModalSkills();
    
    // 4. Hide any old messages
    if (modal.message) modal.message.classList.add('hidden');

    // 5. Show the modal
    modal.container.classList.remove('hidden');
    modal.backdrop.classList.remove('hidden');
}

/**
 * Closes the edit modal.
 */
function closeEditModal() {
    if (!modal.container || !modal.backdrop) return;
    modal.container.classList.add('hidden');
    modal.backdrop.classList.add('hidden');
}

/**
 * Helper function to show messages inside the modal
 */
function showEditMessage(message, isError = false) {
    if (!modal.message) return;
    modal.message.textContent = message;
    modal.message.className = isError 
        ? "p-3 rounded-md text-sm bg-red-100 text-red-700" 
        : "p-3 rounded-md text-sm bg-green-100 text-green-700";
    modal.message.classList.remove('hidden');
}

/**
 * Saves all changes from the modal to Firestore.
 */
async function saveProfileChanges() {
    if (!authReady || !currentUserId) {
        showEditMessage('Auth not ready, please wait.', true);
        return;
    }

    // 1. Get new values from the form
    const newFirstName = modal.fName.value.trim();
    const newLastName = modal.lName.value.trim();
    const newBio = modal.bio.value.trim();
    // --- NEW ---
    const newLinkedIn = modal.linkedIn.value.trim();
    const newGitHub = modal.gitHub.value.trim();
    const newPortfolio = modal.portfolio.value.trim();
    // --- END NEW ---
    
    // 2. Validate
    if (!newFirstName || !newLastName || !newBio) {
        showEditMessage('Error: Name and Bio fields are required.', true);
        return;
    }

    // 3. Define the data and paths
    const privateData = { 
        ...userProfileData, // Preserve existing data like email
        firstName: newFirstName, 
        lastName: newLastName, 
        bio: newBio,
        skillsOffering: modalSkillsOffering,
        skillsSeeking: modalSkillsSeeking,
        // --- NEW ---
        linkedIn: newLinkedIn,
        gitHub: newGitHub,
        portfolio: newPortfolio
        // --- END NEW ---
    };
    
    const publicData = { 
        firstName: newFirstName, 
        lastName: newLastName,
        skillsOffering: modalSkillsOffering,
        skillsSeeking: modalSkillsSeeking,
        // --- NEW ---
        linkedIn: newLinkedIn,
        gitHub: newGitHub,
        portfolio: newPortfolio
        // --- END NEW ---
    };

    const privateDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/info`);
    const publicDocRef = doc(db, `artifacts/${appId}/public/data/user_directory`, currentUserId);

    try {
        // 4. Update both documents (using setDoc with merge to create if missing)
        await setDoc(privateDocRef, privateData, { merge: true }); 
        await setDoc(publicDocRef, publicData, { merge: true }); 

        // 5. Show success and close
        showEditMessage('Profile updated successfully!', false);
        // UI is updated automatically by onSnapshot
        setTimeout(closeEditModal, 1500); 

    } catch (error) {
        console.error("Error updating profile: ", error);
        showEditMessage('Error: Could not save changes.', true);
    }
}

// --- Delete Account Logic ---

/**
 * Opens the delete account confirmation modal.
 */
function openDeleteModal() {
    if (page.deleteModal && page.deleteModalBackdrop) {
        page.deleteModal.classList.remove('hidden');
        page.deleteModalBackdrop.classList.remove('hidden');
    }
}

/**
 * Closes the delete account confirmation modal.
 */
function closeDeleteModal() {
    if (page.deleteModal && page.deleteModalBackdrop) {
        page.deleteModal.classList.add('hidden');
        page.deleteModalBackdrop.classList.add('hidden');
    }
}

/**
 * Executes the account deletion process.
 */
async function deleteUserAccount() {
    if (!currentUserId || !auth.currentUser) return;
    
    // Disable button during deletion
    if (page.confirmDeleteBtn) {
        page.confirmDeleteBtn.disabled = true;
        page.confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Deleting...';
    }

    const user = auth.currentUser;
    
    // 1. Define document paths
    const privateDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/info`);
    const publicDocRef = doc(db, `artifacts/${appId}/public/data/user_directory`, currentUserId);

    try {
        // 2. Delete Firestore Documents (Private and Public) FIRST
        // This is done before deleting the Auth user, as it often fails first.
        await deleteDoc(privateDocRef).catch(e => console.warn("Could not delete private doc:", e));
        await deleteDoc(publicDocRef).catch(e => console.warn("Could not delete public doc:", e));
        console.log("Firestore documents deletion attempted.");

        // 3. Delete Firebase Auth User
        // This is the step most likely to throw the "requires-recent-login" error.
        await deleteUser(user);
        console.log("Auth user deleted.");

        // 4. Success and Redirect
        alert("Your account has been permanently deleted. Redirecting...");
        window.location.href = 'index.html';

    } catch (error) {
        console.error("Error during account deletion:", error);
        
        // Handle the specific error requiring re-authentication
        if (error.code === 'auth/requires-recent-login') {
            alert("SECURITY ERROR: Please log out, log in again, and immediately try to delete your account.");
            // We do NOT call signOut here, as it may interfere with the required re-authentication flow.
        } else {
             alert(`Error deleting account: ${error.message}. Please try again later.`);
        }
        // Re-enable button on failure
        if (page.confirmDeleteBtn) {
            page.confirmDeleteBtn.disabled = false;
            page.confirmDeleteBtn.innerHTML = 'Yes, Delete Permanently';
        }
    }
}


// --- Main Auth Listener ---
onAuthStateChanged(auth, (user) => {
    // Select all elements again inside the listener's scope to be safe (though DOMContentLoaded should cover it)
    const pageName = document.getElementById('loggedUserName');
    const pageEmail = document.getElementById('loggedUserEmail');
    const pageBio = document.getElementById('loggedUserBio');

    if (user) {
        currentUserId = user.uid;
        authReady = true;
        
        // --- Use onSnapshot for real-time updates ---
        const privateDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/info`);
        
        onSnapshot(privateDocRef, (docSnap) => {
            // Check if document exists before trying to access data
            if (docSnap.exists()) {
                // If data exists, update the page
                updateProfilePage(docSnap.data());
            } else {
                // If doc is missing but user is logged in (e.g., manual deletion or incomplete signup)
                console.error("User is authenticated, but no matching document was found in Firestore.");
                
                // Set page fields to a fallback state
                if (pageName) pageName.innerText = "Profile data missing. Edit profile to save.";
                if (pageEmail) pageEmail.innerText = user.email || 'N/A';
                if (pageBio) pageBio.innerText = "No profile details found.";

                // Use the update function to set skills to empty arrays
                updateProfilePage({
                    firstName: user.email ? user.email.split('@')[0] : 'User', 
                    lastName: '', 
                    email: user.email, 
                    bio: 'Profile document missing. Please edit profile to save your details.', 
                    skillsOffering: [], 
                    skillsSeeking: []
                    // Links will be treated as empty/undefined and show the fallback
                });
            }
        }, (error) => {
            console.error("Error listening to profile:", error);
            // Show network error to user
            if (pageName) pageName.innerText = "Error: Failed to connect to database.";
            if (pageEmail) pageEmail.innerText = "N/A";
            if (pageBio) pageBio.innerText = "Please check your connection.";
        });

    } else {
        // User is signed out
        currentUserId = null;
        authReady = false;
        console.log("User is not logged in. Redirecting to login page.");
        window.location.href = 'index.html';
    }
});

// --- Attach all Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    if (page.logoutBtn) {
        page.logoutBtn.addEventListener('click', () => signOut(auth));
    }
    
    // Edit Profile Modal Listeners
    if (page.editProfileBtn) {
        page.editProfileBtn.addEventListener('click', openEditModal);
    }
    if (modal.closeBtn) {
        modal.closeBtn.addEventListener('click', closeEditModal);
    }
    if (modal.cancelBtn) {
        modal.cancelBtn.addEventListener('click', closeEditModal);
    }
    if (modal.backdrop) {
        modal.backdrop.addEventListener('click', closeEditModal);
    }
    if (modal.saveBtn) {
        modal.saveBtn.addEventListener('click', saveProfileChanges);
    }
    
    // Delete Account Modal Listeners
    if (page.deleteAccountBtn) {
        page.deleteAccountBtn.addEventListener('click', openDeleteModal);
    }
    if (page.cancelDeleteBtn) {
        page.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }
    if (page.deleteModalBackdrop) {
        page.deleteModalBackdrop.addEventListener('click', closeDeleteModal);
    }
    // The confirmDeleteBtn listener is critical
    if (page.confirmDeleteBtn) {
        page.confirmDeleteBtn.addEventListener('click', deleteUserAccount);
    }

    // Modal Skill Add Listeners
    if (modal.addSkillOfferBtn) {
        modal.addSkillOfferBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const skill = modal.skillOfferInput.value.trim();
            if (skill && !modalSkillsOffering.includes(skill)) {
                modalSkillsOffering.push(skill);
                renderModalSkills();
                modal.skillOfferInput.value = '';
            }
        });
    }

    if(modal.addSkillSeekBtn) {
        modal.addSkillSeekBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const skill = modal.skillSeekInput.value.trim();
            if (skill && !modalSkillsSeeking.includes(skill)) {
                modalSkillsSeeking.push(skill);
                renderModalSkills();
                modal.skillSeekInput.value = '';
            }
        });
    }
});

