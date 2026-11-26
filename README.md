# SocialManager · Free YouTube & Instagram Automation Suite

A self-hosted, personal social media automation application with post scheduling, auto-reply rules, unified inbox, and channel management. 100% free with no PRO paywalls.

---

## 🚀 How to Run in VS Code

### Method 1: One-Click Run & Debug (F5)
1. Open VS Code.
2. Click **File** > **Open Folder...** and select `D:\social-manager`.
3. Press **`F5`** (or go to the **Run & Debug** panel on the left sidebar and click **Run Social Manager**).
4. The server will launch in the integrated terminal and run at **http://localhost:5000**.

---

### Method 2: Via VS Code Integrated Terminal
1. Open the project folder in VS Code (`File` > `Open Folder` > `D:\social-manager`).
2. Open the terminal (`Ctrl + ~` or `Terminal` > `New Terminal`).
3. Run:
   ```bash
   npm start
   ```
4. Open **http://localhost:5000** in your web browser.

---

### Development Mode (Editing Frontend with Live Reload)
If you modify frontend files in `client/src`:
1. Start the server in one terminal:
   ```bash
   npm start
   ```
2. In a second terminal, start Vite live-reload:
   ```bash
   npm run dev:client
   ```
   (Vite runs on http://localhost:5173 with hot-module reloading and proxies API calls to port 5000).
3. When ready to build production frontend:
   ```bash
   npm run build
   ```

---

## 📁 Project Architecture
```
D:\social-manager
├── .vscode/               # VS Code launch & task configurations (F5 ready)
├── server/                # Backend API & Automation Engine
│   ├── index.js           # Express app & static file server (Port 5000)
│   ├── db.js              # Native SQLite database (zero-config, stored in data/social_manager.db)
│   ├── routes/            # auth, channels, rules, posts, comments, settings
│   └── services/          # youtube.js, instagram.js, ai.js (Gemini), scheduler.js
├── client/                # React 19 + TypeScript + Vite 8 + Tailwind CSS Frontend
│   ├── src/               # Light theme UI components & views
│   └── dist/              # Compiled production build served by Express
└── package.json           # Root scripts
```
