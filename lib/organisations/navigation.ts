import {hasPermission} from "@/lib/auth/permissions";

export async function supplierNavigation(organisationId:string){
 const checks=await Promise.all(["orders.view","quotations.view","products.view","settlements.view","supplier.staff.view"].map(permission=>hasPermission({permission,organisationId})));
 return [{label:"Overview",href:"/supplier"},checks[0]&&{label:"Orders",href:"/supplier/orders"},checks[1]&&{label:"Quotation requests",href:"/supplier/quotes"},checks[2]&&{label:"Products",href:"/supplier/products"},checks[3]&&{label:"Settlements",href:"/supplier/settlements"},checks[4]&&{label:"Staff",href:"/supplier/staff"},{label:"Organisation settings",href:"/supplier/settings"}].filter(Boolean) as {label:string;href:string}[];
}
export async function customerNavigation(organisationId?:string){
 const[organisation,requestCreate,requestApprove]=organisationId?await Promise.all([hasPermission({permission:"organisation.view",organisationId}),hasPermission({permission:"purchase_requests.create",organisationId}),hasPermission({permission:"purchase_requests.approve",organisationId})]):[false,false,false];
 return [{label:"Overview",href:"/dashboard"},{label:"Plan to procurement",href:"/dashboard/plan-to-procurement"},{label:"Orders",href:"/dashboard/orders"},{label:"Quotations",href:"/dashboard/quotes"},(requestCreate||requestApprove)&&{label:requestApprove&&!requestCreate?"Approvals":"Purchase requests",href:"/dashboard/organisation/purchase-requests"},organisation&&{label:"Organisation staff",href:"/dashboard/organisation/staff"},organisation&&{label:"Organisation settings",href:"/dashboard/organisation/settings"}].filter(Boolean) as {label:string;href:string}[];
}
