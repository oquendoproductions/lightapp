# Cloudflare Pages Token Deploy

This project can deploy Cloudflare Pages without browser OAuth by using environment variables loaded from an ignored local file.

## One-time local setup

Create:

`/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/.env.cloudflare.local`

With:

```bash
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_PAGES_PROJECT_NAME=lightapp
```

`CLOUDFLARE_PAGES_PROJECT_NAME` is optional because the deploy script defaults to `lightapp`.

## Recommended token scope

Create a Cloudflare API token that can deploy Pages for this account. At minimum, it should be able to edit Pages projects for the target account.

If Cloudflare prompts for more access during testing, add the minimum additional account-level read permission needed for the deploy to resolve the project.

## Deploy command

```bash
cd /Users/oquendoproductions/Desktop/streetlight-app/streetlight-web
npm run deploy:pages
```

The script will:

1. load `.env.cloudflare.local` if present, otherwise `.env.local`
2. run `npm run build`
3. deploy `dist` to the configured Cloudflare Pages project

## Why this fixes the blocker

OAuth login with `wrangler login` uses a localhost browser callback tied to the machine that started Wrangler. This Codex environment cannot reliably receive that callback from the local browser session. Token-based auth avoids that browser loop entirely, so deploys can run non-interactively.
