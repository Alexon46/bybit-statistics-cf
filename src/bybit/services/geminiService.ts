import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Trade } from '../types/trade';

const EXTRACTION_PROMPT = `You are analyzing a screenshot from the Bybit mobile app showing a "Dual Currency Investment" (Бивалютные инвестиции) order details pop-up.

Extract ALL fields visible in the "Информация об ордере" (Order Information) section. Return ONLY valid JSON, no markdown or extra text.

Required JSON structure (use empty string "" if a field is not visible):
{
  "order_id": "UUID format, e.g. 7c477b18-a64a-4ff7-909a-61608de0f57c",
  "pair": "e.g. ETH-USDT",
  "investment_amount": number (e.g. 200.1487),
  "investment_currency": "e.g. USDT",
  "order_direction": "e.g. Купить дёшево or Продать дорого",
  "term": "e.g. < 1 Day",
  "target_price": number (remove commas, e.g. 1900.0000),
  "apr": number (without % symbol, e.g. 1987.72),
  "placement_time": "ISO datetime UTC, e.g. 2026-02-06T12:15:00.000Z",
  "order_type": "e.g. Подписаться",
  "order_status": "e.g. Завершён",
  "settlement_time": "ISO datetime UTC, e.g. 2026-02-07T07:59:00.000Z",
  "settlement_price": number (remove commas, e.g. 2025.3011),
  "yield_amount": number (e.g. 203.7819),
  "yield_currency": "e.g. USDT",
  "to_account": "e.g. Аккаунт финансирования"
}

CRITICAL: If order_id (ID ордера) is not visible or cannot be read, return {"order_id": ""}.
Numbers: remove thousand separators (commas), use dot for decimals.`;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
}

/**
 * Workers have no sharp; we send the image as-is (Telegram already compresses photos).
 */
export async function extractTradeFromImage(
    imageBuffer: ArrayBuffer,
    apiKey: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
): Promise<Trade | null> {
    const base64Image = arrayBufferToBase64(imageBuffer);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

    const result = await model.generateContent([
        { text: EXTRACTION_PROMPT },
        {
            inlineData: {
                mimeType,
                data: base64Image,
            },
        },
    ]);

    const text = result.response.text();
    if (!text) {
        return null;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return null;
    }

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
        return null;
    }

    const orderId = String(parsed.order_id ?? '').trim();
    if (!orderId) {
        return null;
    }

    return {
        order_id: orderId,
        pair: String(parsed.pair ?? ''),
        investment_amount: Number(parsed.investment_amount) || 0,
        investment_currency: String(parsed.investment_currency ?? ''),
        order_direction: String(parsed.order_direction ?? ''),
        term: String(parsed.term ?? ''),
        target_price: Number(parsed.target_price) || 0,
        apr: Number(parsed.apr) || 0,
        placement_time: String(parsed.placement_time ?? ''),
        order_type: String(parsed.order_type ?? ''),
        order_status: String(parsed.order_status ?? ''),
        settlement_time: String(parsed.settlement_time ?? ''),
        settlement_price: Number(parsed.settlement_price) || 0,
        yield_amount: Number(parsed.yield_amount) || 0,
        yield_currency: String(parsed.yield_currency ?? ''),
        to_account: String(parsed.to_account ?? ''),
    };
}
