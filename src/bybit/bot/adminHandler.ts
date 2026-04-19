import { tg } from '../../telegram/lib/methods';
import { sendDocumentMultipart } from '../../telegram/utils/sendDocumentMultipart';
import { ADMIN_USER_ID } from '../constants';
import * as db from '../services/databaseService';
import { deletePreviousBotMessages, tryDeleteUserMessage } from './telegramHelpers';
import { storeMessageIds } from './messageStore';

const ADMIN_KEYBOARD: tgTypes.ReplyKeyboardMarkup = {
    keyboard: [[{ text: 'Export all' }]],
    resize_keyboard: true,
    is_persistent: true,
};

export function isAdmin(userId: number): boolean {
    return userId === ADMIN_USER_ID;
}

export async function handleAdmin(env: Env, chatId: number, userId: number, userMessageId?: number): Promise<void> {
    if (!isAdmin(userId)) return;

    await tryDeleteUserMessage(chatId, userMessageId);
    await deletePreviousBotMessages(env, chatId, userId);

    const msg = await tg.sendMessage({
        chat_id: chatId,
        text: 'Админ-панель. Выберите действие:',
        reply_markup: ADMIN_KEYBOARD,
    });
    await storeMessageIds(env, userId, [msg.message_id]);
}

export async function handleExportAll(env: Env, chatId: number, userId: number, userMessageId?: number): Promise<void> {
    if (!isAdmin(userId)) return;

    await tryDeleteUserMessage(chatId, userMessageId);
    await deletePreviousBotMessages(env, chatId, userId);

    const statusMsg = await tg.sendMessage({ chat_id: chatId, text: 'Формирую экспорт...' });

    try {
        const data = await db.getAllUsersData();
        const json = JSON.stringify(data, null, 2);
        const bytes = new TextEncoder().encode(json);
        const filename = `bybit-export-${new Date().toISOString().slice(0, 10)}.json`;

        await tg.deleteMessage({ chat_id: chatId, message_id: statusMsg.message_id });
        await sendDocumentMultipart(chatId, bytes, filename, {
            caption: `Экспорт данных всех пользователей (${Object.keys(data).length} пользователей)`,
            mimeType: 'application/json',
        });
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Неизвестная ошибка';
        await tg
            .editMessageText({
                chat_id: chatId,
                message_id: statusMsg.message_id,
                text: `Ошибка: ${errMsg}`,
            })
            .catch(() => {});
        await storeMessageIds(env, userId, [statusMsg.message_id]);
    }
}
