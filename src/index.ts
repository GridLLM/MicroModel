import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Proxy route for OpenAI /v1/completions
app.post('/v1/completions', async (req: Request, res: Response) => {
  try {
    const requestBody = req.body;
    const workflowId = requestBody.workflow_id; // Extract workflow_id from request body
    
    // Remove workflow_id from request body before forwarding to API
    const forwardBody = { ...requestBody };
    delete forwardBody.workflow_id;
    
    // Log the incoming request
    console.log(`Proxying request to ${OPENAI_API_BASE_URL}/v1/completions`);
    console.log(`Workflow ID: ${workflowId || 'default'}`);
    
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
    logRequestResponse(requestBody, responseData, '/v1/completions', workflowId);

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
    service: 'OpenAI Proxy Service'
  });
});

// Basic info endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'OpenAI Proxy Service',
    description: 'Forwards requests to OpenAI API while logging prompts and responses',
    endpoints: {
      'POST /v1/completions': 'Proxy for OpenAI chat completions',
      'GET /health': 'Health check',
      'GET /': 'Service information'
    }
  });
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`OpenAI Proxy Server is running on port ${PORT}`);
  console.log(`Forwarding requests to: ${OPENAI_API_BASE_URL}`);
  console.log(`Logging all prompts and responses to console`);
  
  if (!OPENAI_API_KEY) {
    console.warn('Warning: OPENAI_API_KEY not set in environment variables');
  }
});

// Error handling
server.on('error', (error: any) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try a different port.`);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

export default app;
