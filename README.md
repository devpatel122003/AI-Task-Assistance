# AI-Powered Task Assistant

An intelligent task management application built on Cloudflare's platform that uses AI to help users manage their tasks through natural conversation.

## Features

- 🤖 **AI-Powered**: Uses Llama 3.3 on Workers AI for natural language understanding
- 💬 **Conversational Interface**: Chat naturally to create and manage tasks
- 📝 **Smart Task Management**: Automatically categorizes and prioritizes tasks
- 💾 **Persistent Storage**: Tasks and conversation history stored in Durable Objects
- ⚡ **Real-time Updates**: Instant task list updates as you chat
- 🎨 **Beautiful UI**: Clean, responsive interface

## Architecture

### Components

1. **LLM (Llama 3.3 on Workers AI)**
   - Processes natural language input
   - Extracts task information (title, description, priority)
   - Generates contextual responses
   - Includes fallback pattern matching forContinue9:03 PMreliability

Workflow/Coordination (Cloudflare Workers + Durable Objects)

Workers handle HTTP requests and route to Durable Objects
Durable Objects manage per-user state and orchestrate LLM calls
Each user gets their own isolated Durable Object instance


User Interface (Cloudflare Pages)

Clean chat interface for user interaction
Real-time task list display
Responsive design for mobile and desktop


Memory/State (Durable Objects Storage)

Persistent task storage per user
Conversation history for context-aware responses
Automatic state management and recovery



Deployment URLs

Worker: https://ai-task-assistant.devpatel-neu.workers.dev
Pages: https://63f15482.ai-task-assistant.pages.dev

Local Development
bash# Install dependencies
npm install

# Run locally
npm run dev

# Deploy
npm run deploy

## Usage Examples

- "Add a task to buy groceries"
- "Create a high priority task for the client meeting"
- "What are my tasks?"
- "Mark the first task as complete"
- "Show me high priority tasks"

## Technical Highlights

- **Hybrid AI Processing**: Uses LLM with fallback pattern matching for reliability
- **Stateful AI**: Conversation context maintained across requests
- **Error Handling**: Graceful fallbacks for API failures
- **CORS Support**: Secure cross-origin requests
- **Scalability**: Durable Objects automatically scale per user

## Assignment Requirements Met

✅ LLM Integration (Llama 3.3 on Workers AI)
✅ Workflow/Coordination (Workers + Durable Objects)
✅ User Input (Chat interface via Pages)
✅ Memory/State (Durable Objects Storage)

## License

MIT
```

---

## Deploy Commands
```bash
# 1. Deploy Worker
npx wrangler deploy

# 2. Deploy Pages
npx wrangler pages deploy public --project-name=ai-task-assistant
```

This complete code includes:
- ✅ Better error handling
- ✅ Fallback pattern matching when AI fails
- ✅ Improved response parsing
- ✅ Better UI with loading indicators
- ✅ Task sorting and status display
- ✅ Comprehensive logging for debugging

Deploy and test it now!
