export type UserRole = "customer"|"contractor"|"supplier"|"driver"|"professional"|"admin"|"super_admin";
export type OrderStatus = "draft"|"awaiting_payment"|"paid"|"confirmed"|"preparing"|"ready_for_dispatch"|"in_transit"|"partially_delivered"|"delivered"|"completed"|"disputed"|"refunded"|"cancelled";
export interface ProductListing { id:string; product_id:string; supplier_id:string; price:number; unit:string; stock_status:"in_stock"|"low_stock"|"out_of_stock"|"confirmation_required"; }
