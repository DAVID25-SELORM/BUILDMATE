import {describe,expect,it} from "vitest";
import {getSmtpConfig} from "./smtp-config";

describe("SMTP configuration",()=>{
  it("uses the authenticated mailbox when SMTP_FROM is omitted",()=>expect(getSmtpConfig({SMTP_HOST:"smtp.gmail.com",SMTP_PORT:"587",SMTP_USER:"mail@example.com",SMTP_PASSWORD:"abcd efgh",SMTP_SENDER_NAME:"BuildMate"})).toMatchObject({from:"mail@example.com",port:587,secure:false,auth:{user:"mail@example.com",pass:"abcdefgh"}}));
  it("uses TLS-on-connect for port 465",()=>expect(getSmtpConfig({SMTP_HOST:"smtp.gmail.com",SMTP_PORT:"465",SMTP_USER:"mail@example.com",SMTP_PASSWORD:"secret"}).secure).toBe(true));
  it("rejects incomplete settings",()=>expect(()=>getSmtpConfig({SMTP_HOST:"smtp.gmail.com"})).toThrow("not configured"));
});
