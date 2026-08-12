export type SmtpEnvironment = Record<string,string|undefined>;

export function getSmtpConfig(env:SmtpEnvironment=process.env) {
  const host=env.SMTP_HOST?.trim();
  const user=env.SMTP_USER?.trim();
  const pass=env.SMTP_PASSWORD?.replace(/\s+/g,"");
  const port=Number(env.SMTP_PORT??587);
  if(!host||!user||!pass||!Number.isInteger(port)||port<1||port>65535)throw new Error("Transactional SMTP is not configured");
  return {host,port,secure:port===465,auth:{user,pass},from:env.SMTP_FROM?.trim()||user,senderName:env.SMTP_SENDER_NAME?.trim()||"BuildMate Ghana"};
}
