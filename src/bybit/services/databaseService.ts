import { neon } from '@neondatabase/serverless';
import type { Trade } from '../types/trade';
import { getEnv } from '../../telegram/utils/envManager';

let sql: ReturnType<typeof neon> | undefined;

function rowsFrom<T>(result: unknown): T[] {
    return Array.isArray(result) ? (result as T[]) : [];
}

function getSql() {
    const url = getEnv().DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL is required');
    }
    if (!sql) {
        sql = neon(url);
    }
    return sql;
}

interface TradeRow {
    order_id: string;
    pair: string;
    investment_amount: string;
    investment_currency: string;
    order_direction: string;
    term: string;
    target_price: string;
    apr: string;
    placement_time: string;
    order_type: string;
    order_status: string;
    settlement_time: string;
    settlement_price: string;
    yield_amount: string;
    yield_currency: string;
    to_account: string;
    profit_usdt: string | null;
    created_at: string | Date | null;
    user_id?: string;
}

function rowToTrade(row: TradeRow): Trade {
    const trade: Trade = {
        order_id: row.order_id,
        pair: row.pair,
        investment_amount: parseFloat(row.investment_amount),
        investment_currency: row.investment_currency,
        order_direction: row.order_direction,
        term: row.term,
        target_price: parseFloat(row.target_price),
        apr: parseFloat(row.apr),
        placement_time: row.placement_time,
        order_type: row.order_type,
        order_status: row.order_status,
        settlement_time: row.settlement_time,
        settlement_price: parseFloat(row.settlement_price),
        yield_amount: parseFloat(row.yield_amount),
        yield_currency: row.yield_currency,
        to_account: row.to_account,
    };
    if (row.created_at) {
        trade.created_at =
            row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
    }
    if (row.profit_usdt !== null && row.profit_usdt !== undefined) {
        trade.profitUsdt = parseFloat(row.profit_usdt);
    }
    return trade;
}

export async function exists(orderId: string, userId: number): Promise<boolean> {
    const rows = rowsFrom<{ x: number }>(
        await getSql()`
        SELECT 1 AS x
        FROM trades
        WHERE user_id = ${userId} AND order_id = ${orderId}
        LIMIT 1
    `,
    );
    return rows.length > 0;
}

export async function insert(trade: Trade, userId: number): Promise<void> {
    await getSql()`
        INSERT INTO trades (
            user_id, order_id, pair, investment_amount, investment_currency,
            order_direction, term, target_price, apr, placement_time, order_type,
            order_status, settlement_time, settlement_price, yield_amount,
            yield_currency, to_account, profit_usdt
        ) VALUES (
            ${userId},
            ${trade.order_id},
            ${trade.pair},
            ${trade.investment_amount},
            ${trade.investment_currency},
            ${trade.order_direction},
            ${trade.term},
            ${trade.target_price},
            ${trade.apr},
            ${trade.placement_time},
            ${trade.order_type},
            ${trade.order_status},
            ${trade.settlement_time},
            ${trade.settlement_price},
            ${trade.yield_amount},
            ${trade.yield_currency},
            ${trade.to_account},
            ${trade.profitUsdt ?? null}
        )
    `;
}

export async function queryByPeriod(userId: number, startTime: Date, endTime: Date): Promise<Trade[]> {
    const rows = rowsFrom<TradeRow>(
        await getSql()`
        SELECT order_id, pair, investment_amount, investment_currency, order_direction,
               term, target_price, apr, placement_time, order_type, order_status,
               settlement_time, settlement_price, yield_amount, yield_currency,
               to_account, profit_usdt, created_at
        FROM trades
        WHERE user_id = ${userId}
          AND settlement_time::timestamptz >= ${startTime.toISOString()}
          AND settlement_time::timestamptz <= ${endTime.toISOString()}
        ORDER BY settlement_time ASC
    `,
    );
    return rows.map(rowToTrade);
}

export async function getAllUsersData(): Promise<Record<string, Trade[]>> {
    const rows = rowsFrom<TradeRow & { user_id: string }>(
        await getSql()`
        SELECT user_id, order_id, pair, investment_amount, investment_currency,
               order_direction, term, target_price, apr, placement_time, order_type,
               order_status, settlement_time, settlement_price, yield_amount,
               yield_currency, to_account, profit_usdt, created_at
        FROM trades
        ORDER BY user_id, settlement_time ASC
    `,
    );
    const byUser: Record<string, Trade[]> = {};
    for (const row of rows) {
        const uid = row.user_id;
        if (!byUser[uid]) byUser[uid] = [];
        byUser[uid].push(rowToTrade(row));
    }
    return byUser;
}
