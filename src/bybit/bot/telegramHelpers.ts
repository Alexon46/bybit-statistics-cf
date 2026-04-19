import { tg } from '../../telegram/lib/methods';
import { clearStoredMessages, getStoredMessageIds } from './messageStore';

export async function tryDeleteUserMessage(chatId: number, messageId: number | undefined): Promise<void> {
    if (messageId === undefined) return;
    try {
        await tg.deleteMessage({ chat_id: chatId, message_id: messageId });
    } catch {
        // Private chats: bot often cannot delete user messages
    }
}

export async function deletePreviousBotMessages(env: Env, chatId: number, userId: number): Promise<void> {
    const ids = await getStoredMessageIds(env, userId);
    if (ids.length === 0) return;

    for (const msgId of ids) {
        try {
            await tg.deleteMessage({ chat_id: chatId, message_id: msgId });
        } catch {
            // May already be deleted
        }
    }
    await clearStoredMessages(env, userId);
}
