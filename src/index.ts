import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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

// Create reverse mapping: port -> workflow_id
const createPortToWorkflowMapping = (mappings: { [key: string]: number }): { [port: number]: string } => {
  const reverseMap: { [port: number]: string } = {};
  Object.entries(mappings).forEach(([workflowId, port]) => {
    reverseMap[port] = workflowId;
  });
  return reverseMap;
};

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Logging utility
const logRequestResponse = (prompt: any, response: any, endpoint: string, workflowId?: string) => {
  // Save to JSONL file in ChatML format
  try {
    const chatMLEntry = {
      messages: [
        {
          role: "user",
          content: prompt.prompt || JSON.stringify(prompt)
        },
        {
          role: "assistant", 
          content: response.choices?.[0]?.text || response.choices?.[0]?.message?.content || JSON.stringify(response)
        }
      ],
      timestamp: new Date().toISOString(),
      endpoint: endpoint,
      model: prompt.model || 'unknown',
      workflow_id: workflowId || 'default'
    };

    // Create workflow-specific directory
    const workflowDir = workflowId 
      ? path.join(dataDir, workflowId)
      : path.join(dataDir, 'default');
    
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    }

    const jsonlLine = JSON.stringify(chatMLEntry) + '\n';
    const filePath = path.join(workflowDir, 'data.jsonl');
    
    fs.appendFileSync(filePath, jsonlLine);
    console.log(`Saved conversation to ${filePath} (workflow: ${workflowId || 'default'})`);
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
};

// Create an Express app with workflow-specific routing
const createApp = (workflowId: string): Application => {
  const app: Application = express();
  
  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Proxy route for OpenAI /v1/completions
  app.post('/v1/completions', async (req: Request, res: Response) => {
    try {
      const requestBody = req.body;
      // Use the workflow_id from the port mapping, but allow override from request body
      const finalWorkflowId = requestBody.workflow_id || workflowId;
      
      // Remove workflow_id from request body before forwarding to API
      const forwardBody = { ...requestBody };
      delete forwardBody.workflow_id;
      
      // Log the incoming request
      console.log(`[Port mapping] Proxying request to ${OPENAI_API_BASE_URL}/v1/completions`);
      console.log(`[Port mapping] Workflow ID: ${finalWorkflowId}`);
      
      // Forward request to OpenAI API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout
      
      // Prepare headers, filtering out problematic ones
      const forwardHeaders: Record<string, string> = {};
      Object.entries(req.headers).forEach(([key, value]) => {
        if (typeof value === 'string' && key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
          forwardHeaders[key] = value;
        }
      });
      
      const response = await fetch(
        `${OPENAI_API_BASE_URL}/v1/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...forwardHeaders
          },
          body: JSON.stringify(forwardBody), // Use cleaned body without workflow_id
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }
      
      const responseData = await response.json();

      // Log the prompt and response with workflow_id
      logRequestResponse(requestBody, responseData, '/v1/completions', finalWorkflowId);

      // Return the response to the client
      res.status(response.status).json(responseData);

    } catch (error: any) {
      console.error('Error proxying request:', error.message);
      
      if (error.name === 'AbortError') {
        // Request was aborted due to timeout
        res.status(408).json({ 
          error: 'Request timeout',
          message: 'Request timed out after 60 seconds'
        });
      } else {
        // Internal server error
        res.status(500).json({ 
          error: 'Internal proxy server error',
          message: error.message 
        });
      }
    }
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      service: 'OpenAI Proxy Service',
      workflow_id: workflowId
    });
  });

  // Basic info endpoint
  app.get('/', (req: Request, res: Response) => {
    res.json({
      service: 'OpenAI Proxy Service',
      description: 'Forwards requests to OpenAI API while logging prompts and responses',
      workflow_id: workflowId,
      endpoints: {
        'POST /v1/completions': 'Proxy for OpenAI chat completions',
        'GET /health': 'Health check',
        'GET /': 'Service information'
      }
    });
  });

  return app;
};

// Main function to start all servers
const startServers = () => {
  const mappings = loadMappings();
  const portToWorkflowMapping = createPortToWorkflowMapping(mappings);
  
  if (Object.keys(mappings).length === 0) {
    console.warn('No mappings found in mappings.json. Starting default server on port 3000.');
    // Start default server
    const defaultApp = createApp('default');
    const defaultServer = defaultApp.listen(3000, () => {
      console.log('Default OpenAI Proxy Server is running on port 3000');
      console.log(`Forwarding requests to: ${OPENAI_API_BASE_URL}`);
      console.log('Default workflow_id: default');
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
      console.log(`OpenAI Proxy Server is running on port ${port}`);
      console.log(`Workflow ID: ${workflowId}`);
      console.log(`Forwarding requests to: ${OPENAI_API_BASE_URL}`);
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
