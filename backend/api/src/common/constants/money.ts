/**
 * Ceiling for any single money amount accepted from a client.
 *
 * Every money column is `numeric(14,2)`, which tops out at 999,999,999,999.99. Without an
 * upper bound in the DTO, a larger value reaches Postgres and comes back as a numeric
 * overflow — a raw 500 for what is plainly bad input.
 *
 * The limit is set two orders of magnitude below the column's true maximum on purpose:
 * `merchant_subscriptions.total_collected` accumulates these amounts, and a per-amount
 * ceiling equal to the column maximum would let the running total overflow instead.
 */
export const MAX_MONEY_AMOUNT = 9_999_999_999.99;
