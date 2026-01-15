import request from 'supertest';
import express from 'express';
import { BotManager } from '../bot.manager';

// Mock dependencies
jest.mock('../bot.manager');
jest.mock('../configs/logger.config', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('AI Test Endpoint', () => {
  let app: express.Application;
  let botManager: jest.Mocked<BotManager>;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Mock BotManager
    botManager = {
      getInstance: jest.fn().mockReturnThis(),
    } as any;
    
    BotManager.getInstance = jest.fn().mockReturnValue(botManager);
    
    // Import and use routes (this will be mocked)
    const apiRoutes = require('../api/index.api').default;
    const routes = apiRoutes(botManager);
    app.use('/', routes);
  });

  it('should have AI test endpoint defined', async () => {
    // Test that the endpoint exists (even if it fails due to missing AI keys in test)
    const response = await request(app)
      .post('/ai-test')
      .send({ query: 'test query' });
    
    // Should respond (even with error) rather than 404
    expect(response.status).not.toBe(404);
  });
});