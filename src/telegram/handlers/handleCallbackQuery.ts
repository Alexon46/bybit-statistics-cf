import { getEnv } from '../utils/envManager';
import { tg } from '../lib/methods';
import { handleDetailCallback } from '../../bybit/bot/statsHandler';
import { takePendingOverwrite } from '../../bybit/bot/messageStore';
import * as db from '../../bybit/services/databaseService';
import { getProfitUsdt } from '../../bybit/services/statsService';

async function handleOverwriteCallback(callbackQuery: tgTypes.CallbackQuery, orderId: string): Promise<void> {
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message?.chat.id;
    const messageId = callbackQuery.message?.message_id;

    await tg.answerCallbackQuery({ callback_query_id: callbackQuery.id });

    const trade = await takePendingOverwrite(userId, orderId);
    if (!trade) {
        if (chatId && messageId) {
            await tg.editMessageText({
                chat_id: chatId,
                message_id: messageId,
                text: `Не удалось обновить ордер ${orderId}: данные не найдены или устарели. Отправьте скриншот повторно.`,
            });
        }
        return;
    }

    const tradeWithProfit = { ...trade, profitUsdt: getProfitUsdt(trade) };
    await db.upsert(tradeWithProfit, userId);

    if (chatId && messageId) {
        const summary = [
            `Ордер обновлён: ${trade.order_id}`,
            `${trade.pair} | ${trade.investment_amount} ${trade.investment_currency}`,
            `Доходность: ${trade.yield_amount} ${trade.yield_currency}`,
        ].join('\n');

        await tg.editMessageText({
            chat_id: chatId,
            message_id: messageId,
            text: summary,
        });
    }
}

export async function handleCallbackQuery(callbackQuery: tgTypes.CallbackQuery): Promise<void> {
    if (callbackQuery.data?.startsWith('detail:')) {
        await handleDetailCallback(getEnv(), callbackQuery);
        return;
    }

    if (callbackQuery.data?.startsWith('overwrite:')) {
        const orderId = callbackQuery.data.slice('overwrite:'.length);
        await handleOverwriteCallback(callbackQuery, orderId);
    }
}
