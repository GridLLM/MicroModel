export interface WorkflowConfig {
  OPENAI_API_HOST: string;
  API_KEY: string;
  PORT: number;
}

export interface WorkflowMappings {
  [workflowId: string]: WorkflowConfig;
}

export interface WorkflowResult {
  
}