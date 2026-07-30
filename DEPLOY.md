
# How to Deploy Your Terminal to Firebase App Hosting

Follow these exact steps to push your code to GitHub and deploy it to Firebase.

---

### Step 1: Connect to GitHub

Open your local terminal in the project root and run:

```bash
# Initialize the repository
git init -b main

# Stage and commit all files
git add .
git commit -m "build: finalize terminal for Firebase rollout"

# Connect to your GitHub repository
# Replace <YOUR_URL> with the URL from the repo you just created on GitHub
git remote add origin <YOUR_GITHUB_REPO_URL>

# Push the code
git push -u origin main
```

---

### Step 2: Enable Firebase App Hosting

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your project: **ashley-drp-manager-2-119-42612**.
3.  In the left sidebar, go to **Build > App Hosting**.
4.  Click **Get Started** and connect the GitHub repository you just pushed to.
5.  Follow the setup wizard. **IMPORTANT:** Select the `main` branch.

---

### Step 3: Configure Environment (If Required)

Firebase App Hosting automatically handles standard Next.js builds. If your application requires specific build-time secrets or environment variables, you can add them in the Firebase Console:

1.  In the App Hosting dashboard, click on your backend.
2.  Go to the **Settings** tab.
3.  Click **Environment Variables**.
4.  Add any required keys from your local `.env`.

---

### Step 4: Billing

Firebase App Hosting requires the **Blaze (Pay-as-you-go) Plan**. Ensure your project is upgraded in the "Usage and Billing" section of the Firebase Console to avoid deployment errors.

---

### Step 5: Custom Domain

Once your rollout is "Live", go to **App Hosting > Settings** and click **Add Custom Domain** to link your official URL.
