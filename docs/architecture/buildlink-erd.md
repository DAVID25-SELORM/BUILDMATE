# BuildLink Ghana Entity Relationship Diagram

This diagram summarizes the principal production entities. The SQL migrations remain the authoritative schema.

```mermaid
erDiagram
  PROFILES ||--o{ ORGANISATION_MEMBERS : joins
  ORGANISATIONS ||--o{ ORGANISATION_MEMBERS : has
  ORGANISATIONS ||--o{ SUPPLIER_BRANCHES : operates
  ORGANISATIONS ||--o{ SUPPLIER_WAREHOUSES : operates
  ORGANISATIONS ||--o{ SUPPLIER_LISTINGS : publishes
  PRODUCTS ||--o{ PRODUCT_VARIANTS : defines
  PRODUCTS ||--o{ SUPPLIER_LISTINGS : offered_as
  PRODUCT_VARIANTS ||--o{ SUPPLIER_LISTINGS : specializes
  SUPPLIER_BRANCHES ||--o{ SUPPLIER_LISTINGS : locates
  SUPPLIER_WAREHOUSES ||--o{ SUPPLIER_LISTINGS : optionally_stores
  SUPPLIER_LISTINGS ||--|| INVENTORY_BALANCES : summarizes
  SUPPLIER_LISTINGS ||--o{ INVENTORY_MOVEMENTS : records
  PROFILES ||--o{ ORDERS : places
  ORGANISATIONS ||--o{ ORDERS : supplies
  ORDERS ||--|{ ORDER_ITEMS : contains
  SUPPLIER_LISTINGS ||--o{ ORDER_ITEMS : purchased_as
  ORDERS ||--o{ PAYMENTS : paid_by
  ORDERS ||--o| DELIVERIES : fulfilled_by
  DELIVERIES ||--o{ DELIVERY_ATTEMPTS : records
  DELIVERY_ATTEMPTS ||--o{ DELIVERY_ATTEMPT_ITEMS : allocates
  ORDER_ITEMS ||--o{ DELIVERY_ATTEMPT_ITEMS : delivered_quantity
  ORDER_ITEMS ||--o{ INVENTORY_RETURNS : may_return
  QUOTE_REQUESTS ||--|{ QUOTE_REQUEST_ITEMS : requests
  QUOTE_REQUESTS ||--o{ SUPPLIER_QUOTES : receives
  SUPPLIER_QUOTES ||--|{ SUPPLIER_QUOTE_ITEMS : prices
  PROFILES ||--o{ AUDIT_LOGS : acts
```

## Inventory truth

`inventory_movements` is the append-only source of stock changes. `inventory_balances` stores the derived on-hand, reserved and available position. Exact-quantity listings cannot bypass the movement workflow through direct quantity updates.

## Security boundaries

Organisation membership, permissions and row-level security scope supplier and customer data. Cost and valuation fields are additionally masked for users without the relevant finance or inventory-valuation permission.
