import "server-only";
import type { Product } from "@/components/commerce/ProductCard";
import { createClient } from "@/lib/supabase/server";

type FeaturedListing = { product_id:string;price:number|string|null;products:{name:string;base_unit:string;images:string[];categories:{name:string}|null};organisations:{name:string} };

export async function getFeaturedProducts(limit=4):Promise<Product[]> {
  const supabase=await createClient();
  const {data}=await supabase.from("supplier_listings").select("product_id,price,products!inner(name,base_unit,images,is_active,categories(name)),organisations!inner(name,verification_status)").eq("listing_status","published").eq("is_active",true).eq("products.is_active",true).eq("organisations.verification_status","approved").neq("stock_status","out_of_stock").order("price").limit(100);
  const grouped=new Map<string,{product:FeaturedListing;count:number}>();
  for(const listing of (data??[]) as unknown as FeaturedListing[]){if(listing.price==null)continue;const existing=grouped.get(listing.product_id);if(existing){existing.count+=1;if(Number(listing.price)<Number(existing.product.price))existing.product=listing}else grouped.set(listing.product_id,{product:listing,count:1})}
  return [...grouped.values()].sort((a,b)=>b.count-a.count||Number(a.product.price)-Number(b.product.price)).slice(0,limit).map(({product,count})=>({productId:product.product_id,name:product.products.name,category:product.products.categories?.name??"Materials",price:Number(product.price),unit:product.products.base_unit,supplier:`${count} verified supplier${count===1?"":"s"}`,supplierCount:count,imageUrl:product.products.images?.[0]}));
}
