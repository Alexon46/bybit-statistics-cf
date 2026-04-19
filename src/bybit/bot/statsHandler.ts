import { tg } from '../../telegram/lib/methods';
import {
    getStats,
    getTradesForPeriod,
    formatStats,
    formatDetailReport,
    splitIntoChunks,
    type PeriodKey,
} from '../services/statsService';
import { PERIOD_LABELS, TELEGRAM_MESSAGE_LIMIT } from '../constants';
import { deletePreviousBotMessages, tryDeleteUserMessage } from './telegramHelpers';
import { storeMessageIds } from './messageStore';
import { isAdmin } from './adminHandler';

const PERIODS: PeriodKey[] = ['week', 'lastweek', 'month', 'lastmonth'];

function detailKeyboard(period: PeriodKey): tgTypes.InlineKeyboardMarkup {
    return {
        inline_keyboard: [[{ text: 'Детальный отчёт', callback_data: `detail:${period}` }]],
    };
}

const STATS_KEYBOARD: tgTypes.ReplyKeyboardMarkup = {
    keyboard: [
        [{ text: '/week' }, { text: '/lastweek' }],
        [{ text: '/month' }, { text: '/lastmonth' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
};

const ADMIN_START_KEYBOARD: tgTypes.ReplyKeyboardMarkup = {
    keyboard: [
        [{ text: '/week' }, { text: '/lastweek' }],
        [{ text: '/month' }, { text: '/lastmonth' }],
        [{ text: '/admin' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
};

export async function handleStart(env: Env, chatId: number, userId: number, userMessageId?: number): Promise<void> {
    await tryDeleteUserMessage(chatId, userMessageId);
    const text = [
        'Привет! Я бот для учёта Бивалютных инвестиций Bybit.',
        '',
        'Отправь скриншот окна «Информация об ордере» — я извлеку данные и сохраню.',
        '',
        'Используй кнопки ниже для быстрой статистики:',
    ].join('\n');
    const keyboard = isAdmin(userId) ? ADMIN_START_KEYBOARD : STATS_KEYBOARD;
    await tg.sendMessage({ chat_id: chatId, text, reply_markup: keyboard });
}

function createStatsHandler(period: PeriodKey) {
    return async (env: Env, chatId: number, userId: number, userMessageId?: number): Promise<void> => {
        await tryDeleteUserMessage(chatId, userMessageId);
        await deletePreviousBotMessages(env, chatId, userId);

        const stats = await getStats(userId, period);
        const label = `📊 ${PERIOD_LABELS[period]}`;
        const keyboard = stats.count > 0 ? detailKeyboard(period) : undefined;
        const msg = await tg.sendMessage({
            chat_id: chatId,
            text: formatStats(stats, label),
            reply_markup: keyboard,
        });
        await storeMessageIds(env, userId, [msg.message_id]);
    };
}

export async function handleUnknownText(
    env: Env,
    chatId: number,
    userId: number,
    userMessageId?: number,
): Promise<void> {
    await tryDeleteUserMessage(chatId, userMessageId);
    await deletePreviousBotMessages(env, chatId, userId);

    const msg = await tg.sendMessage({
        chat_id: chatId,
        text: 'Отправьте фото скриншота или выберите команду из меню.',
    });
    await storeMessageIds(env, userId, [msg.message_id]);
}

export const handleWeek = createStatsHandler('week');
export const handleLastWeek = createStatsHandler('lastweek');
export const handleMonth = createStatsHandler('month');
export const handleLastMonth = createStatsHandler('lastmonth');

function isValidPeriod(match: string | undefined): match is PeriodKey {
    return typeof match === 'string' && PERIODS.includes(match as PeriodKey);
}

export async function handleDetailCallback(env: Env, callbackQuery: tgTypes.CallbackQuery): Promise<void> {
    const data = callbackQuery.data;
    if (!data || !data.startsWith('detail:')) return;
    const period = data.slice('detail:'.length);
    if (!isValidPeriod(period)) return;

    const userId = callbackQuery.from.id;
    const msg = callbackQuery.message;
    if (!msg || !('chat' in msg)) return;

    const chatId = msg.chat.id;

    await tg.answerCallbackQuery({ callback_query_id: callbackQuery.id });

    const trades = await getTradesForPeriod(userId, period);
    const label = PERIOD_LABELS[period];
    const noButton = { inline_keyboard: [] as tgTypes.InlineKeyboardButton[][] };

    if (trades.length === 0) {
        await tg.editMessageText({
            chat_id: chatId,
            message_id: msg.message_id,
            text: `${label}\n\nНет ордеров за выбранный период.`,
            reply_markup: noButton,
        });
        return;
    }

    const { text, lines } = formatDetailReport(trades, label);

    if (text.length > TELEGRAM_MESSAGE_LIMIT) {
        const chunks = splitIntoChunks(lines, TELEGRAM_MESSAGE_LIMIT);
        const editedMsgId = msg.message_id;

        await tg.editMessageText({
            chat_id: chatId,
            message_id: editedMsgId,
            text: chunks[0]!,
            reply_markup: noButton,
        });
        const chunkIds: number[] = [editedMsgId];

        for (let i = 1; i < chunks.length; i++) {
            const sent = await tg.sendMessage({ chat_id: chatId, text: chunks[i]! });
            chunkIds.push(sent.message_id);
        }
        await storeMessageIds(env, userId, chunkIds);
    } else {
        await tg.editMessageText({
            chat_id: chatId,
            message_id: msg.message_id,
            text,
            reply_markup: noButton,
        });
    }
}
