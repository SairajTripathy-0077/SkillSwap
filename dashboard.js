import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    getDoc, 
    doc, 
    setLogLevel,
    collection,
    query,
    onSnapshot,
    serverTimestamp,
    setDoc, // Used for creating swap requests
    where,
    updateDoc, // Used for updating swap requests
    getDocs, // Used for checking existing pending requests
    deleteDoc // --- NEW: Added for deleting chat rooms ---
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

// Global state
let currentUserId = null;
let currentReceiverId = null; // Stores the ID of the user whose profile modal is open
let usersDirectory = {}; // Cache public user data (id -> {firstName, lastName})

// --- Element References ---
const userModal = document.getElementById('userModal');
const userModalBackdrop = document.getElementById('userModalBackdrop');
const notificationArea = document.getElementById('notificationArea');
const notificationBadge = document.getElementById('notificationBadge');
const logoutButton = document.getElementById('logout');
const notificationBell = document.getElementById('notificationBell');
const requestSwapButton = document.getElementById('requestSwapButton');

const swappedUsersButton = document.getElementById('swappedUsersButton'); 
const userListSection = document.getElementById('userListSection'); 

// --- Dropdown Elements ---
const swappedUsersDropdownMenu = document.getElementById('swappedUsersDropdownMenu');


/**
 * Creates a promise that resolves with the user's initial auth state.
 */
const getInitialUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); 
      resolve(user);
    }, reject);
  });
};

// --- Notification Area Logic ---

/**
 * Fetches user first names and caches them for use in notifications.
 */
async function fetchUserNames(userIds) {
    const names = {};
    const promises = userIds.map(async (id) => {
        if (usersDirectory[id]) {
            names[id] = `${usersDirectory[id].firstName} ${usersDirectory[id].lastName}`;
            return;
        }
        
        // Fetch from the public directory
        const docRef = doc(db, `artifacts/${appId}/public/data/user_directory`, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const fullName = `${data.firstName} ${data.lastName}`;
            names[id] = fullName;
            usersDirectory[id] = { firstName: data.firstName, lastName: data.lastName }; // Cache
        } else {
            names[id] = 'Unknown User';
        }
    });
    // Wait for all name fetches to complete
    await Promise.all(promises.filter(p => p)); 
    return names;
}

/**
 * Handles accepting or rejecting a swap request.
 */
async function handleSwapResponse(requestId, action) {
    const requestDocRef = doc(db, `artifacts/${appId}/public/data/swap_requests`, requestId);
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    try {
        await updateDoc(requestDocRef, {
            status: newStatus
        });
        console.log(`Swap request ${requestId} ${newStatus}.`);

        // The onSnapshot listener will automatically refresh the notification list
    } catch (error) {
        console.error(`Error updating request ${requestId}:`, error);
    }
}


/**
 * Fetches and renders the current user's incoming swap requests.
 */
function listenForSwapRequests(currentUserId) {
    if (!notificationArea) return;
    
    // Query for requests where the current user is the receiver and the status is pending
    const requestsCollectionRef = collection(db, `artifacts/${appId}/public/data/swap_requests`);
    const q = query(
        requestsCollectionRef,
        where("receiverId", "==", currentUserId),
        where("status", "==", "pending")
    );

    onSnapshot(q, async (snapshot) => {
        const pendingRequests = [];
        snapshot.forEach((doc) => {
            pendingRequests.push({ id: doc.id, ...doc.data() });
        });

        // Update the badge
        if (notificationBadge) {
            notificationBadge.classList.toggle('hidden', pendingRequests.length === 0);
            notificationBadge.innerText = pendingRequests.length;
        }

        // Render the notification area
        if (pendingRequests.length > 0) {
            
            // Fetch sender names for all pending requests
            const senderIds = pendingRequests.map(req => req.senderId);
            const senderNamesMap = await fetchUserNames(senderIds);

            notificationArea.innerHTML = `
                <div class="p-6">
                    <h2 class="text-xl font-bold text-gray-800 flex items-center mb-4">
                        <i class="fas fa-bell text-yellow-500 mr-2"></i> 
                        You have ${pendingRequests.length} Pending Swap Request(s)
                    </h2>
                    <div id="requestList" class="space-y-4">
                        ${pendingRequests.map(req => {
                            const senderName = senderNamesMap[req.senderId] || 'Unknown User';
                            return `
                                <div id="request-${req.id}" class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex justify-between items-center flex-wrap gap-3">
                                    <p class="font-medium text-gray-700">
                                        <span class="text-primary-600 font-semibold">${senderName}</span> wants to swap skills with you.
                                    </p>
                                    <div class="flex space-x-2">
                                        <button data-requestid="${req.id}" data-action="accept" class="action-btn px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition">
                                            <i class="fas fa-check"></i> Accept
                                        </button>
                                        <button data-requestid="${req.id}" data-action="reject" class="action-btn px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 transition">
                                            <i class="fas fa-times"></i> Reject
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            notificationArea.classList.remove('hidden');

            // Attach event listeners to the new buttons
            document.querySelectorAll('.action-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const requestId = e.currentTarget.dataset.requestid;
                    const action = e.currentTarget.dataset.action;
                    handleSwapResponse(requestId, action);
                });
            });

        } else {
            notificationArea.classList.add('hidden');
            notificationArea.innerHTML = '';
        }
    }, (error) => {
        console.error("Error listening for swap requests:", error);
    });
}

/**
 * Listens for the outcome of sent swaps (Accepted/Rejected).
 */
function listenForAcceptedSwaps(currentUserId) {
    // Query for requests where the current user is the sender and the status is finalized (accepted/rejected)
    const requestsCollectionRef = collection(db, `artifacts/${appId}/public/data/swap_requests`);
    const q = query(
        requestsCollectionRef,
        where("senderId", "==", currentUserId),
        where("status", "in", ["accepted", "rejected"])
    );

    onSnapshot(q, async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "modified") {
                const request = { id: change.doc.id, ...change.doc.data() };

                // Only show notification for new changes, not old ones (re-renders are handled by public directory listener)
                if (request.status === 'accepted' || request.status === 'rejected') {
                    
                    // Prevent showing notification on initial load or if already processed
                    const isNewChange = change.doc.metadata.hasPendingWrites === false;

                    if (isNewChange && !sessionStorage.getItem(`notified-${request.id}`)) {
                        
                        const receiverNameMap = await fetchUserNames([request.receiverId]);
                        const receiverName = receiverNameMap[request.receiverId] || 'a user';
                        const statusText = request.status === 'accepted' ? 'accepted' : 'rejected';
                        const bgColor = request.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

                        // Display persistent notification
                        const notificationId = `sender-notif-${request.id}`;
                        const existingNotif = document.getElementById(notificationId);
                        if (existingNotif) existingNotif.remove(); // Remove old one if it exists

                        const notifHtml = document.createElement('div');
                        notifHtml.id = notificationId;
                        notifHtml.className = `p-4 rounded-lg shadow-md mb-4 ${bgColor} flex justify-between items-center`;
                        notifHtml.innerHTML = `
                            <p class="font-medium">Your swap request to <span class="font-bold">${receiverName}</span> was ${statusText}!</p>
                            <button class="text-sm font-medium hover:underline ml-4" onclick="document.getElementById('${notificationId}').remove(); sessionStorage.setItem('notified-${request.id}', 'true');">
                                Dismiss
                            </button>
                        `;

                        // Prepend the notification to the main content area
                        const mainContent = document.querySelector('.pt-24.pb-12 .max-w-7xl');
                        if (mainContent) {
                             mainContent.prepend(notifHtml);
                        }

                        // Mark as notified in session storage to prevent re-display on refresh
                        sessionStorage.setItem(`notified-${request.id}`, 'true');
                    }
                }
            }
        });
    }, (error) => {
        console.error("Error listening for accepted swaps:", error);
    });
}


/**
 * Checks the swap status between the current user and a target user.
 */
async function checkSwapStatus(targetUserId) {
    if (!currentUserId) return false;

    // Check for an *accepted* request where the current user is involved as either sender or receiver
    const requestsCollectionRef = collection(db, `artifacts/${appId}/public/data/swap_requests`);
    
    // Check Case 1: Current user sent the request, and it was accepted
    const q1 = query(
        requestsCollectionRef,
        where("senderId", "==", currentUserId),
        where("receiverId", "==", targetUserId),
        where("status", "==", "accepted")
    );
    
    // Check Case 2: Current user received the request, and it was accepted
    const q2 = query(
        requestsCollectionRef,
        where("senderId", "==", targetUserId),
        where("receiverId", "==", currentUserId),
        where("status", "==", "accepted")
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    return !snap1.empty || !snap2.empty;
}


// --- Swapped Users View Logic (Dropdown) ---

/**
 * Toggles the visibility of the swapped users dropdown menu.
 */
function toggleSwappedUsersDropdown(currentUserId) {
    if (!swappedUsersDropdownMenu) return;

    // Load and render the list if it's about to be shown
    if (swappedUsersDropdownMenu.classList.contains('hidden')) {
        loadSwappedUsersForDropdown(currentUserId);
    }
    
    swappedUsersDropdownMenu.classList.toggle('hidden');
}


/**
 * Loads and renders users with an accepted swap status directly into the dropdown menu.
 */
function loadSwappedUsersForDropdown(currentUserId) {
    // Show loading state immediately
    swappedUsersDropdownMenu.innerHTML = `
        <div class="px-4 py-2 text-sm font-semibold text-gray-800 border-b">Active Swaps</div>
        <div id="swappedDropdownLoading" class="flex items-center px-4 py-2 text-sm text-gray-500">
            <i class="fas fa-spinner fa-spin mr-2"></i> Fetching swaps...
        </div>
    `;

    // Path to the PUBLIC user directory
    const usersCollectionRef = collection(db, `artifacts/${appId}/public/data/user_directory`);
    const q = query(usersCollectionRef);

    onSnapshot(q, async (snapshot) => {
        swappedUsersDropdownMenu.innerHTML = `<div class="px-4 py-2 text-sm font-semibold text-gray-800 border-b">Active Swaps</div>`; // Clear previous list but keep header
        
        const swappedUsers = [];
        // 1. Filter and identify swapped users
        for (const docSnap of snapshot.docs) {
            const userId = docSnap.id;
            if (userId !== currentUserId) {
                const isSwapped = await checkSwapStatus(userId);
                if (isSwapped) {
                    swappedUsers.push({ id: userId, ...docSnap.data() });
                }
            }
        }
        
        // 2. Render the list
        if (swappedUsers.length === 0) {
            swappedUsersDropdownMenu.innerHTML += `
                <div class="px-4 py-2 text-sm text-gray-500">No active swaps yet.</div>
            `;
            return;
        }

        // --- UPDATED to include chat and remove icons ---
        swappedUsersDropdownMenu.innerHTML += swappedUsers.map(user => {
            // --- CHANGE 1: Get full name here ---
            const fullName = `${user.firstName} ${user.lastName}`;
            return `
            <div class="dropdown-item-container group flex items-center justify-between w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition">
                <button data-userid="${user.id}" data-action="view" class="dropdown-profile-button flex-1 flex items-center min-w-0">
                    <i class="fas fa-handshake text-secondary-500 mr-3"></i>
                    <span class="truncate">${fullName}</span>
                </button>
                <div class="flex items-center pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <!-- Chat Link -->
                    <a href="chat.html?userId=${user.id}" class="chat-buddy-link p-1 text-gray-500 hover:text-primary-500" title="Chat">
                        <i class="fas fa-comments"></i>
                    </a>
                    <!-- Remove Button -->
                    <!-- CHANGE 2: Add data-palname attribute -->
                    <button data-palid="${user.id}" data-palname="${fullName}" data-action="remove" class="remove-swap-btn p-1 text-gray-500 hover:text-error-red-600" title="Remove Swap">
                        <i class="fas fa-minus-circle"></i>
                    </button>
                </div>
            </div>
        `}).join('');


        // 3. Add click listeners to open the user profile modal
        document.querySelectorAll('.dropdown-profile-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop click from immediately closing dropdown
                showUserProfile(button.dataset.userid);
                if (swappedUsersDropdownMenu) swappedUsersDropdownMenu.classList.add('hidden'); // Close dropdown after selection
            });
        });
        
        // 4. Add listener for the new REMOVE button
        document.querySelectorAll('.remove-swap-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                // --- CHANGE 3: Read from data attributes on e.currentTarget ---
                const palId = e.currentTarget.dataset.palid;
                const palName = e.currentTarget.dataset.palname;
                // Confirm action before removal
                if (confirm(`Are you sure you want to remove ${palName} from your swapped list? This will also delete your chat history.`)) {
                    handleRemoveSwap(palId);
                }
            });
        });


    }, (error) => {
        console.error("Error loading swapped users:", error);
        swappedUsersDropdownMenu.innerHTML += `<div class="px-4 py-2 text-sm text-red-500">Could not load list.</div>`;
    });
}

/**
 * --- NEW FUNCTION ---
 * Deletes all messages in a chat room and the chat room document itself.
 */
async function deleteChatRoom(palId) {
    if (!currentUserId || !palId) return;

    console.log(`Attempting to delete chat room with: ${palId}`);
    const chatRoomId = [currentUserId, palId].sort().join('_');
    const messagesRef = collection(db, `artifacts/${appId}/public/data/chat_rooms/${chatRoomId}/messages`);
    const chatRoomDocRef = doc(db, `artifacts/${appId}/public/data/chat_rooms`, chatRoomId);

    try {
        // 1. Get all messages in the subcollection
        const messagesSnapshot = await getDocs(messagesRef);
        if (messagesSnapshot.empty) {
            console.log("No messages to delete.");
        } else {
             // 2. Create deletion promises for all messages
            const deletePromises = [];
            messagesSnapshot.forEach((doc) => {
                deletePromises.push(deleteDoc(doc.ref));
            });
            
            // 3. Wait for all messages to be deleted
            await Promise.all(deletePromises);
            console.log(`Deleted ${deletePromises.length} messages.`);
        }

        // 4. Delete the parent chat room document (if it exists)
        await deleteDoc(chatRoomDocRef).catch(err => {
            console.warn("Could not delete parent chat room doc (it may not have existed):", err.message);
        });
        console.log(`Attempted deletion of parent chat room doc: ${chatRoomId}`);

    } catch (error) {
        console.error("Error deleting chat room:", error);
        // Don't alert the user, just log it. The main swap removal is more important.
    }
}


/**
 * --- MODIFIED FUNCTION ---
 * Removes an accepted swap relationship AND deletes the chat history.
 */
async function handleRemoveSwap(palId) {
    if (!currentUserId || !palId) return;

    // Find the ACCEPTED request between the two users
    const requestsCollectionRef = collection(db, `artifacts/${appId}/public/data/swap_requests`);
    
    // Query for the accepted document where either user is the sender/receiver
    const q = query(
        requestsCollectionRef,
        where("status", "==", "accepted"),
        where("senderId", "in", [currentUserId, palId]),
        where("receiverId", "in", [currentUserId, palId])
    );

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.warn("No accepted swap found to remove.");
            alert("No active swap connection found to remove.");
            return;
        }

        // We only expect one document to match
        const docToUpdate = snapshot.docs[0]; 
        
        // 1. Update the swap request to 'removed'
        await updateDoc(docToUpdate.ref, {
            status: 'removed', // Set status to 'removed'
            removedBy: currentUserId, // Optional: log who removed it
            removedAt: serverTimestamp()
        });
        
        // 2. --- NEW --- Delete the associated chat room
        console.log("Swap connection removed. Now deleting chat room...");
        await deleteChatRoom(palId); // <-- CALL THE NEW FUNCTION

        alert("Swap connection and chat history successfully removed.");
        // The onSnapshot listener will automatically refresh the dropdown and the main user list.

    } catch (error) {
        console.error("Error removing swap connection/chat:", error);
        alert("Error removing swap connection. Please try again.");
    }
}

// --- The rest of the dashboard.js file follows (Request Swap, User List, Modals, etc.) ---

// --- View Toggle Logic (Simplified/Removed) ---

function toggleView(view) {
    // This function is now simplified since the list is in the dropdown
    userListSection.classList.remove('hidden'); // Always show the main list
}


// --- Swap Request Button Logic (in User Modal) ---

function showRequestMessage(message, isError = false) {
    const msgDiv = document.getElementById('swapRequestMessage');
    if (!msgDiv) return;

    msgDiv.textContent = message;
    msgDiv.className = isError 
        ? "p-3 rounded-md text-sm bg-red-100 text-red-700 block transition duration-300" 
        : "p-3 rounded-md text-sm bg-green-100 text-green-700 block transition duration-300";
    
    setTimeout(() => {
        msgDiv.classList.add('hidden');
    }, 4000);
    msgDiv.classList.remove('hidden');
}


if (requestSwapButton) {
    requestSwapButton.addEventListener('click', async () => {
        if (!currentUserId) {
            showRequestMessage("You must be logged in to send a request.", true);
            return;
        }
        if (!currentReceiverId) {
            showRequestMessage("Error: Could not determine the recipient.", true);
            return;
        }

        // --- UI Feedback while sending ---
        requestSwapButton.disabled = true;
        requestSwapButton.innerText = "Sending...";
        
        try {
            // Check if a pending request already exists
            const requestsCollectionRef = collection(db, `artifacts/${appId}/public/data/swap_requests`);
            const q = query(
                requestsCollectionRef,
                where("senderId", "==", currentUserId),
                where("receiverId", "==", currentReceiverId),
                where("status", "==", "pending")
            );
            
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                showRequestMessage("A pending swap request has already been sent to this user.", false);
                return;
            }

            // Create the new request document
            const newRequestRef = doc(requestsCollectionRef);
            await setDoc(newRequestRef, {
                senderId: currentUserId,
                receiverId: currentReceiverId,
                timestamp: serverTimestamp(),
                status: 'pending'
            });

            showRequestMessage("Swap Request Sent Successfully!", false);

        } catch (error) {
            console.error("Error sending swap request:", error);
            showRequestMessage("Error sending request. Please try again.", true);
        } finally {
            requestSwapButton.disabled = false;
            requestSwapButton.innerText = "Request Swap";
        }
    });
}


// --- User List and Profile Modal Logic ---

/**
 * Fetches the public user directory and renders it.
 */
function loadUserDirectory(currentUserId) {
    const userListContainer = document.getElementById('userListContainer');
    if (!userListContainer) return;

    // Path to the PUBLIC user directory
    const usersCollectionRef = collection(db, `artifacts/${appId}/public/data/user_directory`);
    const q = query(usersCollectionRef);

    onSnapshot(q, async (snapshot) => {
        // --- FIX: Clear the container before re-rendering ---
        userListContainer.innerHTML = ''; 
        
        const users = [];
        snapshot.forEach((doc) => {
            // Add all users EXCEPT the current one
            if (doc.id !== currentUserId) {
                const userData = doc.data();
                users.push({ id: doc.id, ...userData });
                usersDirectory[doc.id] = { firstName: userData.firstName, lastName: userData.lastName }; // Cache
            }
        });

        // Use Promise.all to check swap status for all users in parallel
        const userPromises = users.map(async (user) => {
            const isSwapped = await checkSwapStatus(user.id);
            const statusBadge = isSwapped 
                ? `<span class="ml-auto px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Swapped</span>`
                : '';

            // --- MODIFICATION: Render skill pills (Offering) ---
            const skills = user.skillsOffering || [];
            // We use the existing 'skill-pill' class but override the padding/font size with Tailwind's '!' modifier to make them smaller for the card.
            const skillsHtml = skills.length > 0
                ? `<div class="flex flex-wrap gap-1 mt-2">
                     ${skills.slice(0, 3).map(skill => // Only show first 3 skills
                        `<span class="skill-pill !text-xs !font-medium !py-0.5 !px-2">${skill}</span>`
                     ).join('')}
                     ${skills.length > 3 ? `<span class="text-xs text-gray-500 mt-1 ml-1">+${skills.length - 3} more</span>` : ''}
                   </div>`
                : '<p class="text-xs text-gray-500 mt-1">No skills offered.</p>'; // Fallback
            // --- END MODIFICATION ---

            return `
                <button data-userid="${user.id}" class="user-profile-button w-full text-left p-4 bg-white hover:bg-gray-50 rounded-lg shadow transition duration-150 flex flex-col items-start">
                    <div class="flex w-full items-center">
                        <i class="fas fa-user-circle text-gray-400 text-2xl mr-3"></i>
                        <span class="font-medium text-lg text-primary-600">${user.firstName} ${user.lastName}</span>
                        ${statusBadge}
                    </div>
                    ${skillsHtml}
                </button>
            `;
        });
        
        // Wait for all badges to be determined
        const userHtml = await Promise.all(userPromises);

        // Render the list
        if (userHtml.length === 0) {
            userListContainer.innerHTML = `<p class="text-gray-500 col-span-full">No other users have joined yet.</p>`;
            return;
        }

        userListContainer.innerHTML = userHtml.join('');

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
 * Renders skill pills into a given container.
 */
function renderSkillsToModal(container, skills, type = 'offering') {
    if (!container) return;

    const pillClass = type === 'seeking' ? 'skill-pill skill-pill-seeking' : 'skill-pill';
    
    if (!skills || skills.length === 0) {
        const message = type === 'seeking' ? 'No skills sought.' : 'No skills offered.';
        container.innerHTML = `<p class="text-gray-500 text-sm">${message}</p>`;
        return;
    }
    
    container.innerHTML = skills.map(skill => 
        `<span class="${pillClass}">${skill}</span>`
    ).join('');
}


/**
 * Renders verification links into the modal.
 */
function renderLinksToModal(container, links) {
    if (!container) return;
    
    const { linkedIn, gitHub, portfolio } = links;
    let hasLinks = false;
    let html = '';

    if (linkedIn) {
        hasLinks = true;
        html += `
            <a href="${linkedIn}" target="_blank" rel="noopener noreferrer" class="flex items-center p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                <i class="fab fa-linkedin text-xl text-[#0077B5] w-6 text-center"></i>
                <span class="ml-2 text-sm font-medium text-gray-700 truncate">${linkedIn.replace('https://www.', '')}</span>
            </a>
        `;
    }
    if (gitHub) {
        hasLinks = true;
        html += `
            <a href="${gitHub}" target="_blank" rel="noopener noreferrer" class="flex items-center p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                <i class="fab fa-github text-xl text-[#333] w-6 text-center"></i>
                <span class="ml-2 text-sm font-medium text-gray-700 truncate">${gitHub.replace('https://www.', '')}</span>
            </a>
        `;
    }
    if (portfolio) {
        hasLinks = true;
        html += `
            <a href="${portfolio}" target="_blank" rel="noopener noreferrer" class="flex items-center p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                <i class="fas fa-globe text-xl text-gray-500 w-6 text-center"></i>
                <span class="ml-2 text-sm font-medium text-gray-700 truncate">${portfolio.replace('https://www.', '')}</span>
            </a>
        `;
    }

    if (hasLinks) {
        container.innerHTML = html;
        container.parentElement.classList.remove('hidden'); // Show the whole section
    } else {
        container.innerHTML = '';
        container.parentElement.classList.add('hidden'); // Hide the section if no links
    }
}


/**
 * Fetches a specific user's PRIVATE profile and shows it in the modal.
 */
async function showUserProfile(userId) {
    // Set receiver ID for the swap button
    currentReceiverId = userId;
    
    // 1. Get modal elements
    const nameEl = document.getElementById('modalUserName');
    const emailEl = document.getElementById('modalUserEmail');
    const bioEl = document.getElementById('modalUserBio');
    const swapMsgDiv = document.getElementById('swapRequestMessage');
    const skillOfferEl = document.getElementById('modalSkillOfferContainer');
    const skillSeekEl = document.getElementById('modalSkillSeekContainer');
    const linksEl = document.getElementById('modalUserLinksContainer'); // Get links container

    // Reset message and button state
    if (swapMsgDiv) swapMsgDiv.classList.add('hidden');
    if (requestSwapButton) {
        requestSwapButton.disabled = false;
        requestSwapButton.innerText = "Request Swap";
        // Ensure button is visible before conditional checks
        requestSwapButton.classList.remove('hidden'); 
    }

    // 1b. Show modal with loading state
    nameEl.innerText = "Loading...";
    emailEl.innerText = "Loading...";
    bioEl.innerText = "Loading...";
    if (skillOfferEl) skillOfferEl.innerHTML = `<p class="text-gray-500 text-sm">Loading skills...</p>`;
    if (skillSeekEl) skillSeekEl.innerHTML = `<p class="text-gray-500 text-sm">Loading skills...</p>`;
    if (linksEl) {
         linksEl.innerHTML = `<p class="text-gray-500 text-sm">Loading links...</p>`;
         linksEl.parentElement.classList.remove('hidden'); // Show section
    }
    
    userModalBackdrop.classList.remove('hidden');
    userModal.classList.remove('hidden');

    // 2. Fetch the user's *PUBLIC* and *PRIVATE* profile data 
    const publicDocRef = doc(db, `artifacts/${appId}/public/data/user_directory`, userId);
    const privateDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/info`);

    try {
        const [publicDoc, privateDoc] = await Promise.all([getDoc(publicDocRef), getDoc(privateDocRef)]);

        if (!publicDoc.exists() || !privateDoc.exists()) {
            console.error("No complete profile data found for this user.");
            nameEl.innerText = "Error";
            bioEl.innerText = "Could not load user profile.";
            emailEl.innerText = "N/A";
            return;
        }
        
        const publicData = publicDoc.data();
        const privateData = privateDoc.data();

        // 3. Populate modal
        nameEl.innerText = `${publicData.firstName} ${publicData.lastName}`;
        emailEl.innerText = privateData.email || 'N/A'; // Email comes from private doc
        bioEl.innerText = privateData.bio || "This user has not set a bio."; // Bio comes from private doc

        // --- Render skills ---
        renderSkillsToModal(skillOfferEl, publicData.skillsOffering, 'offering');
        renderSkillsToModal(skillSeekEl, publicData.skillsSeeking, 'seeking');
        
        // --- Render Links ---
        renderLinksToModal(linksEl, publicData); // Links come from public data


        // --- Check if already swapped or pending ---
        const isSwapped = await checkSwapStatus(userId);
        
        if (isSwapped) {
            if (requestSwapButton) {
                requestSwapButton.classList.add('hidden'); // Hide the button
                showRequestMessage("You have successfully exchanged skills with this user. Swapped!", false);
            }
            return; 
        }

        // 4. Check if a pending request already exists to disable the button
        const requestsCollectionRef = collection(db, `artifacts/${appId}/public/data/swap_requests`);
        const q = query(
            requestsCollectionRef,
            where("senderId", "==", currentUserId),
            where("receiverId", "==", userId),
            where("status", "==", "pending")
        );
        const pendingSnap = await getDocs(q);
        
        if (!pendingSnap.empty) {
            if (requestSwapButton) {
                requestSwapButton.disabled = true;
                requestSwapButton.innerText = "Pending Request Sent";
                showRequestMessage("You have a pending request with this user.", false);
            }
        }


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
    const closeModal = () => {
        userModalBackdrop.classList.add('hidden');
        userModal.classList.add('hidden');
    };

    const closeBtn = document.getElementById('closeUserModal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (userModalBackdrop) userModalBackdrop.addEventListener('click', closeModal);
}


// --- Main logic to run on page load ---
(async () => {
  const user = await getInitialUser();

  if (user) {
    // The user is signed in.
    currentUserId = user.uid; 
    
    // --- Initial Welcome Message ---
    const docRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/info`); 
    getDoc(docRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const welcomeEl = document.getElementById('welcomeMessage');
          if (welcomeEl) {
             welcomeEl.innerText = `Welcome, ${userData.firstName || 'User'}!`;
          }
        } 
      })
      .catch((error) => {
        console.error("Error getting user document:", error);
      });
      
    // --- Load Features ---
    loadUserDirectory(currentUserId);
    listenForSwapRequests(currentUserId); // Incoming pending requests
    listenForAcceptedSwaps(currentUserId); // Outgoing accepted/rejected requests
    setupModalClose();
    
    // --- Toggle Notification Area Listener ---
    if (notificationBell) {
        notificationBell.addEventListener('click', () => {
            notificationArea.classList.toggle('hidden');
        });
    }
    
    // --- Toggle Swapped/All Users View Listener (NEW) ---
    if (swappedUsersButton) {
        swappedUsersButton.addEventListener('click', () => {
            // New logic: Only toggle the dropdown, the main view remains 'all'
            toggleSwappedUsersDropdown(currentUserId);
        });
        
        // Close dropdown when clicking outside
        document.body.addEventListener('click', (e) => {
            if (swappedUsersDropdownMenu && !swappedUsersDropdownMenu.classList.contains('hidden')) {
                if (!swappedUsersButton.contains(e.target) && !swappedUsersDropdownMenu.contains(e.target)) {
                    swappedUsersDropdownMenu.classList.add('hidden');
                }
            }
        });
        
        // Initial view setup: Always show 'all' users initially
        toggleView('all');
    }


  } else {
    // User is signed out
    console.log("Dashboard: User is not logged in. Redirecting to login page.");
    window.location.href = 'index.html'; 
  }
})(); // Immediately invoke the async function


// --- Logout Button Listener ---
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      signOut(auth)
        .then(() => {
          console.log("Sign-out successful.");
          window.location.href = 'index.html'; 
        })
        .catch((error) => {
          console.error('Error Signing out:', error);
        });
    });
}

