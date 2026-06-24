import { Express } from 'express';
import { env } from '../config/env';
import { logger } from '../infrastructure/logger/logger';

export const startServer = async (app: Express) => {
  const { PORT, NODE_ENV } = env;

  try {
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Restroex Backend started in ${NODE_ENV} mode on port ${PORT}`);
    });

    // Graceful Shutdown
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    signals.forEach((signal) => {
      process.on(signal, () => {
        logger.info(`Received ${signal}. Shutting down gracefully...`);
        server.close(() => {
          logger.info('Process terminated.');
          process.exit(0);
        });
      });
    });

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
};
