# Database (Supabase)

Project: `qqthpckefdtmvkauboiv` · PostgreSQL 17 · region ap-northeast-1

The live database is the source of truth. It was built with these migrations
(Supabase Dashboard → Database → Migrations):

1. `menu_and_qr_order_functions`
2. `staff_functions`
3. `rls_realtime_seed`
4. `security_fix_and_staff_rpcs`
5. `qris_storage_and_fixes`
6. `orders_served_at`
7. `fix_checkout_ambiguity`
8. `lock_down_function_grants`

> ⚠️ Do NOT run old `schema.sql` drafts against production — they began with
> `DROP TABLE` and would wipe all transactions.

## Tables
| Table | Purpose |
|---|---|
| `profiles` | Staff (owner/kasir), linked to `auth.users`. New sign-ups are **inactive** until an owner activates them. |
| `settings` | Single row: store name, receipt footer, `qr_open`, QRIS image path |
| `categories`, `products` | Menu |
| `ingredients` | 6 separate chicken stocks (Bakar/Goreng × Dada/Paha/Sayap) |
| `product_ingredients` | Recipe: which stock a menu uses (Paket 1 → Goreng Dada, Paket 2 → Bakar Dada) |
| `tables` | 6 tables, each with a rotatable `qr_token` |
| `table_sessions` | One open bill per table; also the paid/void record for cashier sales |
| `orders`, `order_items` | Orders (price & cost snapshotted for accurate reports) |
| `stock_movements` | Manual stock adjustment audit trail |
| `expenses` | Expenses (kasir can add, owner edits/deletes) |

## Security model
- RLS on every table. `anon` (customer phone) can read **nothing** directly.
- Customers use only 4 RPCs: `menu_public`, `shop_info`, `place_customer_order` (requires valid table QR token), `order_status` (by order UUIDs the phone created).
- Every staff RPC checks `is_staff()` / `is_owner()` internally **and** has `EXECUTE` revoked from `anon`.
- Stock is locked (`SELECT … FOR UPDATE`) when an order is placed, so two tables can't take the last piece. Rejected/voided orders restore stock.
- QRIS image lives in a private Storage bucket `qris`, served to staff via short-lived signed URLs.
