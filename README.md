# FFG — Forbes Family Group

The private members' floor for the Forbes Family Group.

**Live:** https://ffg-app.vercel.app

## Stack

- Vite 6 + React 18
- Clerk for auth (`@clerk/clerk-react`)
- lucide-react for icons
- No CSS framework — styles are inline, themed from a `DARK` / `LIGHT` token pair

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview
```

## Structure

| File | What it holds |
| --- | --- |
| `src/main.jsx` | Entry point, Clerk provider |
| `src/FFGApp.jsx` | App shell and every screen |
| `src/SignInGate.jsx` | Clerk sign-in overlay |
| `src/DesktopRail.jsx` | Left nav rail (desktop only) |
| `src/useViewport.js` | Breakpoint / frame-width hook |
| `src/persist.js` | localStorage read/write helpers |
| `src/clerkConfig.js` | Publishable key and SSO callback path |

The app runs splash → onboarding → sign-in gate → the seven tabs: Home,
Rooms, Connect, Events, Reads, Capital, You. Touch layouts get a bottom
nav; desktop gets the left rail instead.

## Auth

Clerk **development** instance (`pk_test_…`). Publishable keys are public by
design — they ship in the client bundle and only identify the instance. Dev
instances accept any origin, so no domain configuration is needed for UAT.

Override with `VITE_CLERK_PUBLISHABLE_KEY` if needed. Swap for a production
instance (`pk_live_…`) before any App Store build.

## Deployment

Vercel, connected to this repo. Pushes to `main` deploy to production
automatically; pull requests get preview deployments.

The client-facing copy runs on a dedicated AWS EC2 box (eu-west-2, London)
in its own VPC, published through its own Cloudflare tunnel:

- **App:** https://connect.navada-edge-server.uk
- **API:** https://api-connect.navada-edge-server.uk/api/health

See `OPERATIONS.md` for the full runbook.

## AWS console (sign-in required, account 491085390194)

| What | Link |
| --- | --- |
| Dashboard — every service, one page | https://eu-west-2.console.aws.amazon.com/cloudwatch/home?region=eu-west-2#dashboards/dashboard/NAVADA-All-Services |
| The Connect EC2 box (`ffg-connect`) | https://eu-west-2.console.aws.amazon.com/ec2/home?region=eu-west-2#InstanceDetails:instanceId=i-04a64edf230a7e58b |
| Everything tagged to the client | https://eu-west-2.console.aws.amazon.com/resource-groups/tag-editor/find-resources?region=eu-west-2 — filter tag `Client=ForbesFamilyGroup` |
| Budgets (incl. `FFG-Connect-ClientRebill`) | https://us-east-1.console.aws.amazon.com/billing/home#/budgets |

The dashboard is the one to bookmark: it opens with an inventory table
(EC2, Lambda, DynamoDB, S3, budgets) and live charts underneath. The
billing widget stays empty until "Receive Billing Alerts" is switched on
in Billing preferences.
