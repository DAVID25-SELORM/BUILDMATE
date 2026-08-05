import type { CheckoutRequest, CheckoutResult, PaymentStatus, VerifiedPayment } from "./types";

function credentials(){const id=process.env.HUBTEL_CLIENT_ID,secret=process.env.HUBTEL_CLIENT_SECRET,merchant=process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER;if(!id||!secret||!merchant)throw new Error("Hubtel is not configured");return{id,secret,merchant};}
function authHeader(id:string,secret:string){return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;}

export async function createHubtelCheckout(input:CheckoutRequest):Promise<CheckoutResult>{
  const {id,secret,merchant}=credentials(); const endpoint=process.env.HUBTEL_CHECKOUT_URL??"https://payproxyapi.hubtel.com/items/initiate";
  const response=await fetch(endpoint,{method:"POST",headers:{Authorization:authHeader(id,secret),"Content-Type":"application/json","Idempotency-Key":input.paymentId},body:JSON.stringify({totalAmount:input.amount,description:`BuildMate order ${input.orderNumber}`,callbackUrl:input.callbackUrl,returnUrl:input.returnUrl,merchantAccountNumber:merchant,clientReference:input.paymentId,customerEmail:input.customerEmail})});
  const raw=await response.json(); if(!response.ok)throw new Error("Payment provider rejected checkout initiation");
  const data=raw as Record<string,unknown>; const nested=(data.data??data.Data??{}) as Record<string,unknown>;
  const reference=String(nested.checkoutId??nested.CheckoutId??nested.clientReference??input.paymentId); const checkoutUrl=String(nested.checkoutUrl??nested.CheckoutUrl??nested.paylinkUrl??"");
  if(!checkoutUrl)throw new Error("Payment provider did not return a checkout URL"); return{reference,checkoutUrl,raw};
}

export async function verifyHubtelPayment(reference:string):Promise<VerifiedPayment>{
  const{id,secret,merchant}=credentials();const template=process.env.HUBTEL_STATUS_URL??"https://api-txnstatus.hubtel.com/transactions/{merchant}/{reference}/status";const url=template.replace("{merchant}",encodeURIComponent(merchant)).replace("{reference}",encodeURIComponent(reference));
  const response=await fetch(url,{headers:{Authorization:authHeader(id,secret)}});const raw=await response.json();if(!response.ok)throw new Error("Unable to verify provider transaction");const root=raw as Record<string,unknown>;const data=(root.data??root.Data??root) as Record<string,unknown>;const providerStatus=String(data.status??data.Status??"");const status=mapHubtelStatus(providerStatus);return{eventId:String(data.transactionId??data.TransactionId??`${reference}:${providerStatus}`),reference,amount:Number(data.amount??data.Amount??0),status,raw};
}
export function mapHubtelStatus(value:string):PaymentStatus{const status=value.toLowerCase();return status.includes("success")||status==="paid"?"paid":status.includes("cancel")?"cancelled":status.includes("fail")?"failed":"pending";}
