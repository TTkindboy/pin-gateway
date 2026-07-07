# pin-gateway

Cloudflare Worker that protects one routed site with a PIN screen, then proxies unlocked requests to the configured origin.

## Cloudflare Config

| Variable | Required | Type | Description |
| --- | --- | --- | --- |
| `SITE_ORIGIN` | Yes | Secret | Full origin URL for `/`. |
| `SECONDARY_SITE_ORIGIN` | Yes | Secret | Full origin URL for `SECONDARY_SITE_PATH`. |
| `SITE_PIN` | Yes | Secret | PIN users must enter before accessing the site. |
| `AUTH_COOKIE_NAME` | Yes | Environment variable | Cookie name. Configured in `wrangler.jsonc`. |
| `AUTH_COOKIE_MAX_AGE` | Yes | Environment variable | Cookie lifetime in seconds. Configured in `wrangler.jsonc`. |
| `SECONDARY_SITE_PATH` | Yes | Environment variable | Path prefix for the secondary site. Configured in `wrangler.jsonc`. |
