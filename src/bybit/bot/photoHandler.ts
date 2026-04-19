import { tg } from '../../telegram/lib/methods';
import { getEnv } from '../../telegram/utils/envManager';
import { extractTradeFromImage } from '../services/geminiService';
import { getProfitUsdt } from '../services/statsService';
import * as db from '../services/databaseService';
import { deletePreviousBotMessages, tryDeleteUserMessage } from './telegramHelpers';
import { storeMessageIds } from './messageStore';

async function downloadPhoto(fileId: string): Promise<{ buffer: ArrayBuffer; mime: 'image/jpeg' | 'image/png' | 'image/webp' }> {
    const fileMeta = await tg.getFile({ file_id: fileId });
    const path = fileMeta.file_path;
    if (!path) {
        throw new Error('No file_path from Telegram');
    }
    const token = getEnv().TOKEN;
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
    if (!response.ok) {
        throw new Error('Failed to download photo');
    }
    const buffer = await response.arrayBuffer();
    const lower = path.toLowerCase();
    const mime: 'image/jpeg' | 'image/png' | 'image/webp' = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
    return { buffer, mime };
}

async function editStatusMessage(chatId: number, messageId: number, text: string): Promise<void> {
    await tg.editMessageText({ chat_id: chatId, message_id: messageId, text });
}

export async function handlePhoto(env: Env, message: tgTypes.Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) {
        await tg.sendMessage({ chat_id: message.chat.id, text: 'Не удалось определить пользователя.' });
        return;
    }

    const chatId = message.chat.id;
    const geminiKey = getEnv().GEMINI_API_KEY;
    if (!geminiKey) {
        await tg.sendMessage({ chat_id: chatId, text: 'Ошибка: GEMINI_API_KEY не настроен.' });
        return;
    }

    const photos = message.photo;
    if (!photos?.length) {
        await tg.sendMessage({ chat_id: chatId, text: 'Фото не получено.' });
        return;
    }

    const fileId = photos[photos.length - 1]!.file_id;
    await tryDeleteUserMessage(chatId, message.message_id);
    await deletePreviousBotMessages(env, chatId, userId);

    const statusMsg = await tg.sendMessage({ chat_id: chatId, text: 'Обрабатываю скриншот...' });

    try {
        const { buffer, mime } = await downloadPhoto(fileId);
        const trade = await extractTradeFromImage(buffer, geminiKey, mime);

        if (!trade) {
            await editStatusMessage(
                chatId,
                statusMsg.message_id,
                'Ордер не распознан. Убедитесь, что на скриншоте видно окно «Информация об ордере» с полем ID ордера.',
            );
            await storeMessageIds(env, userId, [statusMsg.message_id]);
            return;
        }

        if (await db.exists(trade.order_id, userId)) {
            await editStatusMessage(
                chatId,
                statusMsg.message_id,
                `Дубликат. Ордер ${trade.order_id} уже добавлен ранее.`,
            );
            await storeMessageIds(env, userId, [statusMsg.message_id]);
            return;
        }

        const tradeWithProfit = { ...trade, profitUsdt: getProfitUsdt(trade) };
        await db.insert(tradeWithProfit, userId);

        const summary = [
            `Ордер сохранён: ${trade.order_id}`,
            `${trade.pair} | ${trade.investment_amount} ${trade.investment_currency}`,
            `Доходность: ${trade.yield_amount} ${trade.yield_currency}`,
        ].join('\n');

        await editStatusMessage(chatId, statusMsg.message_id, summary);
        await storeMessageIds(env, userId, [statusMsg.message_id]);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Неизвестная ошибка';
        await editStatusMessage(chatId, statusMsg.message_id, `Ошибка обработки: ${errMsg}`).catch(() => {});
        await storeMessageIds(env, userId, [statusMsg.message_id]);
    }
}
