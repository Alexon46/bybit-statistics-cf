const key = (userId: number) => `bot_msg_ids:${userId}`;

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
