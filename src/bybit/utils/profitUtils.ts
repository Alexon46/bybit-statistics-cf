import type { Trade } from '../types/trade';

export function getInvestmentUsdt(t: Trade): number {
    const invIsUsdt = t.investment_currency.toUpperCase() === 'USDT';
    if (invIsUsdt) {
        return t.investment_amount;
    }
    const yieldIsUsdt = t.yield_currency.toUpperCase() === 'USDT';
    if (yieldIsUsdt) {
        return t.investment_amount * t.target_price;
    }
    const price = t.settlement_price > 0 ? t.settlement_price : t.target_price;
    return t.investment_amount * price;
}

export function getProfitUsdt(t: Trade): number {
    const invIsUsdt = t.investment_currency.toUpperCase() === 'USDT';
    const yieldIsUsdt = t.yield_currency.toUpperCase() === 'USDT';

    if (invIsUsdt && yieldIsUsdt) {
        return t.yield_amount - t.investment_amount;
    }
    if (invIsUsdt) {
        return t.yield_amount * t.target_price - t.investment_amount;
    }
    if (yieldIsUsdt) {
        return t.yield_amount - t.investment_amount * t.target_price;
    }
    return (t.yield_amount - t.investment_amount) * t.settlement_price;
}
