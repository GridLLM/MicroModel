import { Application, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { WorkflowConfig } from './types';

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

// Completions route handler
export const completionsHandler = (workflowId: string, config: WorkflowConfig) => {
  return async (req: Request, res: Response) => {
    try {
      const requestBody = req.body;
      // Use the workflow_id from the port mapping, but allow override from request body
      const finalWorkflowId = requestBody.workflow_id || workflowId;
      
      // Remove workflow_id from request body before forwarding to API
      const forwardBody = { ...requestBody };
      delete forwardBody.workflow_id;
      
      // Log the incoming request
      console.log(`Proxying request to ${config.OPENAI_API_HOST}/v1/completions for ${finalWorkflowId}`);
      
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

      // Add API key if configured
      if (config.OPENAI_API_KEY) {
        forwardHeaders['Authorization'] = `Bearer ${config.OPENAI_API_KEY}`;
      }
      
      const response = await fetch(
        `${config.OPENAI_API_HOST}/v1/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...forwardHeaders
          },
          body: JSON.stringify(forwardBody),
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
  };
};

// Health check route handler
export const healthHandler = (workflowId: string, config: WorkflowConfig) => {
  return (req: Request, res: Response) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      service: 'OpenAI Proxy Service',
      workflow_id: workflowId,
      api_host: config.OPENAI_API_HOST,
      port: config.PORT
    });
  };
};

// Root route handler
export const rootHandler = (workflowId: string, config: WorkflowConfig) => {
  return (req: Request, res: Response) => {
    res.json({
      service: 'OpenAI Proxy Service',
      description: 'Forwards requests to OpenAI API while logging prompts and responses',
      workflow_id: workflowId,
      api_host: config.OPENAI_API_HOST,
      port: config.PORT,
      endpoints: {
        'POST /v1/completions': 'Proxy for OpenAI chat completions',
        'GET /health': 'Health check',
        'GET /': 'Service information'
      }
    });
  };
};

// Setup routes for an Express app
export const setupRoutes = (app: Application, workflowId: string, config: WorkflowConfig) => {
  app.post('/v1/completions', completionsHandler(workflowId, config));
  app.get('/health', healthHandler(workflowId, config));
  app.get('/', rootHandler(workflowId, config));
};
