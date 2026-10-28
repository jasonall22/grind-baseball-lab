# Automatic Facebook news

Public Page posts are displayed in the existing News & Updates slider. The six most recent valid posts appear first, followed by active manual slides. Photos, paragraphs, publication dates, and links to the original Facebook posts are retained. Long posts show a short preview with a link to Facebook. The slider changes every eight seconds and has a pause control.

## Activation

The verified public Facebook URL `https://www.facebook.com/profile.php?id=61568109854345` resolves to The GRIND Baseball Lab Page, ID `415532371652979`.

1. Using an app controlled by the Page owner, obtain a Facebook **Page access token** authorized to read that Page's published posts. Follow Meta's current Pages API setup and permission requirements; typically the app needs `pages_read_engagement`, with `pages_show_list` used during Page selection. Meta may require App Review or business verification depending on the app's access/use case. Do not request write permissions for this feed.
2. Add the token directly to Vercel as a sensitive Production environment variable named `FACEBOOK_PAGE_ACCESS_TOKEN`. Never send it in chat, commit it, or prefix it with `NEXT_PUBLIC_`.
3. Set `FACEBOOK_PAGE_ID=415532371652979`. Optional: `FACEBOOK_GRAPH_API_VERSION=v26.0` (the current default).
4. Redeploy, then visit `/admin/news` and check the Facebook connection status.

Token setup is required. A public Facebook Page URL alone does not authorize native API access. The integration remains inactive until valid credentials are configured. No sample Facebook content is displayed in production.

## Behavior

- The server reads only the Page's published posts, never visitor posts, comments, private messages, or personal-profile content.
- Meta API fields and published-post endpoint follow the official Meta Business SDK: https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/page.js and https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/page-post.js.
- Requests use an authorization header. Tokens, raw Meta errors, and pagination links are never returned to the browser or logged.
- Posts are fetched on demand and cached for one hour, with up to five additional minutes of CDN caching. No laptop process, scheduled assistant task, cron job, paid feed widget, or database write is needed. A fresh page visit after the cache refresh displays new posts.
- Imported posts are live feed items, not permanent database copies. Manual `news_slides` remain stored and editable as before. If Meta fails or a token expires, manual slides remain available and the admin connection panel reports the problem.
- Only valid posts belonging to the configured Page are displayed, newest first, with duplicate IDs removed. Unpublished/hidden posts and unsafe outbound links are discarded.
- Facebook images use Meta-hosted HTTPS URLs. Renew the Page token if Meta revokes access or the token expires; check `/admin/news` to diagnose.

## Validation

Run `node scripts/test-facebook-news.mjs` for post mapping, ordering, privacy, URL validation, server request handling, and token-redaction tests. These tests use in-process fixtures, not production data or credentials. Run the existing marketing HTTP checks after deployment.

An authenticated end-to-end Facebook test requires the Page owner to complete token setup. Until then only the unconfigured/fallback paths can be verified against the real deployment.
