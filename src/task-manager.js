export class TaskManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/tasks':
          return await this.handleTasks(request);
        case '/chat':
          return await this.handleChat(request);
        case '/history':
          return await this.handleHistory(request);
        default:
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
      }
    } catch (error) {
      console.error('Error in TaskManager:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async handleTasks(request) {
    if (request.method === 'GET') {
      const tasks = await this.state.storage.get('tasks') || [];
      return new Response(JSON.stringify(tasks), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const tasks = await this.state.storage.get('tasks') || [];

      if (body.action === 'add') {
        const newTask = {
          id: Date.now().toString(),
          title: body.title,
          description: body.description || '',
          priority: body.priority || 'medium',
          status: body.status || 'pending',
          createdAt: new Date().toISOString()
        };
        tasks.push(newTask);
      } else if (body.action === 'update') {
        const index = tasks.findIndex(t => t.id === body.id);
        if (index !== -1) {
          tasks[index] = { ...tasks[index], ...body.updates };
        }
      } else if (body.action === 'delete') {
        const index = tasks.findIndex(t => t.id === body.id);
        if (index !== -1) {
          tasks.splice(index, 1);
        }
      }

      await this.state.storage.put('tasks', tasks);
      return new Response(JSON.stringify(tasks), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleChat(request) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { message } = body;

    // Get conversation history
    const history = await this.state.storage.get('chatHistory') || [];
    history.push({ role: 'user', content: message, timestamp: Date.now() });

    // Get current tasks for context
    const tasks = await this.state.storage.get('tasks') || [];

    // Build context
    const tasksContext = tasks.length > 0
      ? `Current tasks:\n${tasks.map((t, i) => `${i + 1}. [${t.status}] ${t.title} (${t.priority} priority)`).join('\n')}`
      : 'No tasks yet.';

    const systemPrompt = `You are a helpful task management assistant. 

${tasksContext}

Respond ONLY with a valid JSON object in this EXACT format (no markdown, no code blocks):
{
  "reply": "your natural language response to the user",
  "action": "add",
  "taskData": {
    "title": "task title here",
    "description": "task description",
    "priority": "high",
    "status": "pending"
  }
}

OR for queries:
{
  "reply": "your response about their tasks",
  "action": "none"
}

OR for updates (use the task number from the list above):
{
  "reply": "I've updated the task",
  "action": "update",
  "taskData": {
    "id": "task_id_from_list",
    "status": "completed"
  }
}

Rules:
- ALWAYS respond with valid JSON only, no other text
- For "add" action: extract title, description, priority (high/medium/low)
- For "update" action: include the task id from the list
- For "delete" action: include the task id
- For queries: action should be "none"
- Default priority is "medium"
- Be conversational in the "reply" field`;

    try {
      // Call Workers AI
      const aiResponse = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-10).map(h => ({ role: h.role, content: h.content }))
        ],
        temperature: 0.5,
        max_tokens: 512
      });

      console.log('Raw AI Response:', JSON.stringify(aiResponse));

      let parsedResponse;
      try {
        // Extract response text from various possible formats
        let responseText = '';

        if (typeof aiResponse === 'string') {
          responseText = aiResponse;
        } else if (aiResponse.response) {
          responseText = aiResponse.response;
        } else if (aiResponse.result && aiResponse.result.response) {
          responseText = aiResponse.result.response;
        } else if (aiResponse.text) {
          responseText = aiResponse.text;
        } else {
          responseText = JSON.stringify(aiResponse);
        }

        console.log('Extracted text:', responseText);

        // Clean up the response - remove markdown code blocks if present
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Try to find JSON in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
          console.log('Parsed response:', parsedResponse);
        } else {
          throw new Error('No JSON found in response');
        }

        // Validate the response has required fields
        if (!parsedResponse.reply) {
          parsedResponse.reply = 'I processed your request.';
        }
        if (!parsedResponse.action) {
          parsedResponse.action = 'none';
        }

      } catch (parseError) {
        console.error('Parse error:', parseError);

        // Fallback: Use simple pattern matching
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('add') || lowerMessage.includes('create')) {
          const taskTitle = message.replace(/add a task to |create a task to |add task |create task |add |create /gi, '').trim();
          const priority = lowerMessage.includes('high priority') || lowerMessage.includes('high') ? 'high' :
            lowerMessage.includes('low priority') || lowerMessage.includes('low') ? 'low' : 'medium';

          parsedResponse = {
            reply: `I've created a ${priority} priority task: "${taskTitle}"`,
            action: 'add',
            taskData: {
              title: taskTitle || 'New Task',
              description: '',
              priority: priority,
              status: 'pending'
            }
          };
        } else if (lowerMessage.includes('complete') || lowerMessage.includes('done') || lowerMessage.includes('finish')) {
          if (tasks.length > 0) {
            const taskToComplete = tasks[0]; // Complete first pending task
            parsedResponse = {
              reply: `I've marked "${taskToComplete.title}" as complete!`,
              action: 'update',
              taskData: {
                id: taskToComplete.id,
                status: 'completed'
              }
            };
          } else {
            parsedResponse = {
              reply: "You don't have any tasks to complete.",
              action: 'none'
            };
          }
        } else if (lowerMessage.includes('what') || lowerMessage.includes('show') || lowerMessage.includes('list')) {
          if (tasks.length > 0) {
            const taskList = tasks.map((t, i) => `${i + 1}. ${t.title} (${t.priority} priority, ${t.status})`).join(', ');
            parsedResponse = {
              reply: `You have ${tasks.length} task(s): ${taskList}`,
              action: 'none'
            };
          } else {
            parsedResponse = {
              reply: "You don't have any tasks yet. Try saying 'Add a task to...'",
              action: 'none'
            };
          }
        } else {
          parsedResponse = {
            reply: "I can help you add, complete, or view tasks. Try: 'Add a task to buy groceries' or 'What are my tasks?'",
            action: 'none'
          };
        }
      }

      // Execute action if needed
      if (parsedResponse.action && parsedResponse.action !== 'none' && parsedResponse.taskData) {
        await this.executeTaskAction(parsedResponse.action, parsedResponse.taskData);
      }

      // Save assistant response to history
      history.push({
        role: 'assistant',
        content: parsedResponse.reply,
        timestamp: Date.now()
      });

      // Keep only last 50 messages
      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }

      await this.state.storage.put('chatHistory', history);

      const currentTasks = await this.state.storage.get('tasks') || [];

      return new Response(JSON.stringify({
        reply: parsedResponse.reply,
        action: parsedResponse.action || 'none',
        tasks: currentTasks
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('AI Error:', error);

      // Complete fallback with pattern matching
      const lowerMessage = message.toLowerCase();
      let fallbackResponse = {
        reply: '',
        action: 'none',
        tasks: await this.state.storage.get('tasks') || []
      };

      if (lowerMessage.includes('add') || lowerMessage.includes('create')) {
        const taskTitle = message.replace(/add a task to |create a task to |add task |create task |add |create /gi, '').trim();
        const priority = lowerMessage.includes('high priority') || lowerMessage.includes('high') ? 'high' :
          lowerMessage.includes('low priority') || lowerMessage.includes('low') ? 'low' : 'medium';

        await this.executeTaskAction('add', {
          title: taskTitle || 'New Task',
          description: '',
          priority: priority,
          status: 'pending'
        });

        fallbackResponse.reply = `I've added a ${priority} priority task: "${taskTitle}"`;
        fallbackResponse.action = 'add';
        fallbackResponse.tasks = await this.state.storage.get('tasks') || [];
      } else if (lowerMessage.includes('what') || lowerMessage.includes('show') || lowerMessage.includes('list')) {
        const currentTasks = await this.state.storage.get('tasks') || [];
        if (currentTasks.length > 0) {
          const taskList = currentTasks.map((t, i) => `${i + 1}. ${t.title} (${t.priority}, ${t.status})`).join(', ');
          fallbackResponse.reply = `You have ${currentTasks.length} task(s): ${taskList}`;
        } else {
          fallbackResponse.reply = "You don't have any tasks yet.";
        }
      } else {
        fallbackResponse.reply = "I can help you add or view tasks. Try: 'Add a task to...' or 'What are my tasks?'";
      }

      return new Response(JSON.stringify(fallbackResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async executeTaskAction(action, taskData) {
    const tasks = await this.state.storage.get('tasks') || [];

    if (action === 'add') {
      tasks.push({
        id: Date.now().toString(),
        title: taskData.title || 'Untitled Task',
        description: taskData.description || '',
        priority: taskData.priority || 'medium',
        status: taskData.status || 'pending',
        createdAt: new Date().toISOString()
      });
    } else if (action === 'update' && taskData.id) {
      const index = tasks.findIndex(t => t.id === taskData.id);
      if (index !== -1) {
        tasks[index] = { ...tasks[index], ...taskData };
      }
    } else if (action === 'delete' && taskData.id) {
      const index = tasks.findIndex(t => t.id === taskData.id);
      if (index !== -1) {
        tasks.splice(index, 1);
      }
    }

    await this.state.storage.put('tasks', tasks);
  }

  async handleHistory(request) {
    const history = await this.state.storage.get('chatHistory') || [];
    return new Response(JSON.stringify(history), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}