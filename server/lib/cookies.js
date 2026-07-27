import { authCookieSecure, authRefreshDays } from './env.js'

export function setAuthCookies(response, accessToken, refreshToken) {
  response.cookie('vaija_access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: authCookieSecure,
    path: '/',
    maxAge: 15 * 60 * 1000,
  })

  response.cookie('vaija_refresh_token', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: authCookieSecure,
    path: '/',
    maxAge: authRefreshDays * 24 * 60 * 60 * 1000,
  })
}

export function clearAuthCookies(response) {
  response.clearCookie('vaija_access_token', { path: '/' })
  response.clearCookie('vaija_refresh_token', { path: '/' })
}
