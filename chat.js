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
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    addDoc,
    serverTimestamp,
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Config ---
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

// Get the app ID
const appId = firebaseConfig.projectId || 'default-app-id';

// --- Global State ---
let currentUserId = null;
let currentChatPartnerId = null;
let usersDirectory = {}; // Cache user names (id -> {firstName, lastName})
let unsubscribeMessages = null; // To detach the real-time message listener

// --- Element References ---
const elements = {
    logoutBtn: document.getElementById('logout'),
    contactList: document.getElementById('contactList'),
    contactsLoading: document.getElementById('contactsLoading'),
    chatHeader: document.getElementById('chatHeader'),
    chatWithUserName: document.getElementById('chatWithUserName'),
    chatMessages: document.getElementById('chatMessages'),
    chatInputContainer: document.getElementById('chatInputContainer'),
    messageForm: document.getElementById('messageForm'),
    messageInput: document.getElementById('messageInput')
};

/**
 * Scrolls the chat message container to the bottom.
 */
function scrollToBottom() {
    if (elements.chatMessages) {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
}

/**
 * Formats a Firebase timestamp into a readable time (e.g., 10:30 AM).
 */
function formatTimestamp(timestamp) {
    if (!timestamp) {
        return "Sending...";
    }
    const date = timestamp.toDate();
    return date.toLocaleTimeString(navigator.language, {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
}

/**
 * Fetches user data from the public directory and caches it.
 */
async function getUserData(userId) {
    if (usersDirectory[userId]) {
        return usersDirectory[userId];
    }
    
    const docRef = doc(db, `artifacts/${appId}/public/data/user_directory`, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        usersDirectory[userId] = data; // Cache it
        return data;
    }
    return null;
}

/**
 * Renders a single message into the chat window.
 */
function renderMessage(messageData) {
    const isSender = messageData.senderId === currentUserId;
    const timestamp = formatTimestamp(messageData.timestamp);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex items-end space-x-2 ${isSender ? 'self-end' : 'self-start'}`;
    
    const userIcon = `<i class="fas fa-user-circle text-3xl ${isSender ? 'text-primary-500' : 'text-gray-400'}"></i>`;
    const messageBubble = `
        <div class="p-3 rounded-lg max-w-xs md:max-w-md ${isSender ? 'bg-primary-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-tl-none'}">
            <p class="text-sm">${messageData.text}</p>
            <span class="text-xs ${isSender ? 'text-blue-100' : 'text-gray-500'} block text-right mt-1">${timestamp}</span>
        </div>
    `;

    if (isSender) {
        messageDiv.innerHTML = messageBubble + userIcon;
    } else {
        messageDiv.innerHTML = userIcon + messageBubble;
    }
    
    elements.chatMessages.appendChild(messageDiv);
}

/**
 * Loads all messages for the currently selected chat partner.
 */
function loadMessages(partnerId) {
    if (!currentUserId) return;

    // Detach any previous listener
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    // Create a unique, sorted chat room ID
    const chatRoomId = [currentUserId, partnerId].sort().join('_');
    const messagesRef = collection(db, `artifacts/${appId}/public/data/chat_rooms/${chatRoomId}/messages`);
    const q = query(messagesRef, orderBy("timestamp"));

    elements.chatMessages.innerHTML = ''; // Clear existing messages

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                renderMessage(change.doc.data());
            }
        });
        scrollToBottom();
    }, (error) => {
        console.error("Error loading messages: ", error);
        elements.chatMessages.innerHTML = '<p class="text-red-500">Error loading messages.</p>';
    });
}

/**
 * Handles sending a new message.
 */
async function handleSendMessage(e) {
    e.preventDefault();
    if (!currentChatPartnerId || !currentUserId) return;
    
    const messageText = elements.messageInput.value.trim();
    if (messageText === "") return;

    const chatRoomId = [currentUserId, currentChatPartnerId].sort().join('_');
    const messagesRef = collection(db, `artifacts/${appId}/public/data/chat_rooms/${chatRoomId}/messages`);

    try {
        await addDoc(messagesRef, {
            text: messageText,
            senderId: currentUserId,
            receiverId: currentChatPartnerId,
            timestamp: serverTimestamp()
        });
        elements.messageInput.value = ''; // Clear input
        scrollToBottom();
    } catch (error) {
        console.error("Error sending message: ", error);
    }
}

/**
 * Selects a chat, updates UI, and loads messages.
 */
function selectChat(partnerId, partnerName) {
    currentChatPartnerId = partnerId;

    // Update chat header
    elements.chatWithUserName.innerText = partnerName;
    elements.chatHeader.classList.remove('hidden');
    
    // Show chat input
    elements.chatInputContainer.classList.remove('hidden');
    
    // Visually update contact list
    document.querySelectorAll('#contactList button').forEach(btn => {
        if (btn.dataset.userid === partnerId) {
            btn.classList.add('bg-primary-50', 'border-r-4', 'border-primary-500');
        } else {
            btn.classList.remove('bg-primary-50', 'border-r-4', 'border-primary-500');
        }
    });

    // Load the messages
    loadMessages(partnerId);
}

/**
 * Fetches all users with an "accepted" swap status.
 */
async function loadSwapBuddies() {
    if (!currentUserId) return;
    
    elements.contactsLoading.classList.remove('hidden');
    elements.contactList.innerHTML = ''; // Clear old contacts
    
    try {
        const requestsCollectionRef = collection(db, `artifacts/${appId}/public/data/swap_requests`);
        
        // Query 1: Where current user is the sender
        const q1 = query(
            requestsCollectionRef,
            where("senderId", "==", currentUserId),
            where("status", "==", "accepted")
        );
        
        // Query 2: Where current user is the receiver
        const q2 = query(
            requestsCollectionRef,
            where("receiverId", "==", currentUserId),
            where("status", "==", "accepted")
        );

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        
        const buddyIds = new Set();
        snap1.forEach(doc => buddyIds.add(doc.data().receiverId));
        snap2.forEach(doc => buddyIds.add(doc.data().senderId));

        if (buddyIds.size === 0) {
            elements.contactsLoading.innerText = 'No swap buddies found. Go swap!';
            return;
        }

        // Fetch user data for all buddies
        const buddyPromises = Array.from(buddyIds).map(id => getUserData(id));
        const buddies = await Promise.all(buddyPromises);

        elements.contactsLoading.classList.add('hidden');
        
        // Render contact list
        buddies.forEach((buddyData, index) => {
            if (!buddyData) return; // Skip if user data failed to load
            
            const partnerId = Array.from(buddyIds)[index];
            const partnerName = `${buddyData.firstName} ${buddyData.lastName}`;
            
            const contactButton = document.createElement('button');
            contactButton.className = "flex items-center w-full text-left p-4 space-x-3 hover:bg-gray-50 transition duration-150";
            contactButton.dataset.userid = partnerId;
            
            contactButton.innerHTML = `
                <i class="fas fa-user-circle text-gray-400 text-3xl"></i>
                <div>
                    <h3 class="font-semibold text-gray-800">${partnerName}</h3>
                    <!-- <p class="text-sm text-gray-500 truncate">Last message...</p> -->
                </div>
            `;
            
            contactButton.addEventListener('click', () => selectChat(partnerId, partnerName));
            elements.contactList.appendChild(contactButton);
        });

    } catch (error) {
        console.error("Error loading swap buddies:", error);
        elements.contactsLoading.innerText = 'Error loading contacts.';
    }
}

/**
 * Hides chat UI until a contact is selected.
 */
function initializeChatUI() {
    elements.chatHeader.classList.add('hidden');
    elements.chatInputContainer.classList.add('hidden');
    elements.chatMessages.innerHTML = `
        <div class="flex flex-col justify-center items-center h-full">
            <i class="fas fa-comments text-6xl text-gray-300"></i>
            <p class="text-gray-500 mt-4">Select a swap buddy to start chatting.</p>
        </div>
    `;
}

// --- Main Auth Listener ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        initializeChatUI();
        loadSwapBuddies();
    } else {
        // User is signed out
        console.log("Chat: User is not logged in. Redirecting...");
        window.location.href = 'index.html';
    }
});

// --- Event Listeners ---
if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', () => {
        signOut(auth).catch(err => console.error("Logout Error:", err));
    });
}

if (elements.messageForm) {
    elements.messageForm.addEventListener('submit', handleSendMessage);
}
