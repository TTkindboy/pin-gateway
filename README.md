# pin-gateway

Cloudflare Worker that protects one routed site with a PIN screen, then proxies unlocked requests to the configured origin.

## Cloudflare Config

| Variable | Required | Type | Description |
| --- | --- | --- | --- |
| `SITE_ORIGIN` | Yes | Environment variable | Full origin URL for the site behind the gateway. |
| `SITE_PIN` | Yes | Secret | PIN users must enter before accessing the site. |
| `AUTH_COOKIE_NAME` | No | Environment variable | Cookie name. Defaults to `pin_gateway_auth`. |
| `AUTH_COOKIE_MAX_AGE` | No | Environment variable | Cookie lifetime in seconds. Defaults to one day. |
