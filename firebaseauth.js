 // Import the functions you need from the SDKs you need
 import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
 import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
 import { getFirestore, setDoc, doc, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

 // This is a fallback app ID. In a real environment, this would be injected.
 // For your hardcoded config, we can just use your project ID.
 const appId = firebaseConfig.projectId || 'default-app-id';

/**
 * Displays a message to the user in a specified div.
 * This version uses the Tailwind classes from index.html for styling.
 * @param {string} message The message to display.
 * @param {string} divId The ID of the element to show the message in.
 * @param {boolean} [isError=true] Whether the message is an error (red) or success (green).
 */
 function showMessage(message, divId, isError = true) {
    var messageDiv = document.getElementById(divId);
    if (!messageDiv) {
        console.error("Message div not found:", divId);
        return;
    }
    
    // Set style based on error or success
    messageDiv.innerText = message;
    messageDiv.className = 'messageDiv'; // Reset classes
    if (isError) {
        messageDiv.classList.add('bg-red-100', 'text-red-700');
    } else {
        messageDiv.classList.add('bg-green-100', 'text-green-700');
    }

    messageDiv.classList.remove('hidden');
    messageDiv.style.opacity = 1;
    
    setTimeout(function(){
        messageDiv.style.opacity = 0;
        setTimeout(() => messageDiv.classList.add('hidden'), 500); // Hide after fade
    }, 5000);
 }
 
 const signUp=document.getElementById('submitSignUp');
 if (signUp) {
    signUp.addEventListener('click', (event)=>{
        event.preventDefault();
        const email=document.getElementById('rEmail').value;
        const password=document.getElementById('rPassword').value;
        const firstName=document.getElementById('fName').value;
        const lastName=document.getElementById('lName').value;
        const bio = document.getElementById('rBio').value;

        if (!firstName || !lastName || !email || !password || !bio) {
             showMessage('Please fill out all fields.', 'signUpMessage', true);
             return;
        }

        createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential)=>{
            const user=userCredential.user;
            
            const userData={
                email: email,
                firstName: firstName,
                lastName:lastName,
                bio: bio, 
                createdAt: new Date().toISOString()
            };
            
            showMessage('Account Created Successfully! Redirecting...', 'signUpMessage', false);
            
            // Use a structured path. Using `appId` here for consistency.
            const docRef=doc(db, `artifacts/${appId}/users/${user.uid}/profile/info`);
            
            setDoc(docRef,userData)
            .then(()=>{
                window.location.href='dashboard.html';
            })
            .catch((error)=>{
                console.error("error writing document", error);
                showMessage(`Error saving profile: ${error.message}`, 'signUpMessage', true);
            });
        })
        .catch((error)=>{
            const errorCode=error.code;
            if(errorCode=='auth/email-already-in-use'){
                showMessage('Email Address Already Exists!', 'signUpMessage', true);
            } else if (errorCode == 'auth/weak-password') {
                showMessage('Password is too weak (must be at least 6 characters).', 'signUpMessage', true);
            } else {
                showMessage(`Error: ${error.message}`, 'signUpMessage', true);
            }
        });
    });
}

 const signIn=document.getElementById('submitSignIn');
 if (signIn) {
    signIn.addEventListener('click', (event)=>{
        event.preventDefault();
        const email=document.getElementById('email').value;
        const password=document.getElementById('password').value;

        if (!email || !password) {
            showMessage('Please enter both email and password.', 'signInMessage', true);
            return;
        }

        signInWithEmailAndPassword(auth, email,password)
        .then((userCredential)=>{
            showMessage('Login is successful! Redirecting...', 'signInMessage', false);
            const user=userCredential.user;
            localStorage.setItem('loggedInUserId', user.uid);
            
            window.location.href='dashboard.html';
        })
        .catch((error)=>{
            const errorCode=error.code;
            if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found') {
                showMessage('Incorrect Email or Password.', 'signInMessage', true);
            } else {
                showMessage(`Error: ${error.message}`, 'signInMessage', true);
            }
        });
    });
}

