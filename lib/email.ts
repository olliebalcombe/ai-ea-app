import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendEmail(to: string, subject: string, text: string, fromName: string) {
  return resend.emails.send({
    from: `${fromName} <hello@yourdomain.com>`, // swap in a verified sending domain once you have one
    to,
    subject,
    text,
  });
}
