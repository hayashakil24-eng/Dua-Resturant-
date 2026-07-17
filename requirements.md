# Restaurant / Hotel Management Software

_Requirements & Scope Document_

## 1. Project Background

The client requires a complete Restaurant/Hotel Management Software solution.

## 2. Cashier / POS

- Create orders and generate itemized receipts/bills
- Track which table and which waiter each order is assigned to
- Track payment status (paid/pending)

## 3. Attendance

- Staff attendance tracking module

## 4. Accounting Software

- Complete accounting module (income, expenses, transactions)
- Ledger to be covered within the accounting module itself (no separate module)
- Profit & Loss Summary with charts — profit/loss displayed graphically, not just as numbers

## 5. Inventory System

- Stock register for every ingredient/item
- Stock automatically deducted as soon as an order is placed
- Real-time stock visibility for the admin
- Low-stock alerts
- Daily/monthly reports to include consumption and remaining stock

## 6. Reports

- Daily and monthly reports — including profit/loss and inventory
- All reports available in Urdu
- Automated daily report sent to the admin via WhatsApp

## 7. WhatsApp Integration

- Use the official Meta WhatsApp Cloud API — reliable, no risk of being banned
- Admin can request a report by messaging the system directly (free, within the service conversation window)
- If the system sends messages automatically, a minor charge applies (~$0.01–0.02/message)

## 8. Order Return / Void Handling

- A printed order cannot be deleted directly (fraud prevention)
- A "Return/Void" option is provided, with a mandatory reason
- Order status becomes "Returned/Voided" rather than being deleted
- Requires manager/admin approval or PIN
- Full audit trail (cashier, timestamp, reason) — reflected in the daily report

## 9. Active Tables View

- Live view of which tables are currently active
- Visible in real time to all cashiers
- Status indicated via color coding
- Additional orders placed later at the same table are added to the same bill
- The final bill is generated only at checkout

## 10. Kitchen Display System (KDS)

- Orders shown in real time on a kitchen screen (no printing required)
- Displays table number, order items, and assigned waiter
- Kitchen marks orders as "Ready," notifying the waiter

## 11. App Architecture

- Desktop application (offline-first) — not web-based
- Operates locally via a local database, without requiring internet access
- When internet is available, data is backed up/synced to the cloud (if a cloud option is included)

## 12. Data Hosting: Local Server (PC-based)

- A dedicated PC will serve as the "server" (Core i5, 8GB RAM, SSD)
- Connects to the restaurant's existing router
- No internet required for day-to-day operations
- Automatic daily backups (to an external hard drive/USB)

## 13. On-site Installation

- On-site setup includes: application installation, database configuration, printer setup, role/account creation (Admin, Cashier, Manager), and staff training
- Connect server to the router, connect devices via WiFi, configure IP addressing, allow firewall access, and conduct testing

## 14. Maintenance / Future Support

- Remote support via AnyDesk/TeamViewer when internet is available
- Built-in auto-update feature
- When internet is unavailable, updates applied manually via USB/patch file
- On-site visits for major issues or hardware problems

## 15. Order Punch → Kitchen Display Flow

As soon as the cashier punches/enters an order at the counter, that order automatically and instantly appears on the Kitchen Display System (KDS) in real time.

### Complete Flow

- The waiter takes the order and brings it to the cashier
- The cashier enters the order into the system (table number, items, quantities)

### Two things happen simultaneously at that moment:

- A slip/token is printed (for the waiter to collect from the counter/kitchen)
- The order instantly appears on the kitchen screen (table number, items, waiter's name)

- Kitchen staff view the order and begin preparation
- Once ready, the kitchen marks the order "Ready," and the waiter is notified

_In short: a single entry (order punch) accomplishes both tasks — the slip is generated and the order appears on the kitchen screen simultaneously. The cashier does not need to perform any additional steps._
