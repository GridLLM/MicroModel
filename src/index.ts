import express, { Application } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { setupRoutes } from './routes';

// Load environment variables
dotenv.config();

const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Load mappings from mappings.json
const loadMappings = (): { [key: string]: number } => {
  try {
    const mappingsPath = path.join(__dirname, '..', 'mappings.json');
    const mappingsData = fs.readFileSync(mappingsPath, 'utf8');
    return JSON.parse(mappingsData);
  } catch (error) {
    console.error('Error loading mappings.json:', error);
    return {};
  }
};

// Create an Express app with workflow-specific routing
const createApp = (workflowId: string): Application => {
  const app: Application = express();
  
  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Setup routes
  setupRoutes(app, workflowId);

  return app;
};

// Main function to start all servers
const startServers = () => {
  const mappings = loadMappings();

  if (Object.keys(mappings).length === 0) {
    console.warn('No mappings found in mappings.json. Starting default server on port 3000.');
    // Start default server
    const defaultApp = createApp('default');
    const defaultServer = defaultApp.listen(3000, () => {
      console.log('='.repeat(60));
      console.log('Default OpenAI Proxy Server is running on port 3000');
      console.log(`Forwarding requests to: ${OPENAI_API_BASE_URL}`);
      console.log('Default workflow_id: default');
      console.log('='.repeat(60));
    });
    
    setupErrorHandling(defaultServer, 3000);
    return;
  }

  console.log('Starting servers based on mappings.json:');
  console.log(JSON.stringify(mappings, null, 2));

  // Start a server for each port in the mappings
  Object.entries(mappings).forEach(([workflowId, port]) => {
    const app = createApp(workflowId);
    
    const server = app.listen(port, () => {
      console.log('='.repeat(60));
      console.log(`OpenAI Proxy Server is running on port ${port}`);
      console.log(`Workflow ID: ${workflowId}`);
      console.log(`Forwarding requests to: ${OPENAI_API_BASE_URL}`);
      console.log('='.repeat(60));
    });

    setupErrorHandling(server, port);
  });

  if (!OPENAI_API_KEY) {
    console.warn('Warning: OPENAI_API_KEY not set in environment variables');
  }
};

// Setup error handling for a server
const setupErrorHandling = (server: any, port: number) => {
  server.on('error', (error: any) => {
    console.error(`Server error on port ${port}:`, error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Try a different port.`);
    }
  });
};

// Global error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start all servers
startServers();

export { createApp, startServers };
