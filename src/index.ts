import { setEnv } from './telegram/utils/envManager';
import { handleWebhook } from './telegram/utils/handleUpdates';
import { tg } from './telegram/lib/methods';

// Define constant paths for webhook management.
const WEBHOOK: string = '/endpoint';
const REGISTER: string = '/registerWebhook';
const UNREGISTER: string = '/unRegisterWebhook';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        setEnv(env);
        const url: URL = new URL(request.url);

        if (url.pathname === WEBHOOK) {
            return handleWebhook(request);
        } else if (url.pathname === REGISTER) {
            try {
                const result = await tg.setWebhook({
                    url: `${url.protocol}//${url.hostname}${WEBHOOK}`,
                    secret_token: env.SECRET,
                });
                if (result) {
                    await tg.setMyCommands({
                        commands: [
                            { command: 'week', description: 'Статистика за текущую неделю' },
                            { command: 'lastweek', description: 'Статистика за прошлую неделю' },
                            { command: 'month', description: 'Статистика за текущий месяц' },
                            { command: 'lastmonth', description: 'Статистика за прошлый месяц' },
                        ],
                    });
                    return new Response('Webhook registered.');
                }
                return new Response('Failed to register webhook.');
            } catch (error) {
                ctx.waitUntil((async () => {
                    return new Promise(resolve => {
                        console.log(`Error: ${error}`);
                        resolve(error);
                    });
                })());
                return new Response(`Error: ${error}`);
            }
        } else if (url.pathname === UNREGISTER) {
            try {
                const result = await tg.setWebhook({
                    url: '',
                });
                if (result) return new Response('Webhook unregistered.');
                else return new Response('Failed to unregister webhook.');
            } catch (error) {
                return new Response(`Error: ${error}`);
            }
        } else {
            return new Response('Not found', { status: 404 });
        }
    },
} satisfies ExportedHandler<Env>;
