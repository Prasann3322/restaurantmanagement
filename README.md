# 🥛 Good Good Dairy Kitchen Console & Billing System

An elegant, fully-featured, full-stack restaurant management platform designed for "Good Good Dairy". This application includes a digital kitchen manager, billing console, table manager, and interactive QR-based customer ordering portal. 

It is built with **React**, **TypeScript**, **Tailwind CSS**, **Vite**, **Express**, and provides premium real-time cloud sync with **Supabase/Firebase** and **Gemini AI** integrations.

---

## ✨ Key Features

- **📱 Customer Self-Ordering Portal**:
  - Direct QR-code simulator for tables.
  - Interactive menu browsing across categories.
  - Portion selection (Half or Full portion support) with automated price calculations.
  - Real-time order progress monitoring (Pending ➜ Preparing ➜ Completed).

- **💼 Admin & Billing Dashboard**:
  - **Direct Counter / Manager Bill Creation**: Select multiple food items, custom quantities, add special preparation instructions, and add custom unlisted quick items.
  - **Portion Handling**: Allows managers to specify Half or Full plate portions for dishes or quickly click standard additions.
  - **Table & QR Code Manager**: Seamlessly generate, customize, download, or test unique Table QR codes.
  - **Live Financial Reports**: Track daily revenue, order volume, and category stats via rich visualizations.
  - **Printable Invoices**: Clean, client-ready, downloadable PDF bills generated instantly via `jsPDF`.

- **🍳 Kitchen Management Console**:
  - Active audio chime alerts when new customer orders are received.
  - Visual ticket order queue tracking preparation times.
  - Toggle and progress status cards (Pending, Preparing, Completed).

- **🤖 Intelligent Core APIs**:
  - **Gemini-3.5-Flash Vector Illustrator**: Automatically generates custom, high-fidelity SVG graphic illustrations of dishes on-the-fly.
  - **Gourmet Fallback Database**: Embedded intelligent keyword-matching algorithm that maps dish names to gorgeous high-resolution food photography if API keys are unset.
  - **Zero-Config Standalone Capability**: Intelligent mock database engine redirects Supabase/Firebase writes to client `localStorage` if environment credentials aren't defined. Runs flawlessly on static web hosts (Vercel, GitHub Pages, Netlify) out-of-the-box!

---

## 🛠️ Tech Stack & Dependencies

- **Frontend**: React (v19), TypeScript, Tailwind CSS (v4), Motion (v12) for fluid UI/UX.
- **Backend & Middleware**: Node.js, Express (API routes & server-side Vite middleware proxy).
- **Database & Sync**: Supabase JS, Firebase, or in-browser `localStorage` database virtual layer.
- **Assets & Icons**: `lucide-react` for beautiful UI icons.
- **AI Engine**: `@google/genai` model `gemini-3.5-flash` for vector generation.
- **PDF Invoicing**: `jspdf` for pixel-perfect bills.
- **Mailing Utility**: `nodemailer` for dispatcher OTP authentication reset codes.

---

## 🚀 Local Development

To run this project locally in VS Code or any other environment, follow these steps:

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher) and **npm** installed.

### 2. Install Dependencies
Clone/download the repository, open a terminal in the root folder, and run:
```bash
npm install
```

### 3. Setup Environment Variables (Optional)
Copy `.env.example` to `.env` and fill in any API keys or SMTP configuration:
```bash
cp .env.example .env
```
*(If left blank or unset, the application automatically triggers fallback engines, ensuring 100% features remain operational inside Mock offline mode.)*

### 4. Run Development Server
Start the Express API server combined with Vite-powered frontend middleware:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 5. Build for Production
To bundle the frontend assets and compile the TypeScript backend server:
```bash
npm run build
```
This produces a production-ready client bundle in `dist/` and a self-contained Node backend bundle at `dist/server.cjs`.

### 6. Start Production Server
Run the compiled full-stack server:
```bash
npm run start
```

---

## 📦 Deployment to GitHub Pages / Static Hosts

This application is engineered with a **dual-runtime fallback layer**:
1. If uploaded to a static deployment provider (such as **GitHub Pages**, **Vercel** static hosting, or **Netlify**):
   - The React single-page app (SPA) executes entirely in-browser.
   - Database reads/writes failover automatically to the high-performance local virtual database inside your browser's `localStorage` (fully preserving custom menus, tables, sales, and analytics across page refreshes!).
   - Dish image creators fall back to the premium local Unsplash gourmet keyword database.
2. To compile just the static client build, run `npm run build` and deploy the output of the `/dist` directory.

---

## 📂 Project Structure

```text
├── .env.example         # Example configuration credentials
├── .gitignore           # Excludes local artifacts, node_modules, & credentials
├── package.json         # Builds scripts and complete list of library dependencies
├── tsconfig.json        # TypeScript compile setup
├── vite.config.ts       # React-Vite and Tailwind bundle pipelines
├── server.ts            # Node-Express Backend APIs (OTP, Gemini illustrations, Static asset serv)
├── src/
│   ├── main.tsx         # Application entry point
│   ├── App.tsx          # App Router and Dispatcher (Admin, Kitchen, Customer view modes)
│   ├── index.css        # Tailwind imports and theme variables
│   ├── types.ts         # Shared TypeScript models (Order, MenuItem, Table)
│   ├── mockData.ts      # Fresh initial database seed values
│   ├── supabase.ts      # Cloud DB client & automatic localStorage fallback engine
│   └── components/
│       ├── AdminDashboard.tsx  # Multi-dish billing, QR codes, financial analytics
│       ├── KitchenConsole.tsx  # Active tickets manager & chime notification loops
│       └── CustomerPortal.tsx  # Customer self-ordering & menu browser portal
```

Developed with care for **Good Good Dairy**! 🥛✨
