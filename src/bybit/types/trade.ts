export interface Trade {
    order_id: string;
    pair: string;
    investment_amount: number;
    investment_currency: string;
    order_direction: string;
    term: string;
    target_price: number;
    apr: number;
    placement_time: string;
    order_type: string;
    order_status: string;
    settlement_time: string;
    settlement_price: number;
    yield_amount: number;
    yield_currency: string;
    to_account: string;
    created_at?: string;
    profitUsdt?: number;
}
