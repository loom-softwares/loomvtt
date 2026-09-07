export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  GAME: '/game',
  SETTINGS: '/settings',
  PROFILE: '/profile',
} as const

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
  },
  GAME: {
    WORLD: '/worlds',
    ACTORS: '/actors',
    SCENES: '/scenes',
    COMBAT: '/combat',
    ASSETS: '/assets',
  },
  USER: {
    PROFILE: '/user/profile',
    SETTINGS: '/user/settings',
  },
} as const