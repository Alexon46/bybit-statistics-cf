import type { Trade } from '../types/trade';

const key = (userId: number) => `bot_msg_ids:${userId}`;
const pendingOverwriteKey = (userId: number, orderId: string) => `pending_overwrite:${userId}:${orderId}`;

const PENDING_OVERWRITE_TTL_SECONDS = 3600;

export async function getStoredMessageIds(env: Env, userId: number): Promise<number[]> {
    if (!env.MESSAGE_STORE) return [];
    const raw = await env.MESSAGE_STORE.get(key(userId));
    if (!raw) return [];
    try {
        return JSON.parse(raw) as number[];
    } catch {
        return [];
    }
}

export async function clearStoredMessages(env: Env, userId: number): Promise<void> {
    if (!env.MESSAGE_STORE) return;
    await env.MESSAGE_STORE.delete(key(userId));
}

export async function storeMessageIds(env: Env, userId: number, messageIds: number[]): Promise<void> {
    if (!env.MESSAGE_STORE) return;
    await env.MESSAGE_STORE.put(key(userId), JSON.stringify(messageIds));
}

export async function storePendingOverwrite(env: Env, userId: number, trade: Trade): Promise<void> {
    if (!env.MESSAGE_STORE) return;
    await env.MESSAGE_STORE.put(
        pendingOverwriteKey(userId, trade.order_id),
        JSON.stringify(trade),
        { expirationTtl: PENDING_OVERWRITE_TTL_SECONDS },
    );
}

export async function getPendingOverwrite(env: Env, userId: number, orderId: string): Promise<Trade | null> {
    if (!env.MESSAGE_STORE) return null;
    const raw = await env.MESSAGE_STORE.get(pendingOverwriteKey(userId, orderId));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as Trade;
    } catch {
        return null;
    }
}

export async function clearPendingOverwrite(env: Env, userId: number, orderId: string): Promise<void> {
    if (!env.MESSAGE_STORE) return;
    await env.MESSAGE_STORE.delete(pendingOverwriteKey(userId, orderId));
}
