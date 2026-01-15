import { AIModelManager } from '../services/ai-model-manager.service';

// Mock the logger to avoid noise in tests
jest.mock('../configs/logger.config', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock the cache service
jest.mock('../services/ai-cache.service', () => ({
  AICacheService: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock environment variables
const originalEnv = process.env;

describe('AIModelManager', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      GEMINI_API_KEY: 'test-key-1',
      GEMINI_API_KEY_2: 'test-key-2',
      ENV: 'test',
      PORT: '3000',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should initialize singleton instance correctly', () => {
    const manager1 = AIModelManager.getInstance();
    const manager2 = AIModelManager.getInstance();
    
    expect(manager1).toBe(manager2);
  });

  it('should have models configured', () => {
    const manager = AIModelManager.getInstance();
    const status = manager.getSystemStatus();
    
    expect(status.models.length).toBeGreaterThan(0);
    expect(status.totalRequests).toBe(0);
  });

  it('should reset model stats by name', () => {
    const manager = AIModelManager.getInstance();
    const resetCount = manager.resetModelStatsByName('gemini-2.5-flash');
    
    expect(resetCount).toBeGreaterThan(0);
  });

  it('should reset all stats', () => {
    const manager = AIModelManager.getInstance();
    
    expect(() => {
      manager.resetAllStats();
    }).not.toThrow();
  });

  it('should set active key', () => {
    const manager = AIModelManager.getInstance();
    
    expect(() => {
      manager.setActiveKey(2);
    }).not.toThrow();
  });
});