# Production Deployment Guide: Vercel + Supabase

This guide details the step-by-step deployment procedure for the SILID Voucher Service. Per architecture guidelines, this service operates in a **separate Supabase project** from Silid OS and connects only via versioned HTTP APIs.

---

## 1. Supabase Project Setup

1. **Create Project:**
   - Log into [Supabase Dashboard](https://supabase.com).
   - Click **New Project** and name it `silid-voucher-service`.
   - Select region: **Singapore (ap-southeast-1)** for lowest latency to the Philippines.

2. **Execute Migrations:**
   In the Supabase SQL Editor, run the migration scripts in sequential order:
   - `Database/migrations/001_initial_schema.sql`
   - `Database/migrations/002_support_tables.sql`
   - `Database/migrations/003_rls_policies.sql`
   - `Database/migrations/004_atomic_redeem_function.sql`
   - `Database/seed.sql` (for baseline admin accounts and templates)

3. **Retrieve Credentials:**
   Navigate to **Project Settings -> API** and copy:
   - `Project URL`
   - `anon public key`
   - `service_role secret key` (Keep confidential)

---

## 2. Vercel Deployment

1. **Push to Git:**
   Ensure the repository is committed to GitHub, GitLab, or Bitbucket.

2. **Import into Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com) -> **Add New... -> Project**.
   - Select the repository.
   - Set **Root Directory** to `04_SOFTWARE_APPLICATION/Source_Code`.
   - Select Framework Preset: **Next.js**.

3. **Configure Environment Variables in Vercel:**
   Add the following in **Settings -> Environment Variables**:

   | Variable | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://[PROJECT-ID].supabase.co` | Supabase API URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anonymous public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase service_role secret key |
   | `NEXT_PUBLIC_APP_URL` | `https://vouchers.silid.ph` | Production domain |
   | `CRON_SECRET` | `[generate-random-hex]` | Authorizes Vercel Cron requests |
   | `EMAIL_PROVIDER` | `stub` (or `resend`/`sendgrid`) | Email delivery backend |
   | `LEDGER_WEBHOOK_URL` | `https://app.silidos.ph/api/webhooks/vouchers` | Silid OS webhook endpoint |
   | `LEDGER_WEBHOOK_SECRET` | `[generate-random-secret]` | Webhook signing key |

4. **Deploy:**
   Click **Deploy**. Vercel will build and deploy the Next.js application globally with serverless edge handlers.

---

## 3. Post-Deployment Verification

1. **Verify Health Endpoint:**
   ```bash
   curl -i https://vouchers.silid.ph/api/health
   # Expected: HTTP 200 {"status":"ok","service":"silid-voucher-service",...}
   ```
2. **Generate First API Key for Silid OS:**
   - Log into `https://vouchers.silid.ph/staff/login` as Founder.
   - Go to **Admin Settings -> Generate New API Key**.
   - Copy the generated API key (e.g. `sk_live_...`) and securely provide it to the Silid OS engineering team.
3. **Verify Cron Execution:**
   Check Vercel Cron Logs at midnight PHT to confirm `/api/cron/expire-vouchers` runs without errors.
