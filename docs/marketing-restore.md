# Marketing website and admin

The website uses Supabase for existing marketing content and sign-in. Administrators are authenticated users whose existing `profiles.role` is `admin`. Both the server layout and the original content editors enforce that role; database row-level security also protects writes.

## Administration

- `/admin`: marketing dashboard
- `/admin/hero`: Hero Slider
- `/admin/news`: News & Updates
- `/admin/trainers`: Coaches / Trainers
- `/admin/pricing`: Book Cage Time pricing and Swift booking links
- `/admin/settings`: public contact details
- `/admin/memberships`: existing public membership offers
- `/admin/home`: compatibility redirect to `/admin`

The public homepage, contact page, images, memberships, SEO content, and original member/workout pages remain. `/book` redirects to the external booking URL in `pricing_settings`, with the existing Swift facility URL as fallback.

## Removed application

The custom booking client and admin shell, calendars, customers, services, billing, registration settings, staff management, booking APIs, and Stripe APIs are removed. Stripe packages are no longer installed. No Stripe account, subscription, charge, customer, or payment method is changed by this source update.

Production booking tables, database functions, policies, migration history, storage objects, user accounts, and profile roles are retained. The dependency audit found foreign keys between bookings, customers, services, staff, payments, memberships, and credit ledger records, plus the existing database `is_admin()` function referencing booking staff. Do not drop those tables or rewrite old migrations as application cleanup. Database retirement requires a separate reviewed migration and a billing dependency review.

The only new database migration creates `website_settings`, seeds the existing public contact details, and enables public reads plus writes restricted to existing profile administrators.

## Verification and deployment

Run `npm ci`, `npm run build`, and `npm start`. Run `node scripts/verify-marketing.mjs http://localhost:3000` for public content, redirects, removed API routes, and anonymous admin protection. The same script accepts the production origin. Verify signed-in editing separately using an existing administrator account.

Push the tested commit on `main` to deploy through the existing Vercel Git integration. Confirm the deployment commit, production target, ready state, and `www.grindbaseballlab.com` alias.

The Git tag `backup/before-swift-clone-removal-2026-10-28` preserves the pre-removal source. Reverting the source commit restores the previous app without deleting the additive website settings table. Database exports and storage archives are private local backup artifacts; never commit them to the repository.
