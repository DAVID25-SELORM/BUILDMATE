import{requireRole}from"@/lib/auth/session";export default async function DriverLayout({children}:{children:React.ReactNode}){await requireRole(["driver"]);return children}
