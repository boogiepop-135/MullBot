import EnvConfig from '../configs/env.config';

describe('Environment Configuration', () => {
  it('should have a PORT defined', () => {
    expect(EnvConfig.PORT).toBeDefined();
  });

  it('should have a default PORT of 3000', () => {
    expect(EnvConfig.PORT || 3000).toBe(3000);
  });

  it('should have required API keys configured', () => {
    expect(EnvConfig.GEMINI_API_KEY).toBeDefined();
    expect(EnvConfig.GEMINI_API_KEY).not.toBe('');
  });

  it('should have Evolution API configuration', () => {
    expect(EnvConfig.EVOLUTION_URL).toBeDefined();
    expect(EnvConfig.EVOLUTION_INSTANCE_NAME).toBeDefined();
  });
});