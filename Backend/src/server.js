// MUST be the first import to load environment variables
import './config/env.js';

// Now import everything else
import app from './app.js';
import { initOraclePool, initSqliteDb } from './config/db.js';
import logger from './config/logger.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initOraclePool();
    await initSqliteDb();

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();