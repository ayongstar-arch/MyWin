# 🚀 MyWin App Deployment Guide (Hostinger Cloud Startup)

This guide is specifically for **Hostinger Cloud Startup** or **Business** plans that support the **Node.js Web App** feature.

---

## 📋 Prerequisites

1.  **Hostinger Plan**: Business Web Hosting OR Cloud Startup (Enable Node.js Support).
2.  **Database**: Create a MySQL Database in hPanel.
3.  **GitHub Repo**: Your project must be pushed to GitHub.

---

## 🛠 Step 1: Prepare Your Project (Already Done)

We have already configured your project for this deployment:
*   **Build Script**: `npm run build` builds both NestJS (backend) and React (frontend).
*   **Postinstall**: Ensures the build runs automatically after `npm install`.
*   **Entry Point**: `dist/main.js`.
*   **Frontend Serving**: NestJS is configured to serve the `client_build` folder automatically.

---

## ☁️ Step 2: Deploy on Hostinger (hPanel)

1.  **Log in to hPanel** and go to **Websites**.
2.  Click **Add Website** or manage your existing domain.
3.  Select **"Node.js Web App"** (or search for Node.js in the dashboard).

### Configuration Settings:
*   **Application Root**: `public_html` (or leave default if prompted).
*   **Application Startup File**: `dist/main.js` (⚠️ IMPORTANT).
*   **Node.js Version**: Select **18** or **20**.
*   **Package Management**: Keep as `npm`.

### Source Code:
1.  Connect your **GitHub Account**.
2.  Select the **MyWin Repository**.
3.  Select the **main** branch.
4.  **Auto Deployment**: Enable this (so it updates when you push).

### Environment Variables (Create these in the Dashboard):
Go to the **Environment Variables** section (or check `.env.example`) and add:

| Key | Value |
|:--- |:--- |
| `NODE_ENV` | `production` |
| `PORT` | `3000` (or whatever Hostinger assigns, usually handled automatically but good to set) |
| `DB_HOST` | (Your MySQL Host IP) |
| `DB_USER` | (Your MySQL Username) |
| `DB_PASSWORD` | (Your MySQL Password) |
| `DB_NAME` | `mywin_db` (or whatever you created) |
| `JWT_SECRET` | (A long random string) |
| `GEMINI_API_KEY` | (Your AI Key) |
| `REDIS_URL` | (Your Upstash/Redis URL, if using) |

---

## 🚀 Step 3: Trigger Deployment

1.  Click **Create** or **Deploy**.
2.  Hostinger will now:
    *   Clone your code.
    *   Run `npm install`.
    *   Run `npm run build` (via our `postinstall` script).
    *   Start the server using `node dist/main.js`.

---

## ✅ Verification

Visit your domain (e.g., `https://mywin-app.com`).
1.  You should see the **MyWin Landing Page/Login**.
2.  Test logging in (Backend API connection).
3.  If you see "403 Forbidden" or "Internal Server Error", check the **Logs** tab in hPanel for Node.js errors.

### Troubleshooting
*   **Build Failed?** Check if `dist` folder exists via File Manager.
*   **Frontend 404?** Ensure `client_build` exists next to `dist`.
*   **Database Error?** Double check credentials in Environment Variables.

---
**Note:** Since we configured `ServeStaticModule` in NestJS, your React app is served directly by the backend at the root URL `/`.
