import { vi } from 'vitest'

// Mock the API index module so stores that import request() work
vi.mock('@/api/index', () => ({
  request: vi.fn(() => Promise.resolve(null)),
  default: vi.fn(() => Promise.resolve(null)),
}))

// Mock individual API modules as needed
// Each test file can override these mocks via vi.mocked()
