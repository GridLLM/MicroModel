# MicroModel

A simple proxy server that forwards OpenAI API requests and automatically saves conversations as training data in ChatML format. Now supports per-workflow configuration with individual API hosts, keys, and ports.

> [!NOTE]  
> Supports both `/v1/completions` and `/v1/chat/completions` endpoints.

## Quick Start

1. Clone and install:
```bash
git clone https://github.com/GridLLM/MicroModel.git
cd MicroModel
npm install
```

2. Create `config.json` file (required):
```json
{
  "default": {
    "OPENAI_API_HOST": "http://localhost:11434",
    "API_KEY": "",
    "PORT": 3001
  },
  "custom_workflow": {
    "OPENAI_API_HOST": "http://localhost:11434",
    "API_KEY": "12345",
    "PORT": 3002
  }
}
```

3. Start the server:
```bash
npm run dev
```

The server will automatically start multiple instances based on your `config.json`:
- Each instance will automatically save the prompt / response to the workflow defined in the config.json
- Each workflow has its own port, API host, and API key
- All configuration must be in `config.json`

## Per-Workflow Configuration

Each workflow in `config.json` can have its own configuration:

### Configuration Fields
- **OPENAI_API_HOST**: The API endpoint to forward requests to
- **API_KEY**: The API key for authentication (optional)
- **PORT**: The port number for this workflow's server

> [!NOTE]
> If you are using Ollama / vLLM to generate your responses, you do not need to define an API_KEY

### Multi-Provider Support
You can configure different workflows to use different AI providers:

```json
{
  "ollama": {
    "OPENAI_API_HOST": "http://localhost:11434",
    "API_KEY": "",
    "PORT": 3001
  },
  "openai_gpt": {
    "OPENAI_API_HOST": "https://api.openai.com",
    "API_KEY": "sk-your-openai-key",
    "PORT": 3002
  },
  "anthropic_claude": {
    "OPENAI_API_HOST": "https://api.anthropic.com",
    "API_KEY": "your-anthropic-key",
    "PORT": 3003
  }
}
```

The `model` and `workflow_id` will be saved to the ultimate JSONL file in their respective fields.

## Usage

### Automatic Workflow Assignment
Each port automatically uses its configured workflow ID. Simply send requests to the appropriate port:

```bash
# Uses workflow_id: "ollama" and forwards to localhost:11434
curl -X POST http://localhost:3001/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:14b",
    "prompt": "Tell me a story"
  }'

# Chat completions endpoint
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:14b",
    "messages": [
      {"role": "user", "content": "Tell me a story"}
    ]
  }'

# Uses workflow_id: "openai_gpt" and forwards to OpenAI API
curl -X POST http://localhost:3002/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "prompt": "Tell me a story"
  }'
```

### Manual Workflow Override
You can override the automatic workflow assignment by including `workflow_id` in the request body:

```json
{
  "model": "qwen3:14b",
  "prompt": "Tell me a story",
  "workflow_id": "custom_experiment"
}
```

For chat completions:
```json
{
  "model": "qwen3:14b",
  "messages": [
    {"role": "user", "content": "Tell me a story"}
  ],
  "workflow_id": "custom_experiment"
}
```

> [!IMPORTANT]
> Entering in a manual `workflow_id` in the request body will override the port-based assignment. If you do not have a workflow_id defined in your config.json, then an error will occur.

## Data Collection

Conversations are automatically saved in ChatML format with automatic date-based organization:
- Location: `data/${workflow_id}/${dd-mm-yyyy}/data.jsonl`
- Each workflow gets its own data directory
- Each day gets its own subfolder in DD-MM-YYYY format

### Folder Structure
The system automatically creates a date-based folder structure for easy data aggregation:
```
data/
├── custom_workflow/
│   ├── 24-08-2025/
│   │   └── data.jsonl
│   ├── 25-08-2025/
│   │   └── data.jsonl
│   └── 26-08-2025/
│       └── data.jsonl
├── ollama/
│   ├── 24-08-2025/
│   │   └── data.jsonl
│   └── 25-08-2025/
│       └── data.jsonl
└── default/
    └── 24-08-2025/
        └── data.jsonl
```

Each saved conversation looks like:
```json
{
  "messages": [
    {"role": "user", "content": "Tell me a story"},
    {"role": "assistant", "content": "Once upon a time..."}
  ],
  "timestamp": "2025-08-24T10:30:00.000Z",
  "endpoint": "/v1/completions",
  "model": "qwen3:14b",
  "workflow_id": "ollama"
}
```

This data can be used to easily fine tune a model using a platform like [unsloth](https://unsloth.ai/).

## API Endpoints

### Per-Workflow Endpoints
Each configured workflow provides these endpoints:
- `POST /v1/completions` - Proxy endpoint with automatic logging
- `POST /v1/chat/completions` - Chat completions proxy endpoint with automatic logging
- `GET /health` - Health check (shows workflow configuration)
- `GET /` - Service info (shows workflow configuration)

### Health Check Response
```json
{
  "status": "OK",
  "timestamp": "2025-08-24T10:30:00.000Z",
  "service": "OpenAI Proxy Service",
  "workflow_id": "ollama",
  "api_host": "http://localhost:11434",
  "port": 3001
}
```

## Configuration Reference

### config.json Structure
```json
{
  "workflow_name": {
    "OPENAI_API_HOST": "string (required) - API endpoint URL",
    "API_KEY": "string (optional) - API key for authentication", 
    "PORT": "number (required) - Port for this workflow's server"
  }
}
```

### Validation
The system validates that:
- `config.json` file exists
- Each workflow has required `OPENAI_API_HOST` and `PORT` fields
- Port numbers are valid integers
- No port conflicts between workflows

## Error Handling
- Missing `config.json`: Server exits with configuration example
- Invalid configuration: Server exits with specific error message
- API request failures: Forwarded to client with original status codes