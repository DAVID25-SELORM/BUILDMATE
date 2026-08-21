type SupplierPageHeaderProps = { title: string; description?: string; actions?: React.ReactNode };
export function SupplierPageHeader({ title, description, actions }: SupplierPageHeaderProps) {
  return <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">{title}</h1>{description && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>;
}
