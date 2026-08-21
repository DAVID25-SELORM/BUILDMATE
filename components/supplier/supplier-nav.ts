import {
  BarChart3,
  Boxes,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";

export const supplierNav = [
  { label: "Overview", href: "/supplier", icon: LayoutDashboard },
  { label: "Orders", href: "/supplier/orders", icon: ShoppingBag },
  { label: "Quotation requests", href: "/supplier/quotations", icon: FileText },
  { label: "Products", href: "/supplier/products", icon: Package },
  { label: "Inventory", href: "/supplier/inventory", icon: Boxes },
  { label: "Inventory reports", href: "/supplier/inventory/reports", icon: BarChart3 },
  { label: "Settlements", href: "/supplier/settlements", icon: Wallet },
  { label: "Staff", href: "/supplier/staff", icon: Users },
  { label: "Organisation settings", href: "/supplier/settings", icon: Settings },
] as const;
