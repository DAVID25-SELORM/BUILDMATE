import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql=readFileSync(join(process.cwd(),"supabase","migrations","202608220069_unified_support_centre.sql"),"utf8").toLowerCase();
const centre=readFileSync(join(process.cwd(),"components","support","SupportCentre.tsx"),"utf8");
describe("unified support centre",()=>{
 it("persists canonical numbered tickets and conversation messages",()=>{expect(sql).toContain("create table public.support_tickets");expect(sql).toContain("create table public.support_messages");expect(sql).toContain("'sup-'||to_char(now(),'yyyymmdd')");});
 it("keeps requester tickets isolated and internal notes private",()=>{expect(sql).toContain("created_by=auth.uid() or has_permission('support.view')");expect(sql).toContain("t.created_by=auth.uid() and not internal_note");expect(sql).toContain("internal notes are restricted to support staff");});
 it("implements scoped support permissions and audited lifecycle actions",()=>{for(const permission of["support.view","support.reply","support.assign","support.resolve","support.manage"])expect(sql).toContain(permission);expect(sql).toContain("support_ticket_updated");});
 it("uses existing notifications for tickets, replies and status",()=>{for(const template of["support_ticket_created","support_reply_received","support_requester_replied","support_status_changed"])expect(sql).toContain(template);});
 it("removes normal admin floating support but preserves read-only previews",()=>{expect(centre).toContain("normalAdmin");expect(centre).toContain("Preview only — no support request will be submitted");expect(centre).toContain("createSupportTicket");});
 it("preserves cash-on-delivery fraud guidance",()=>expect(centre).toContain("Do not make advance payment outside the approved BuildMate order process"));
});
