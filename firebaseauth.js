// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    setDoc, 
    doc,
    setLogLevel
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


/**
 * Helper function to show success/error messages in the form.
 */
function showMessage(message, divId) {
    var messageDiv = document.getElementById(divId);
    if (!messageDiv) return; // Guard clause

    // Determine if it's an error message
    if (message.toLowerCase().includes('error') || 
        message.toLowerCase().includes('incorrect') || 
        message.toLowerCase().includes('invalid') ||
        message.toLowerCase().includes('exists')) {
        messageDiv.className = "messageDiv bg-red-100 text-red-700 block";
    } else {
        messageDiv.className = "messageDiv bg-green-100 text-green-700 block";
    }

    messageDiv.innerHTML = message;
    messageDiv.style.opacity = 1;
    setTimeout(function () {
        messageDiv.style.opacity = 0;
    }, 4000);
}

// --- Sign Up Logic ---
const signUpButton = document.getElementById('submitSignUp');
if (signUpButton) {
    signUpButton.addEventListener('click', (event) => {
        event.preventDefault();
        
        // 1. Get all form values
        const email = document.getElementById('rEmail').value;
        const password = document.getElementById('rPassword').value;
        const firstName = document.getElementById('fName').value;
        const lastName = document.getElementById('lName').value;
        const bio = document.getElementById('rBio').value; // Get the bio

        // Basic validation
        if (!email || !password || !firstName || !lastName || !bio) {
            showMessage('Error: All fields are required.', 'signUpMessage');
            return;
        }

        // 2. Create the user in Firebase Auth
        createUserWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;

                // 3. Define the PRIVATE user profile data
                const privateUserData = {
                    email: email,
                    firstName: firstName,
                    lastName: lastName,
                    bio: bio // Save the bio
                };
                
                // 4. Define the PUBLIC user directory data
                const publicUserData = {
                    firstName: firstName,
                    lastName: lastName
                };

                // 5. Set up document references
                // Path for PRIVATE data (only the user can read/write)
                const privateDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/info`);
                
                // Path for PUBLIC data (everyone can read)
                const publicDocRef = doc(db, `artifacts/${appId}/public/data/user_directory`, user.uid);

                try {
                    // 6. Write both documents
                    await setDoc(privateDocRef, privateUserData);
                    await setDoc(publicDocRef, publicUserData);

                    // 7. Success!
                    showMessage('Account Created Successfully!', 'signUpMessage');
                    
                    // Redirect to the main dashboard
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000); // Short delay so user can see message

                } catch (dbError) {
                    console.error("Error writing document(s):", dbError);
                    showMessage('Error: Could not save profile.', 'signUpMessage');
                }
            })
            .catch((authError) => {
                // 8. Handle Auth errors
                const errorCode = authError.code;
                if (errorCode == 'auth/email-already-in-use') {
                    showMessage('Error: Email Address Already Exists!', 'signUpMessage');
                } else if (errorCode == 'auth/weak-password') {
                    showMessage('Error: Password is too weak.', 'signUpMessage');
                } else {
                    console.error("Auth Error:", authError);
                    showMessage('Error: Unable to create user.', 'signUpMessage');
                }
            });
    });
}

// --- Sign In Logic ---
const signInButton = document.getElementById('submitSignIn');
if (signInButton) {
    signInButton.addEventListener('click', (event) => {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showMessage('Error: Email and Password are required.', 'signInMessage');
            return;
        }

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Sign in successful
                showMessage('Login is successful!', 'signInMessage');
                
                // Redirect to the main dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000); // Short delay so user can see message
            })
            .catch((error) => {
                // Handle Sign In errors
                const errorCode = error.code;
                if (errorCode === 'auth/invalid-credential') {
                    showMessage('Error: Incorrect Email or Password.', 'signInMessage');
                } else {
                    console.error("Sign In Error:", error);
                    showMessage('Error: Account does not exist or login failed.', 'signInMessage');
                }
            });
    });
}

