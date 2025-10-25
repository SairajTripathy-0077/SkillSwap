import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setLogLevel, 
    updateDoc,
    onSnapshot, // Use onSnapshot for real-time updates
    setDoc
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
    editSkillsBtn: document.getElementById('editSkillsButton'), // Button on Skills card
    skillOfferContainer: document.getElementById('profileSkillOfferContainer'),
    skillSeekContainer: document.getElementById('profileSkillSeekContainer'),
    loadingOffer: document.getElementById('loadingSkillsOffer'),
    loadingSeek: document.getElementById('loadingSkillsSeek'),
};

// --- Modal Element Refs ---
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
};

/**
 * Renders the skill pills on the MAIN PROFILE page (display-only).
 */
function renderProfileSkills(skillsOffering = [], skillsSeeking = []) {
    if (page.skillOfferContainer) {
        if (page.loadingOffer) page.loadingOffer.style.display = 'none';
        if (skillsOffering.length === 0) {
            page.skillOfferContainer.innerHTML = `<p class="text-gray-500 text-sm">No skills offered yet.</p>`;
        } else {
            page.skillOfferContainer.innerHTML = skillsOffering.map(skill => 
                `<span class="skill-pill">${skill}</span>`
            ).join('');
        }
    }
    
    if (page.skillSeekContainer) {
        if (page.loadingSeek) page.loadingSeek.style.display = 'none';
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
    userProfileData = data; // Store latest data

    if (page.name) page.name.innerText = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    if (page.email) page.email.innerText = data.email || 'No email found';
    if (page.bio) page.bio.innerText = data.bio || 'No bio provided';
    
    renderProfileSkills(data.skillsOffering, data.skillsSeeking);
}

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
    
    // Add event listeners to the new 'x' buttons
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

    // 1. Pre-fill text inputs
    if (modal.fName) modal.fName.value = userProfileData.firstName || '';
    if (modal.lName) modal.lName.value = userProfileData.lastName || '';
    if (modal.bio) modal.bio.value = userProfileData.bio || '';

    // 2. Pre-fill skill arrays for the modal
    // Create deep copies to avoid modifying the main profile state until "Save"
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
    
    // 2. Validate
    if (!newFirstName || !newLastName || !newBio) {
        showEditMessage('Error: Name and Bio fields are required.', true);
        return;
    }

    // 3. Define the data and paths
    // We update all fields from the modal, including the skill arrays
    const privateData = { 
        ...userProfileData, // Preserve existing data like email
        firstName: newFirstName, 
        lastName: newLastName, 
        bio: newBio,
        skillsOffering: modalSkillsOffering,
        skillsSeeking: modalSkillsSeeking
    };
    
    // Public data only needs name and skills
    const publicData = { 
        firstName: newFirstName, 
        lastName: newLastName,
        skillsOffering: modalSkillsOffering,
        skillsSeeking: modalSkillsSeeking
    };

    const privateDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/info`);
    const publicDocRef = doc(db, `artifacts/${appId}/public/data/user_directory`, currentUserId);

    try {
        // 4. Update both documents
        // Use setDoc with merge to ensure email isn't overwritten
        await setDoc(privateDocRef, privateData, { merge: true }); 
        await setDoc(publicDocRef, publicData, { merge: true }); // This will create or update

        // 5. Show success and close
        showEditMessage('Profile updated successfully!', false);
        // The onSnapshot listener will update the UI automatically.
        setTimeout(closeEditModal, 1500); // Close after 1.5s

    } catch (error) {
        console.error("Error updating profile: ", error);
        showEditMessage('Error: Could not save changes.', true);
    }
}

// --- Main Auth Listener ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        authReady = true;
        
        // --- Use onSnapshot for real-time updates ---
        const privateDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/info`);
        
        onSnapshot(privateDocRef, (docSnap) => {
            if (docSnap.exists()) {
                updateProfilePage(docSnap.data());
            } else {
                console.error("User is authenticated, but no matching document was found.");
                if (page.name) page.name.innerText = "Profile data not found";
                if (page.email) page.email.innerText = user.email; // Fallback
            }
        }, (error) => {
            console.error("Error listening to profile:", error);
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
    if (page.editProfileBtn) {
        page.editProfileBtn.addEventListener('click', openEditModal);
    }
    
    // --- ADDED: Listener for new "Edit Skills" button ---
    if (page.editSkillsBtn) {
        page.editSkillsBtn.addEventListener('click', openEditModal);
    }
    // --- END ADDED ---

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

    // --- Modal Skill Add Listeners ---
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

