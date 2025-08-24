import express, { Application } from 'express';
import fs from 'fs';
import path from 'path';
import { setupRoutes } from './routes';
import { WorkflowMappings, WorkflowConfig } from './types';

// Load mappings from config.json
const loadMappings = (): WorkflowMappings => {
  try {
    const mappingsPath = path.join(__dirname, '..', 'config.json');
    
    if (!fs.existsSync(mappingsPath)) {
      console.error('config.json file not found. Please create one in the project root.');
      return {};
    }
    
    const mappingsData = fs.readFileSync(mappingsPath, 'utf8');
    const parsedMappings = JSON.parse(mappingsData);
    
    // Validate the structure
    for (const [workflowId, config] of Object.entries(parsedMappings)) {
      if (typeof config !== 'object' || config === null) {
        console.error(`Invalid configuration for workflow "${workflowId}". Expected object, got ${typeof config}.`);
        return {};
      }
      
      const workflowConfig = config as any;
      if (!workflowConfig.OPENAI_API_HOST || typeof workflowConfig.PORT !== 'number') {
        console.error(`Invalid configuration for workflow "${workflowId}". Missing required fields: OPENAI_API_HOST, PORT.`);
        return {};
      }
    }
    
    return parsedMappings;
  } catch (error) {
    console.error('Error loading config.json:', error);
    return {};
  }
};

// Create an Express app with workflow-specific routing
const createApp = (workflowId: string, config: WorkflowConfig): Application => {
  const app: Application = express();
  
  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Setup routes with workflow-specific configuration
  setupRoutes(app, workflowId, config);

  return app;
};

// Main function to start all servers
const startServers = () => {
  const mappings = loadMappings();

  if (Object.keys(mappings).length === 0) {
    console.error('No mappings found in config.json. Please create a config.json file with your workflow configurations.');
    console.error('Example config.json structure:');
    console.error(JSON.stringify({
      "default": {
        "OPENAI_API_HOST": "http://localhost:11434",
        "OPENAI_API_KEY": "",
        "PORT": 3000
      },
      "my_workflow": {
        "OPENAI_API_HOST": "http://localhost:11434",
        "OPENAI_API_KEY": "your-api-key",
        "PORT": 3001
      }
    }, null, 2));
    process.exit(1);
  }

  // Start a server for each workflow in the mappings
  Object.entries(mappings).forEach(([workflowId, config]) => {
    // Validate configuration
    if (!config.OPENAI_API_HOST || typeof config.PORT !== 'number') {
      console.error(`Invalid configuration for workflow "${workflowId}". Missing OPENAI_API_HOST or PORT.`);
      process.exit(1);
    }

    const app = createApp(workflowId, config);
    
    const server = app.listen(config.PORT, () => {
      console.log(`OpenAI Proxy Server is running on port ${config.PORT}`);
      console.log(`Workflow ID: ${workflowId}`);
      console.log(`Forwarding requests to: ${config.OPENAI_API_HOST}`);
      console.log(`API Key: ${config.OPENAI_API_KEY ? '***configured***' : 'not set'}`);
      console.log('='.repeat(60));
    });

    setupErrorHandling(server, config.PORT);
  });

  console.log(`\nStarted ${Object.keys(mappings).length} server(s) successfully!`);
  console.log('='.repeat(60));
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
