import { notFound } from "next/navigation";
import { PortalPreviewShell } from "@/components/admin/PortalPreviewShell";
import { requirePortalPreview } from "@/lib/admin/portal-preview";

type PurchaseRequest = {
  id: string;
  title: string;
  estimated_amount: number | string;
  status: string;
  current_stage: string;
  created_at: string;
  projects: { name: string } | null;
};

export default async function CustomerOrganisationPreview({
  params,
}: {
  params: Promise<{ id: string; section?: string[] }>;
}) {
  const { id, section: segments } = await params;
  const section = segments?.[0] ?? "overview";
  if (!["overview", "projects", "staff", "approvals"].includes(section))
    notFound();
  const { supabase, session } = await requirePortalPreview(
    "customer",
    id,
    `/admin/preview/customer-organisation/${id}/${section}`,
    "organisation",
  );
  const permissionMap = {
    projects: "projects.edit",
    staff: "staff.manage",
    approvals: "purchase_requests.approve",
  } as const;
  const checks = await Promise.all(
    Object.entries(permissionMap).map(
      async ([key, permission]) =>
        [
          key,
          (
            await supabase.rpc("preview_role_has_permission", {
              target_session: session.id,
              target_permission: permission,
            })
          ).data === true,
        ] as const,
    ),
  );
  const visible = Object.fromEntries(checks) as Record<string, boolean>;
  if (section !== "overview" && !visible[section]) notFound();
  const [
    { data: organisation },
    { data: projects },
    { count: members },
    { data: requests },
  ] = await Promise.all([
    supabase
      .from("organisations")
      .select("name,organisation_type")
      .eq("id", id)
      .neq("organisation_type", "supplier")
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id,name,status,budget,start_date,target_date")
      .eq("organisation_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("organisation_members")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", id)
      .eq("status", "active"),
    visible.approvals
      ? supabase
          .from("purchase_requests")
          .select(
            "id,title,estimated_amount,status,current_stage,created_at,projects(name)",
          )
          .eq("organisation_id", id)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  if (!organisation) notFound();
  const approvalRows = (requests ?? []) as unknown as PurchaseRequest[];
  const content =
    section === "projects" ? (
      <div className="card p-5">
        <h1 className="text-2xl font-black">Projects</h1>
        {(projects ?? []).map((project) => (
          <div
            className="mt-3 flex justify-between border-t pt-3"
            key={project.id}
          >
            <span>{project.name}</span>
            <span className="capitalize">{project.status}</span>
          </div>
        ))}
      </div>
    ) : section === "staff" ? (
      <div className="card p-6">
        <h1 className="text-2xl font-black">Organisation staff</h1>
        <p className="mt-2">{members ?? 0} active staff memberships</p>
      </div>
    ) : section === "approvals" ? (
      <div>
        <h1 className="text-2xl font-black">Purchase approvals</h1>
        <p className="mt-2 text-slate-600">
          Read-only approval queue for this role and project context.
        </p>
        <div className="mt-6 space-y-4">
          {approvalRows.map((request) => (
            <article className="card p-5" key={request.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-bold">{request.title}</h2>
                  <p className="text-sm text-slate-600">
                    {request.projects?.name ?? "General"} · GHS{" "}
                    {Number(request.estimated_amount).toFixed(2)}
                  </p>
                </div>
                <div className="text-right text-sm capitalize">
                  <p>{request.status.replaceAll("_", " ")}</p>
                  <p className="text-slate-500">
                    {request.current_stage.replaceAll("_", " ")}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-500">
                Approval actions are disabled in Admin Preview Mode.
              </div>
            </article>
          ))}
          {!approvalRows.length && (
            <div className="card p-8 text-center text-slate-500">
              No purchase requests are awaiting review.
            </div>
          )}
        </div>
      </div>
    ) : (
      <div>
        <h1 className="text-3xl font-black">{organisation.name}</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <b>{projects?.length ?? 0}</b>
            <p>Projects</p>
          </div>
          <div className="card p-5">
            <b>{members ?? 0}</b>
            <p>Active staff</p>
          </div>
        </div>
      </div>
    );
  const nav = [
    { label: "Overview" },
    visible.projects && { label: "Projects", section: "projects" },
    visible.staff && { label: "Staff", section: "staff" },
    visible.approvals && { label: "Approvals", section: "approvals" },
  ].filter(Boolean) as { label: string; section?: string }[];
  return (
    <PortalPreviewShell
      portalType="customer"
      targetId={id}
      targetName={organisation.name}
      reason={session.reason}
      referenceNumber={session.reference_number}
      previewRole={session.preview_role_key}
      returnTo="/admin/organisations"
      previewBase={`/admin/preview/customer-organisation/${id}`}
      nav={nav}
    >
      {content}
    </PortalPreviewShell>
  );
}
