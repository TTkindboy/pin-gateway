export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const site = getSite(env, url)

    if (!site) {
      return new Response('Missing site configuration', { status: 500 })
    }

    if (isStaticAsset(url)) {
      return env.ASSETS.fetch(request)
    }

    if (hasAuthCookie(request, site.cookieName)) {
      return proxyToOrigin(request, site)
    }

    if (request.method === 'POST' && url.pathname === '/unlock') {
      return handleUnlock(request, env, site, url)
    }

    return showPinScreen(request, env)
  },
}

function getSite(env, url) {
  const cookieMaxAge = Number(env.AUTH_COOKIE_MAX_AGE)
  const route = getOriginRoute(env, url)

  if (
    !route ||
    !env.AUTH_COOKIE_NAME ||
    !Number.isSafeInteger(cookieMaxAge) ||
    cookieMaxAge <= 0
  ) {
    return null
  }

  return {
    ...route,
    pin: env.SITE_PIN,
    cookieName: env.AUTH_COOKIE_NAME,
    cookieMaxAge,
  }
}

function getOriginRoute(env, url) {
  const secondaryPath = normalizePathPrefix(env.SECONDARY_SITE_PATH)

  if (secondaryPath && isPathWithinPrefix(url.pathname, secondaryPath)) {
    return getRoute(env.SECONDARY_SITE_ORIGIN, secondaryPath)
  }

  return getRoute(env.SITE_ORIGIN, '')
}

function getRoute(origin, stripPrefix) {
  if (!origin || !isValidOrigin(origin)) {
    return null
  }

  return { origin, stripPrefix }
}

async function handleUnlock(request, env, site, url) {
  const expectedPin = site.pin

  if (!expectedPin) {
    return new Response('Missing site configuration', { status: 500 })
  }

  const form = await request.formData()
  const pin = normalizePin(form.get('pin'))
  const wantsJson = request.headers.get('Accept')?.includes('application/json')

  if (pin !== normalizePin(expectedPin)) {
    if (wantsJson) {
      return Response.json({ ok: false }, { status: 401 })
    }
    return Response.redirect(new URL('/?error=1', url), 303)
  }

  const headers = {
    'Set-Cookie': serializeAuthCookie(site.cookieName, url.hostname, site.cookieMaxAge),
  }

  if (wantsJson) {
    return Response.json({ ok: true, location: '/' }, { headers })
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/',
      ...headers,
    },
  })
}

function showPinScreen(request, env) {
  const url = new URL(request.url)
  url.pathname = '/pin.html'
  return env.ASSETS.fetch(new Request(url, request))
}

function proxyToOrigin(request, site) {
  const requestUrl = new URL(request.url)
  const originUrl = new URL(site.origin)

  requestUrl.protocol = originUrl.protocol
  requestUrl.hostname = originUrl.hostname
  requestUrl.port = originUrl.port
  requestUrl.pathname = stripPathPrefix(requestUrl.pathname, site.stripPrefix)

  const headers = new Headers(request.headers)
  headers.delete('Host') // clean host header

  const init = {
    method: request.method,
    headers,
    redirect: request.redirect,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
  }

  return fetch(new Request(requestUrl, init)).catch(() => {
    return new Response('Origin unreachable', { status: 502 })
  })
}

function hasAuthCookie(request, cookieName) {
  const cookie = request.headers.get('Cookie') || ''
  return cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${cookieName}=1`)
}

function serializeAuthCookie(cookieName, hostname, maxAge) {
  const secure = isLocalHostname(hostname) ? '' : ' Secure;'
  return `${cookieName}=1; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`
}

const STATIC_ASSET_PATHS = new Set(['/pin', '/pin.html', '/favicon.ico', '/robots.txt'])

function isStaticAsset(url) {
  return STATIC_ASSET_PATHS.has(url.pathname)
}

// Must stay in sync with the character-normalization logic in public/pin.html.
function normalizePin(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function isPathWithinPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function normalizePathPrefix(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value === '/') {
    return null
  }

  return value.endsWith('/') ? value.slice(0, -1) : value
}

function stripPathPrefix(pathname, prefix) {
  if (!prefix || !pathname.startsWith(prefix)) {
    return pathname
  }

  const nextPathname = pathname.slice(prefix.length)
  return nextPathname || '/'
}

function isValidOrigin(origin) {
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
