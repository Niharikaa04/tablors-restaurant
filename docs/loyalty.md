# Loyalty points (built from the two Tablors PDFs)

Run `scripts/sql/003_loyalty.sql` in the Supabase SQL editor before deploying
(after `002_payment_idempotency.sql`). Both are additive and safe to re-run.

## How it works
- Customer enters a mobile number on the bill screen (customer device) -> member is created or found.
- Bill is paid (cash or QR) -> `onBillPaymentConfirmed` -> `settleLoyaltyForBillDb`:
  commits the held reward (REDEEM) and credits points (EARN), once per bill
  (unique key `earn:<billId>`).
- Redeeming a reward on the bill HOLDS points and lowers the bill total. Points are
  deducted only when the bill is paid; "Remove reward" releases the hold.
- Refund -> `reverseLoyaltyForRefundDb` takes back points in proportion (never below 0).
- Ledger (`loyalty_transactions`) is append-only; balance = SUM(points).
- Owner page `/owner/loyalty`: earning rules, rewards (create/edit/activate/deactivate),
  members, ledger, manual adjustments (owner only, reason required), block/unblock.

## Defaults used until the owner saves settings (the Addendum's own example)
1 point per ₹10 of eligible spend; GST and service charge excluded; discounts deducted first.

## Decisions I made that you may want to change
- One reward per bill. A reward discount lowers the payable total; GST is not recalculated.
- Redeemed points are NOT restored when a bill is refunded (spec leaves this to policy).
- Free item / coupon / experience rewards create a redemption record and code only; staff apply them.
- Points are not credited for bills with a 100% discount (total 0), because the payment hook skips them.

## Not built yet (PDF items outside the MVP or needing more input)
- Points expiry: `expiry_months` stamps `expires_at` on each EARN row, but no job writes EXPIRE entries yet.
- Tiers, campaigns/multipliers, per-day/month earning limits, OTP verification of the phone number,
  item/category exclusions, SMS/push notifications to customers.
- Anyone who types a phone number can see that member's masked number and points balance on a bill
  screen. Add OTP before production.
- The older in-memory Pots-loyalty prototype (`financial-pots`) is untouched and not used by this flow.
