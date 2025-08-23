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

2. Create `.env` file:
```env
OPENAI_API_BASE_URL=http://localhost:11434
OPENAI_API_KEY=your-api-key
PORT=36830
```

3. Start the server:
```bash
npm run dev
```

## Usage

Send requests to `http://localhost:3004/v1/completions` with a `workflow_id`. This will capture the prompt and completion of the model:

```json
{
  "model": "qwen3:0.6b",
  "prompt": "Tell me a story",
  "workflow_id": "workflow_id"
}
```

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
