export interface WorkflowConfig {
  OPENAI_API_HOST: string;
  OPENAI_API_KEY: string;
  PORT: number;
}

export interface WorkflowMappings {
  [workflowId: string]: WorkflowConfig;
}
