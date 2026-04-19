import { getEnv } from '../utils/envManager';
import * as admin from '../../bybit/bot/adminHandler';
import * as stats from '../../bybit/bot/statsHandler';
import { handlePhoto } from '../../bybit/bot/photoHandler';

function commandFromText(text: string | undefined): string | null {
    if (!text) return null;
    const first = text.trim().split(/\s+/)[0];
    if (!first?.startsWith('/')) return null;
    return first.slice(1).split('@')[0]!.toLowerCase();
}

export async function handleMessage(message: tgTypes.Message): Promise<void> {
    const env = getEnv();
    const chatId = message.chat.id;
    const userId = message.from?.id;
    if (!userId) return;

    if ('photo' in message && message.photo?.length) {
        await handlePhoto(env, message);
        return;
    }

    const text = 'text' in message ? message.text : undefined;
    const cmd = commandFromText(text);

    if (cmd === 'start') {
        await stats.handleStart(env, chatId, userId, message.message_id);
        return;
    }
    if (cmd === 'admin') {
        await admin.handleAdmin(env, chatId, userId, message.message_id);
        return;
    }
    if (cmd === 'week') {
        await stats.handleWeek(env, chatId, userId, message.message_id);
        return;
    }
    if (cmd === 'lastweek') {
        await stats.handleLastWeek(env, chatId, userId, message.message_id);
        return;
    }
    if (cmd === 'month') {
        await stats.handleMonth(env, chatId, userId, message.message_id);
        return;
    }
    if (cmd === 'lastmonth') {
        await stats.handleLastMonth(env, chatId, userId, message.message_id);
        return;
    }

    if (text === 'Export all' && admin.isAdmin(userId)) {
        await admin.handleExportAll(env, chatId, userId, message.message_id);
        return;
    }

    await stats.handleUnknownText(env, chatId, userId, message.message_id);
}
