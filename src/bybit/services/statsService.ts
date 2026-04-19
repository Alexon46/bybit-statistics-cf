import * as db from './databaseService';
import type { Trade } from '../types/trade';
import { getProfitUsdt, getInvestmentUsdt } from '../utils/profitUtils';
import { PERIOD_LABELS, DETAIL_REPORT_SEPARATOR } from '../constants';

export type PeriodKey = keyof typeof PERIOD_LABELS;

export interface StatsResult {
    count: number;
    totalProfitUsdt: number;
    avgOrderSizeUsdt: number;
    avgReturnPercent: number;
    avgApr: number;
    byPair: Record<string, { count: number; profitUsdt: number }>;
}

export interface TradeWithProfit extends Trade {
    profitUsdt: number;
}

export { getProfitUsdt };

function getWeekBounds(weekOffset: number): { start: Date; end: Date } {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setUTCDate(now.getUTCDate() + mondayOffset);
    thisMonday.setUTCHours(0, 0, 0, 0);

    const start = new Date(thisMonday);
    start.setUTCDate(thisMonday.getUTCDate() + weekOffset * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    end.setMilliseconds(-1);

    return { start, end };
}

function getMonthBounds(monthOffset: number): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
    const end = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + 1, 0, 23, 59, 59, 999),
    );
    return { start, end };
}

function getBoundsForPeriod(period: PeriodKey): { start: Date; end: Date } {
    const periodMap: Record<PeriodKey, () => { start: Date; end: Date }> = {
        week: () => getWeekBounds(0),
        lastweek: () => getWeekBounds(-1),
        month: () => getMonthBounds(0),
        lastmonth: () => getMonthBounds(-1),
    };
    return periodMap[period]();
}

function aggregateStats(trades: Trade[]): StatsResult {
    const byPair: Record<string, { count: number; profitUsdt: number }> = {};
    let totalProfitUsdt = 0;
    let totalInvestmentUsdt = 0;
    let aprSum = 0;
    let aprCount = 0;

    for (const t of trades) {
        const profitUsdt = t.profitUsdt ?? getProfitUsdt(t);
        totalProfitUsdt += profitUsdt;
        totalInvestmentUsdt += getInvestmentUsdt(t);
        if (t.apr > 0) {
            aprSum += t.apr;
            aprCount++;
        }
        if (!byPair[t.pair]) {
            byPair[t.pair] = { count: 0, profitUsdt: 0 };
        }
        byPair[t.pair].count++;
        byPair[t.pair].profitUsdt += profitUsdt;
    }

    const n = trades.length;
    const avgOrderSizeUsdt = n > 0 ? totalInvestmentUsdt / n : 0;
    const avgReturnPercent = avgOrderSizeUsdt > 0 ? (totalProfitUsdt / avgOrderSizeUsdt) * 100 : 0;
    return {
        count: n,
        totalProfitUsdt,
        avgOrderSizeUsdt,
        avgReturnPercent,
        avgApr: aprCount > 0 ? aprSum / aprCount : 0,
        byPair,
    };
}

export async function getStats(userId: number, period: PeriodKey): Promise<StatsResult> {
    const { start, end } = getBoundsForPeriod(period);
    const trades = await db.queryByPeriod(userId, start, end);
    return aggregateStats(trades);
}

export async function getTradesForPeriod(userId: number, period: PeriodKey): Promise<TradeWithProfit[]> {
    const { start, end } = getBoundsForPeriod(period);
    const trades = await db.queryByPeriod(userId, start, end);
    const withProfit = trades.map((t) => ({
        ...t,
        profitUsdt: t.profitUsdt ?? getProfitUsdt(t),
    }));
    withProfit.sort((a, b) => {
        const timeA = a.settlement_time ? new Date(a.settlement_time).getTime() : 0;
        const timeB = b.settlement_time ? new Date(b.settlement_time).getTime() : 0;
        return timeA - timeB;
    });
    return withProfit;
}

export function formatStats(stats: StatsResult, periodLabel: string): string {
    if (stats.count === 0) {
        return `${periodLabel}\n\nНет данных за выбранный период.`;
    }

    const lines = [
        periodLabel,
        '',
        `Сделок: ${stats.count}`,
        `Средний размер ордера (USDT): ${stats.avgOrderSizeUsdt.toFixed(2)}`,
        `Средний APR: ${stats.avgApr.toFixed(2)}%`,
        `Доходность (USDT): ${stats.totalProfitUsdt.toFixed(2)} (${stats.avgReturnPercent.toFixed(2)}%)`,
        '',
        'По парам:',
    ];

    for (const [pair, data] of Object.entries(stats.byPair)) {
        lines.push(`  ${pair}: ${data.count} сделок, доход ${data.profitUsdt.toFixed(2)} USDT`);
    }

    return lines.join('\n');
}

export function formatDetailReport(
    trades: TradeWithProfit[],
    periodLabel: string,
): { text: string; lines: string[] } {
    const lines = [`📋 Детальный отчёт: ${periodLabel}\n`];
    let total = 0;

    for (let i = 0; i < trades.length; i++) {
        if (i > 0) lines.push(DETAIL_REPORT_SEPARATOR);
        const t = trades[i];
        const date = t.settlement_time
            ? new Date(t.settlement_time).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
              })
            : '—';
        lines.push(`${t.pair} | ${date} | ${t.profitUsdt.toFixed(2)} USDT`);
        total += t.profitUsdt;
    }
    lines.push(DETAIL_REPORT_SEPARATOR, `Итого: ${total.toFixed(2)} USDT`);

    return { text: lines.join('\n'), lines };
}

export function splitIntoChunks(lines: string[], maxLength: number): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const line of lines) {
        if (current.length + line.length + 1 > maxLength) {
            chunks.push(current);
            current = line;
        } else {
            current += (current ? '\n' : '') + line;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}
