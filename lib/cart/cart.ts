export const CART_STORAGE_KEY="buildmate-cart";
export const CART_UPDATED_EVENT="buildmate:cart-updated";
export type CartItem={listingId:string;productId?:string;variant?:string|null;supplierId?:string;branchId?:string|null;name:string;supplier:string;unit:string;price:number;quantity:number;inventoryMode?:string;maxQuantity?:number;availabilityLabel?:string;deliveryAvailable?:boolean;pickupAvailable?:boolean;location?:string;imageUrl?:string};
export function cartTotal(items:CartItem[]){return items.reduce((sum,i)=>sum+i.price*i.quantity,0)}
export function cartQuantity(items:CartItem[]){return items.reduce((sum,i)=>sum+i.quantity,0)}
export function normalizeQuantity(value:number){return Number.isFinite(value)?Math.max(1,Math.min(999,Math.floor(value))):1}
export function capQuantity(value:number,maximum?:number){return Math.min(normalizeQuantity(value),maximum??999)}
export function readCart():CartItem[]{if(typeof window==="undefined")return[];try{const value=JSON.parse(localStorage.getItem(CART_STORAGE_KEY)??"[]");return Array.isArray(value)?value:[]}catch{return[]}}
export function writeCart(items:CartItem[]){localStorage.setItem(CART_STORAGE_KEY,JSON.stringify(items));window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT,{detail:items}))}
