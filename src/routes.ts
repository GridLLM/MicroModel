import { Application, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { WorkflowConfig } from "./types";

// Ensure data directory exists
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Logging utility
const logRequestResponse = (
  prompt: any,
  response: any,
  endpoint: string,
  workflowId?: string,
  priorMessages?: any[],
) => {
  // Save to JSONL file in ChatML format
  try {
    let messages: any[] = [];

    // If priorMessages are provided (for chat completions), include the full conversation
    if (priorMessages && Array.isArray(priorMessages)) {
      messages = [...priorMessages];
    } else {
      // For completions endpoint, create a user message from the prompt
      messages.push({
        role: "user",
        content: prompt.prompt || JSON.stringify(prompt),
      });
    }

    // Add the assistant response
    const assistantContent =
      response.choices?.[0]?.text ||
      response.choices?.[0]?.message?.content ||
      JSON.stringify(response);
    messages.push({
      role: "assistant",
      content: assistantContent,
    });

    const chatMLEntry = {
      messages: messages,
      timestamp: new Date().toISOString(),
      endpoint: endpoint,
      model: prompt.model || "unknown",
      workflow_id: workflowId || "default",
    };

    // Create date-based folder structure
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dateFolder = `${day}-${month}-${year}`;

    // Create workflow-specific directory with date subfolder
    const workflowDir = workflowId
      ? path.join(dataDir, workflowId)
      : path.join(dataDir, "default");

    const datePath = path.join(workflowDir, dateFolder);

    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    }

    if (!fs.existsSync(datePath)) {
      fs.mkdirSync(datePath, { recursive: true });
    }

    const jsonlLine = JSON.stringify(chatMLEntry) + "\n";
    const filePath = path.join(datePath, "data.jsonl");

    fs.appendFileSync(filePath, jsonlLine);
    console.log(
      `Saved conversation to ${filePath} (workflow: ${workflowId || "default"}, date: ${dateFolder})`,
    );
  } catch (error) {
    console.error("Error saving conversation:", error);
  }
};

// Utility function to prepare headers for forwarding
const prepareForwardHeaders = (
  req: Request,
  config: WorkflowConfig,
): Record<string, string> => {
  const forwardHeaders: Record<string, string> = {};
  Object.entries(req.headers).forEach(([key, value]) => {
    if (
      typeof value === "string" &&
      key.toLowerCase() !== "host" &&
      key.toLowerCase() !== "content-length"
    ) {
      forwardHeaders[key] = value;
    }
  });

  // Add API key if configured
  if (config.API_KEY) {
    forwardHeaders["Authorization"] = `Bearer ${config.API_KEY}`;
  }

  return forwardHeaders;
};

// Utility function to handle API request forwarding
const forwardToOpenAI = async (
  url: string,
  body: any,
  headers: Record<string, string>,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Utility function to handle errors
const handleProxyError = (error: any, res: Response) => {
  console.error("Error proxying request:", error.message);

  if (error.name === "AbortError") {
    res.status(408).json({
      error: "Request timeout",
      message: "Request timed out after 60 seconds",
    });
  } else {
    res.status(500).json({
      error: "Internal proxy server error",
      message: error.message,
    });
  }
};

// Completions route handler
export const completionsHandler = (
  workflowId: string,
  config: WorkflowConfig,
) => {
  return async (req: Request, res: Response) => {
    try {
      const requestBody = req.body;
      const finalWorkflowId = requestBody.workflow_id || workflowId;

      // Remove workflow_id from request body before forwarding to API
      const forwardBody = { ...requestBody };
      delete forwardBody.workflow_id;

      console.log(
        `Proxying request to ${config.OPENAI_API_HOST}/v1/completions for ${finalWorkflowId}`,
      );

      const forwardHeaders = prepareForwardHeaders(req, config);
      const response = await forwardToOpenAI(
        `${config.OPENAI_API_HOST}/v1/completions`,
        forwardBody,
        forwardHeaders,
      );

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const responseData = await response.json();

      // Log the prompt and response with workflow_id
      logRequestResponse(
        requestBody,
        responseData,
        "/v1/completions",
        finalWorkflowId,
      );

      // Return the response to the client
      res.status(response.status).json(responseData);
    } catch (error: any) {
      handleProxyError(error, res);
    }
  };
};

// Chat completions route handler
export const chatCompletionsHandler = (
  workflowId: string,
  config: WorkflowConfig,
) => {
  return async (req: Request, res: Response) => {
    try {
      const requestBody = req.body;
      const finalWorkflowId = requestBody.workflow_id || workflowId;

      // Extract messages for logging
      const requestMessages = requestBody.messages || [];

      // Remove workflow_id from request body before forwarding to API
      const forwardBody = { ...requestBody };
      delete forwardBody.workflow_id;

      console.log(
        `Proxying request to ${config.OPENAI_API_HOST}/v1/chat/completions for ${finalWorkflowId}`,
      );

      const forwardHeaders = prepareForwardHeaders(req, config);
      const response = await forwardToOpenAI(
        `${config.OPENAI_API_HOST}/v1/chat/completions`,
        forwardBody,
        forwardHeaders,
      );

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const responseData = await response.json();

      // Log the prompt and response with workflow_id and prior messages
      logRequestResponse(
        requestBody,
        responseData,
        "/v1/chat/completions",
        finalWorkflowId,
        requestMessages,
      );

      // Return the response to the client
      res.status(response.status).json(responseData);
    } catch (error: any) {
      handleProxyError(error, res);
    }
  };
};

// Health check route handler
export const healthHandler = (workflowId: string, config: WorkflowConfig) => {
  return (req: Request, res: Response) => {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      service: "OpenAI Proxy Service",
      workflow_id: workflowId,
      api_host: config.OPENAI_API_HOST,
      port: config.PORT,
    });
  };
};

// Root route handler
export const rootHandler = (workflowId: string, config: WorkflowConfig) => {
  return (req: Request, res: Response) => {
    res.json({
      service: "OpenAI Proxy Service",
      description:
        "Forwards requests to OpenAI API while logging prompts and responses",
      workflow_id: workflowId,
      api_host: config.OPENAI_API_HOST,
      port: config.PORT,
      endpoints: {
        "POST /v1/completions": "Proxy for OpenAI completions",
        "POST /v1/chat/completions": "Proxy for OpenAI chat completions",
        "GET /health": "Health check",
        "GET /": "Service information",
      },
    });
  };
};

// Setup routes for an Express app
export const setupRoutes = (
  app: Application,
  workflowId: string,
  config: WorkflowConfig,
) => {
  app.post("/v1/completions", completionsHandler(workflowId, config));
  app.post("/v1/chat/completions", chatCompletionsHandler(workflowId, config));
  app.get("/health", healthHandler(workflowId, config));
  app.get("/", rootHandler(workflowId, config));
};
