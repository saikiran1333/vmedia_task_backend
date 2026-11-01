import { RESPONSE_MESSAGES } from '../../../constants/response_messages.js';
import { logger } from '../../../utils/logger.js';

// Hello service encapsulating business domain logic for greetings and system metadata.
export class HelloService {
  // Generates greeting payload enriched with system runtime details.
  static getGreeting() {
    logger.debug('Executing HelloService.getGreeting logic');
    return {
      greeting: RESPONSE_MESSAGES.HELLO_WORLD,
      platform: 'Vmedia Platform',
      environment: process.env.NODE_ENV || 'development',
      serverTime: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
    };
  }
}
