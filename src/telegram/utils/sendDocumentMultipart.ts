import { getEnv } from './envManager';

interface TelegramApiResponse {
    ok: boolean;
    result?: tgTypes.Message;
    description?: string;
}

/**
 * Telegram sendDocument with file upload (multipart). The generated callApi only supports query-string POST/GET.
 */
export async function sendDocumentMultipart(
    chatId: number,
    bytes: Uint8Array,
    filename: string,
    options?: { caption?: string; mimeType?: string },
): Promise<tgTypes.Message> {
    const token = getEnv().TOKEN;
    const form = new FormData();
    form.append('chat_id', String(chatId));
    const blob = new Blob([bytes], { type: options?.mimeType ?? 'application/octet-stream' });
    form.append('document', blob, filename);
    if (options?.caption) {
        form.append('caption', options.caption);
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: form,
    });
    const data = (await res.json()) as TelegramApiResponse;
    if (!data.ok || !data.result) {
        throw new Error(`sendDocument failed: ${JSON.stringify(data)}`);
    }
    return data.result;
}
