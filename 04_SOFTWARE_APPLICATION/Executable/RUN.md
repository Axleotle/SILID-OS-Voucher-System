# Quick Run Guide (Under 10 Minutes)

This guide walks you through launching the standalone SILID Voucher Service.  
**No database installation is required** — the application features an automatic **Zero-Dependency In-Memory Mock Mode** that allows complete demonstration even if you don't have Docker, Supabase, or PostgreSQL installed!

---

## 1. Prerequisites (What You Need Installed)

To run this application, **only ONE tool is required**:
- **Node.js (v18.17+ or v20+)**: Download and run the official installer from [https://nodejs.org](https://nodejs.org) (choose the **LTS** version).
  - *Note:* Node.js includes `npm` automatically.
  - *Troubleshooting:* If you just installed Node.js, restart your terminal or Command Prompt so your system recognizes the `node` and `npm` commands.

### What You DO NOT Need to Install:
- ❌ **You DO NOT need Supabase CLI** (it automatically falls back to in-memory mode).
- ❌ **You DO NOT need Docker or Docker Desktop**.
- ❌ **You DO NOT need PostgreSQL or MySQL**.
- ❌ **You DO NOT need to configure any cloud accounts**.

---

## 2. Fast Launch Options

### Option A: 1-Click Automated Script (Easiest)

#### On Windows:
1. Open the folder `04_SOFTWARE_APPLICATION/Executable/` in Windows File Explorer.
2. Double-click [`start.bat`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Executable/start.bat).
3. The script will automatically:
   - Check for Node.js.
   - Create your `.env` configuration file if missing.
   - Install dependencies (`npm install`).
   - Detect that Supabase isn't installed and launch in **Zero-Setup Mock Mode**.
   - Start the local web server at `http://localhost:3000`.

#### On macOS / Linux:
Open a terminal in the project directory and run:
```bash
cd 04_SOFTWARE_APPLICATION/Executable
chmod +x start.sh
./start.sh
```

---

### Option B: Manual CLI Launch (Terminal / Command Prompt)

If you prefer running commands manually:
```bash
# 1. Navigate to the Source_Code directory
cd "04_SOFTWARE_APPLICATION/Source_Code"

# 2. Copy the sample environment file (Windows PowerShell / Bash)
cp .env.example .env
# (or in Windows Command Prompt: copy .env.example .env)

# 3. Install dependencies
npm install

# 4. Start the server
npm run dev
```

---

## 3. Database Execution Modes (For Testers)

The application automatically chooses the best database mode:

### Mode 1: Zero-Setup In-Memory Mode (Default / When You Don't Have Supabase)
- **Zero installation required.** If no remote Supabase URL is supplied in `.env` and Supabase CLI isn't installed, the service boots in a self-contained in-memory mock engine.
- Pre-loaded with demo staff (`founder@silid.ph`, `staff@silid.ph`), active templates (20% study pass discount), and seeded claim tickets (`CT-YTR-003`, etc.).
- Allows full end-to-end testing: student registration, staff review/approval, QR generation, mobile QR scanning, atomic redemption, and ledger reversals.

### Mode 2: Free Supabase Cloud Project (Optional / Online Production Testing)
If you want to test against a live remote PostgreSQL database:
1. Create a free project at [https://supabase.com](https://supabase.com).
2. Go to **SQL Editor** in the Supabase Dashboard and paste the SQL files from [`Database/migrations/`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Database/migrations) in order:
   - `001_initial_schema.sql`
   - `002_support_tables.sql`
   - `003_rls_policies.sql`
   - `004_atomic_redeem_function.sql`
   - and [`Database/seed.sql`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Database/seed.sql)
3. Copy your project's URL and keys into `04_SOFTWARE_APPLICATION/Source_Code/.env`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   ```

### Mode 3: Local Supabase CLI (Optional / If Docker is already installed)
If you already use Docker and Supabase CLI:
```bash
supabase start
supabase db reset
supabase db execute -f ../Database/seed.sql
```

---

## 4. Verification URLs & Demo Logins

Once the server is running on `http://localhost:3000`:

| Portal / Endpoint | URL | Purpose |
|---|---|---|
| **Staff Portal** | [http://localhost:3000/staff](http://localhost:3000/staff) | Dashboard, batches, templates, review, scanning |
| **Silid OS Companion Simulator** | [http://localhost:3000/staff/simulator](http://localhost:3000/staff/simulator) | **Simulates client's Silid OS** (Check-In, Smart Billing, Ledger) |
| **Claim Registration Demo** | [http://localhost:3000/register/CT-YTR-003](http://localhost:3000/register/CT-YTR-003) | Student claim card registration page |
| **Service Health Probe** | [http://localhost:3000/api/health](http://localhost:3000/api/health) | Uptime & latency check |

### Staff Logins:
- **Founder Admin:** `founder@silid.ph` / `password123`
- **Frontdesk Staff:** `staff@silid.ph` / `password123`

---

## 5. Companion System Operating Modes

This service is designed with two operating modes to guarantee smooth demonstration without needing the client's proprietary Silid OS installed:

1. **Mode A: Local Demonstration Mode (Built-in Fake Companion Simulator)**
   - No external apps or databases needed.
   - Use the built-in **[Silid OS Companion Simulator](http://localhost:3000/staff/simulator)** to test Start Session, Smart Billing, and Ledger synchronization locally without errors.
2. **Mode B: Production Companion Mode (Real Silid OS Integration)**
   - Used for live deployment at SILID Malolos study hub. Connects via versioned REST APIs (`/api/v1/...`) and signed webhooks.
   - Detailed integration steps in [`COMPANION_MODE_GUIDE.md`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/COMPANION_MODE_GUIDE.md).

---

## 6. Automated Tests

Run the test suite covering pricing calculations, PHT business-day boundaries, and concurrency locking:
```bash
cd 04_SOFTWARE_APPLICATION/Source_Code
npm test
```

---

## 7. Demonstration & Testing Guide

For a full step-by-step test script with 18 manual scenarios covering every feature, role, and edge case, refer to:
👉 **[`TEST_CASES.md`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/TEST_CASES.md)**
