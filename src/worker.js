const ONE_DAY = 60 * 60 * 24

const SITES = {
  localhost: {
    origin: 'https://2048-lucas.pages.dev/',
    pinEnv: 'PIN_SITE_A',
    cookieName: 'auth_local',
  },
  '127.0.0.1': {
    origin: 'https://2048-lucas.pages.dev/',
    pinEnv: 'PIN_SITE_A',
    cookieName: 'auth_local',
  },
  'pin-gateway-worker.taklipstein.workers.dev': {
    origin: 'https://2048-lucas.pages.dev/',
    pinEnv: 'PIN_SITE_A',
    cookieName: 'auth_workers_dev',
  },
  '2048.lucaslc.me': {
    origin: 'https://2048-lucas.pages.dev/',
    pinEnv: 'PIN_SITE_A',
    cookieName: 'auth_a',
  },
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const site = SITES[url.hostname]

    if (!site) {
      return new Response('Unknown site', { status: 404 })
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

async function handleUnlock(request, env, site, url) {
  const expectedPin = env[site.pinEnv]

  if (!expectedPin) {
    return new Response(`Missing secret: ${site.pinEnv}`, { status: 500 })
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
    'Set-Cookie': serializeAuthCookie(site.cookieName, url.hostname),
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

function serializeAuthCookie(cookieName, hostname) {
  const secure = isLocalHostname(hostname) ? '' : ' Secure;'
  return `${cookieName}=1; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${ONE_DAY}`
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
