import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ProductForm } from "@/components/admin/catalogue/ProductForm";
import { createClient } from "@/lib/supabase/server";
import { setProductActive } from "./actions";
import { ADMIN_NAV } from "@/lib/admin/navigation";

export default async function AdminCataloguePage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: brands }, { data: products }] =
    await Promise.all([
      supabase.from("categories").select("id,name").order("sort_order"),
      supabase.from("brands").select("id,name").order("name"),
      supabase
        .from("products")
        .select(
          "id,name,slug,base_unit,is_active,categories(name),brands(name)",
        )
        .order("created_at", { ascending: false }),
    ]);
  return (
    <DashboardShell
      title="Platform administration"
      nav={[...ADMIN_NAV]}
    >
      <h1 className="text-3xl font-black">Product catalogue</h1>
      <p className="mt-2 text-slate-600">
        Maintain the master products suppliers can list.
      </p>
      <div className="mt-6">
        <ProductForm categories={categories ?? []} brands={brands ?? []} />
      </div>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Product</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Unit</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((product) => (
              <tr className="border-b last:border-0" key={product.id}>
                <td className="p-4 font-semibold">{product.name}</td>
                <td>
                  {(product.categories as unknown as { name: string } | null)
                    ?.name ?? "—"}
                </td>
                <td>
                  {(product.brands as unknown as { name: string } | null)
                    ?.name ?? "—"}
                </td>
                <td>{product.base_unit}</td>
                <td>{product.is_active ? "Active" : "Inactive"}</td>
                <td className="p-4 text-right">
                  <form
                    action={setProductActive.bind(
                      null,
                      product.id,
                      !product.is_active,
                    )}
                  >
                    <button className="font-semibold text-brand-700">
                      {product.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(products ?? []).length === 0 && (
              <tr>
                <td className="p-6 text-center text-slate-500" colSpan={6}>
                  No catalogue products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
