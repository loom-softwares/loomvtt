export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface User {
  id: string
  name: string
  email: string
  role: number
  color?: string
  avatarUrl?: string
}

export interface GameState {
  currentWorld?: string
  currentScene?: string
  players: User[]
  isGM: boolean
}