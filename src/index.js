import { TaskManager } from './task-manager';

export { TaskManager };

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		const userId = request.headers.get('X-User-Id') || 'demo-user';

		const id = env.TASK_MANAGER.idFromName(userId);
		const stub = env.TASK_MANAGER.get(id);

		const response = await stub.fetch(request);

		const newResponse = new Response(response.body, response);
		Object.entries(corsHeaders).forEach(([key, value]) => {
			newResponse.headers.set(key, value);
		});

		return newResponse;
	}
};