# pin-gateway

Cloudflare Worker that protects one routed site with a PIN screen, then proxies unlocked requests to the configured origin.

## Cloudflare config

Set the protected site origin as a Worker variable:

```sh
pnpm wrangler secret put SITE_PIN
```

Set `SITE_ORIGIN` in the Cloudflare dashboard as a plain environment variable. It should be the full origin URL for the site behind the gateway.

Optionally set `AUTH_COOKIE_NAME` as a plain environment variable. If omitted, the Worker uses `pin_gateway_auth`.

Optionally set `AUTH_COOKIE_MAX_AGE` as a plain environment variable. It is measured in seconds. If omitted or invalid, the Worker uses 1 day.
