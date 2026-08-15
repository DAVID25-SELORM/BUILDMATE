import{readFileSync}from"node:fs";import{join}from"node:path";import{describe,expect,it}from"vitest";
const sql=readFileSync(join(process.cwd(),"supabase","migrations","202608150056_inventory_ledger_and_automatic_stock.sql"),"utf8").toLowerCase();
describe("transactional inventory ledger",()=>{
 it("uses append-only movements and per-location balances",()=>{expect(sql).toContain("create table public.inventory_movements");expect(sql).toContain("create table public.inventory_balances");expect(sql).toContain("inventory_balance_warehouse_unique");expect(sql).not.toContain("delete from inventory_movements")});
 it("prevents overselling and duplicate order movements",()=>{expect(sql).toContain("for update");expect(sql).toContain("insufficient inventory for this movement");expect(sql).toContain("inventory_movement_idempotency");expect(sql).toContain("sale_reservation");expect(sql).toContain("reservation_release");expect(sql).toContain("sale_completed")});
 it("integrates only authoritative order transitions",()=>{expect(sql).toContain("new.status='confirmed'");expect(sql).toContain("new.status='completed'");expect(sql).toContain("new.status in('cancelled','refunded')")});
 it("protects cost data behind security-definer permission-aware RPCs",()=>{expect(sql).toContain("revoke all on public.inventory_balances,public.inventory_movements");expect(sql).toContain("has_permission('inventory.view_cost'");expect(sql).toContain("has_permission('inventory.view_valuation'")});
 it("supports receipts, adjustments, returns and transfers",()=>{for(const name of["inventory_receive_stock","inventory_adjust_stock","inventory_record_return","inventory_transfer_stock"])expect(sql).toContain(name)});
});
