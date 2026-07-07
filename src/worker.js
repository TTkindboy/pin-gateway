const DEFAULT_AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 // one day

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const site = getSite(env)

    if (!site) {
      return new Response('Missing site configuration', { status: 500 })
    }

    if (isStaticAsset(url)) {
      return env.ASSETS.fetch(request)
    }

    if (hasAuthCookie(request, site.cookieName)) {
      return proxyToOrigin(request, site.origin)
    }

    if (request.method === 'POST' && url.pathname === '/unlock') {
      return handleUnlock(request, env, site, url)
    }

    return showPinScreen(request, env)
  },
}

function getSite(env) {
  if (!env.SITE_ORIGIN || !isValidOrigin(env.SITE_ORIGIN)) {
    return null
  }

  return {
    origin: env.SITE_ORIGIN,
    pin: env.SITE_PIN,
    cookieName: env.AUTH_COOKIE_NAME || 'pin_gateway_auth',
    cookieMaxAge: getCookieMaxAge(env.AUTH_COOKIE_MAX_AGE),
  }
}

async function handleUnlock(request, env, site, url) {
  const expectedPin = site.pin

  if (!expectedPin) {
    return new Response('Missing secret: SITE_PIN', { status: 500 })
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

function proxyToOrigin(request, origin) {
  const requestUrl = new URL(request.url)
  const originUrl = new URL(origin)

  requestUrl.protocol = originUrl.protocol
  requestUrl.hostname = originUrl.hostname
  requestUrl.port = originUrl.port

  const headers = new Headers(request.headers)

  const init = {
    method: request.method,
    headers,
    redirect: request.redirect,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
  }

  return fetch(new Request(requestUrl, init))
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

function isStaticAsset(url) {
  return (
    url.pathname === '/pin' ||
    url.pathname === '/pin.html' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/robots.txt'
  )
}

function normalizePin(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function getCookieMaxAge(value) {
  const maxAge = Number(value)
  if (!Number.isSafeInteger(maxAge) || maxAge <= 0) {
    return DEFAULT_AUTH_COOKIE_MAX_AGE
  }

  return maxAge
}

function isValidOrigin(origin) {
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
