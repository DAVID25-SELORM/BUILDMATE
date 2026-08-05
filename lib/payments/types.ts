export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
export interface CheckoutRequest { paymentId:string; orderNumber:string; amount:number; customerEmail:string; callbackUrl:string; returnUrl:string }
export interface CheckoutResult { reference:string; checkoutUrl:string; raw:unknown }
export interface VerifiedPayment { eventId:string; reference:string; status:PaymentStatus; amount:number; raw:unknown }
