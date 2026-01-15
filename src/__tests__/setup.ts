// Jest setup file
// This runs before every test file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENV = 'test';
process.env.PORT = '3000';
process.env.GEMINI_API_KEY = 'test-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for async operations
jest.setTimeout(10000);