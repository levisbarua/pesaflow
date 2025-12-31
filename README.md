# PesaFlow

## 🚀 How to Fix "Repository Not Found" & Deploy

Render cannot see your code because it hasn't been pushed to GitHub yet.

### Step 1: Initialize Git
Run these commands in your project terminal:

```bash
git init
git add .
git commit -m "Initial commit"
```

### Step 2: Create Repository on GitHub
1. Go to [GitHub.com/new](https://github.com/new).
2. Name the repository `pesaflow`.
3. Click **Create repository**.

### Step 3: Push Code
Copy the commands shown on GitHub (under "…or push an existing repository from the command line") and run them. They look like this:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pesaflow.git
git push -u origin main
```

### Step 4: Finish Render Setup
1. Go back to Render and try pasting the repo URL again (or select it from the list).
2. **Settings for Render:**
   - **Root Directory:** `server` (Important!)
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Environment Variables:**
     - `FIREBASE_SERVICE_ACCOUNT`: (Open `server/serviceAccountKey.json` locally, copy ALL text, and paste it here)
     - `MPESA_CONSUMER_KEY`: (Your Key)
     - `MPESA_CONSUMER_SECRET`: (Your Secret)
     - `MPESA_PASSKEY`: (Your Passkey)

### Step 5: Connect Frontend
Once Render is live, copy your new **Service URL** (e.g., `https://pesaflow.onrender.com`).
Update the file `services/mockMpesa.ts` in your code:

```typescript
const BACKEND_API_URL = "https://pesaflow.onrender.com";
```
