# Google AdSense setup

The production build is ready for Google Auto ads but intentionally ships with advertising disabled.

1. Connect an owned custom domain to this Site.
2. Add that domain under **AdSense → Sites** and complete Google's review.
3. In **Privacy & messaging**, publish Google's certified European regulations message for EEA, UK and Switzerland traffic.
4. Replace the empty `client` value in `public/adsense-config.js` with the approved `ca-pub-…` publisher ID.
5. Add the exact AdSense `ads.txt` line to `public/ads.txt` and redeploy.
6. Add a complete privacy policy and legal notice containing the real operator details before ads are activated.

The loader rejects malformed IDs and never contacts Google while `client` is empty. Auto ads are used, so no ad-slot ID is required. Do not gate exports behind an AdSense click and never click your own ads.
