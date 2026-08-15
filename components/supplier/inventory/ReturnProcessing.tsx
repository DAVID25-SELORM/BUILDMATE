"use client";
import {useActionState} from "react";
import {processReturn,type InventoryActionState} from "@/app/supplier/inventory/actions";
type Item={order_item_id:string;order_number:string;order_status:string;customer:string|null;product:string;ordered_quantity:number;unit_price:number;return_reason:string|null;dispute_status:string|null;evidence_paths:string[];already_processed:number};
const initial:InventoryActionState={};
function ReturnForm({item}:{item:Item}){
 const[state,action,pending]=useActionState(processReturn,initial);const remaining=Number(item.ordered_quantity)-Number(item.already_processed);
 if(remaining<=0)return <p className="text-sm font-semibold text-emerald-700">Fully processed</p>;
 return <form action={action} onSubmit={event=>{const input=event.currentTarget.elements.namedItem("requestKey") as HTMLInputElement;if(!input.value)input.value=crypto.randomUUID()}} className="mt-3 grid gap-3 md:grid-cols-3">
  <input type="hidden" name="orderItemId" value={item.order_item_id}/><input type="hidden" name="requestKey" defaultValue=""/>
  <label><span className="label">Return quantity</span><input className="input" name="quantity" type="number" min="0.01" max={remaining} step="0.01" defaultValue={remaining} required/></label>
  <label><span className="label">Disposition</span><select className="input" name="disposition"><option value="returned_to_stock">Return to stock</option><option value="damaged">Damaged</option><option value="quarantine">Quarantine</option><option value="supplier_return">Return to upstream supplier</option><option value="disposal">Dispose</option></select></label>
  <label><span className="label">Decision reason</span><input className="input" name="reason" minLength={5} defaultValue={item.return_reason??""} required/></label>
  <label className="md:col-span-3"><span className="label">Notes</span><input className="input" name="notes"/></label>
  <div className="md:col-span-3"><button className="btn-primary" disabled={pending}>{pending?"Recording…":"Record disposition"}</button>{state.error&&<p className="mt-2 text-sm font-semibold text-red-700">{state.error}</p>}{state.message&&<p className="mt-2 text-sm font-semibold text-emerald-700">{state.message}</p>}</div>
 </form>;
}
export function ReturnProcessing({items}:{items:Item[]}){return <section className="card mt-6 p-5"><h2 className="text-xl font-bold">Return processing</h2><p className="mt-1 text-sm text-slate-600">Only “Return to stock” restores sellable inventory. Every decision is audited.</p><div className="mt-4 space-y-3">{items.map(item=><details className="rounded-xl border p-4" key={item.order_item_id}><summary className="cursor-pointer font-bold">{item.order_number} · {item.product} · {Number(item.ordered_quantity)-Number(item.already_processed)} remaining</summary><div className="mt-3 grid gap-2 text-sm md:grid-cols-3"><p><b>Customer:</b> {item.customer??"Customer"}</p><p><b>Original sale:</b> GHS {Number(item.unit_price).toFixed(2)} each</p><p><b>Status:</b> {item.dispute_status??item.order_status}</p><p className="md:col-span-2"><b>Return reason:</b> {item.return_reason??"No dispute reason supplied"}</p><p><b>Evidence:</b> {item.evidence_paths?.length??0} file(s)</p></div><ReturnForm item={item}/></details>)}{!items.length&&<p className="text-sm text-slate-500">No eligible returns.</p>}</div></section>}
