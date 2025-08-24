# MicroModel

A simple proxy server that forwards OpenAI API requests and automatically saves conversations as training data in ChatML format.

**Note**: Currently only supports the `/v1/completions` endpoint.

## Quick Start

1. Clone and install:
```bash
git clone https://github.com/GridLLM/MicroModel.git
cd MicroModel
npm install
```

2. Create `mappings.json` file (optional):
```json
{
  "workflow_id_1": 3001,
  "workflow_id_2": 3002,
  "training_batch_alpha": 3003,
  "production_test": 3004
}
```

3. Create `.env` file:
```env
OPENAI_API_BASE_URL=http://localhost:11434
OPENAI_API_KEY=your-api-key
PORT=36830
```

4. Start the server:
```bash
npm run dev
```

The server will automatically start multiple instances based on your `mappings.json`:
- Each port maps to a specific `workflow_id`
- If no `mappings.json` exists, runs on port defined in the env

## Port-Based Workflow Mapping

When you create a `mappings.json` file, MicroModel automatically:
1. Starts multiple server instances - one for each port defined
2. Auto-assigns workflow_id - based on which port receives the request
3. Organizes data collection - each workflow gets its own data directory

### Example Setup

With this `mappings.json`:
```json
{
  "user_feedback": 3001,
  "automated_tests": 3002,
  "production_logs": 3003
}
```

You get three separate endpoints:
- `http://localhost:3001/v1/completions` → automatically uses `workflow_id: "user_feedback"`
- `http://localhost:3002/v1/completions` → automatically uses `workflow_id: "automated_tests"` 
- `http://localhost:3003/v1/completions` → automatically uses `workflow_id: "production_logs"`

## Usage

### Option 1: Port-Based Automatic Assignment (Recommended)
Simply send requests to the mapped port - no need to include `workflow_id` in the body:

```bash
# Automatically uses workflow_id: "user_feedback"
curl -X POST http://localhost:3001/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:0.6b",
    "prompt": "Tell me a story"
  }'
```

### Option 2: Manual workflow_id Assignment
Send requests with explicit `workflow_id` (works on any port):

```json
{
  "model": "qwen3:0.6b",
  "prompt": "Tell me a story",
  "workflow_id": "custom_workflow"
}
```

**Note**: Manual `workflow_id` in the request body overrides the port-based assignment.

## Data Collection

Conversations are automatically saved in ChatML format:
- With workflow_id: `data/${workflow_id}$/conversations.jsonl`
- Without workflow_id: `data/default/conversations.jsonl`

Each saved conversation looks like:
```json
{
  "messages": [
    {"role": "user", "content": "Tell me a story"},
    {"role": "assistant", "content": "Once upon a time..."}
  ],
  "timestamp": "2025-08-23T19:30:00.000Z",
  "model": "qwen3:0.6b",
  "workflow_id": "my-training-data"
}
```

## API Endpoints

- `POST /v1/completions` - Proxy endpoint (saves training data)
- `GET /health` - Health check
- `GET /` - Service info

That's it! The proxy forwards your requests and collects training data automatically.
