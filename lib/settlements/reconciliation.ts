export function reconciliationStatus(expected:number,provider:number){return Math.abs(expected-provider)<0.01?"matched" as const:"variance" as const}
export function settlementBalance(entries:{amount:number;entry_type:string;status:string}[]){return entries.filter(e=>e.status==="available").reduce((sum,e)=>sum+(e.entry_type==="payout"||e.entry_type==="refund"?-e.amount:e.amount),0)}
