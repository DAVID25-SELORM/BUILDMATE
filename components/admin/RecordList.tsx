function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(display).join(", ");
  if (typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k.replaceAll("_", " ")}: ${display(v)}`)
      .join(" · ");
  return String(value);
}
export function RecordList({
  records,
}: {
  records: Record<string, unknown>[];
}) {
  if (!records.length)
    return <p className="mt-3 text-sm text-slate-500">No records.</p>;
  const keys = [...new Set(records.flatMap(Object.keys))]
    .filter(
      (k) =>
        !["id", "raw_response", "payload", "metadata", "otp_hash"].includes(k),
    )
    .slice(0, 8);
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b">
            {keys.map((k) => (
              <th className="px-2 py-3 capitalize" key={k}>
                {k.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr
              className="border-b last:border-0"
              key={String(record.id ?? index)}
            >
              {keys.map((k) => (
                <td className="max-w-64 px-2 py-3" key={k}>
                  {display(record[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
