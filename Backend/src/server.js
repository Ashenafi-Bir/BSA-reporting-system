// server.js
// Load environment variables FIRST
import './config/env.js';

// Then import everything else
import app from './app.js';
import { initOraclePool, initPmsPool } from './config/db.js';
import { bootstrapSchedulers } from './schedulers/bootstrap.js';
import logger from './config/logger.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initOraclePool();
    await initPmsPool();

    // ⬇️ Runs AFTER the PMS pool exists
    await bootstrapSchedulers();

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();