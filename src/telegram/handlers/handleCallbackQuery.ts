import { getEnv } from '../utils/envManager';
import { handleDetailCallback } from '../../bybit/bot/statsHandler';

export async function handleCallbackQuery(callbackQuery: tgTypes.CallbackQuery): Promise<void> {
    if (callbackQuery.data?.startsWith('detail:')) {
        await handleDetailCallback(getEnv(), callbackQuery);
    }
}
