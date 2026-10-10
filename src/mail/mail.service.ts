import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/** SMTP mailer. In development, point it at Mailpit (see docker-compose.yml). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure: config.get<boolean>('SMTP_SECURE', false),
      ...(user && {
        auth: { user, pass: config.get<string>('SMTP_PASSWORD') },
      }),
    });
    this.from = config.getOrThrow<string>('MAIL_FROM');
  }

  async sendVerificationCode(to: string, firstname: string, code: string) {
    const pretty = `${code.slice(0, 3)} ${code.slice(3)}`;
    await this.send(
      to,
      `${pretty} is your coloc confirmation code`,
      `Hi ${firstname},\n\nYour coloc confirmation code is ${pretty}.\nIt expires in 15 minutes.\n\nIf you didn't sign up, ignore this email.`,
      `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;background:#F6F4F2;border-radius:22px">
        <p style="margin:0 0 12px">Hi ${escapeHtml(firstname)},</p>
        <p style="margin:0 0 16px">Your coloc confirmation code is</p>
        <p style="margin:0 0 16px;padding:16px;background:#B5DC8D;border-radius:16px;font-size:32px;font-weight:800;letter-spacing:6px;text-align:center;color:#1F2B19">${pretty}</p>
        <p style="margin:0;color:#55564F;font-size:14px">It expires in 15 minutes. If you didn't sign up, ignore this email.</p>
      </div>`,
    );
  }

  private async send(to: string, subject: string, text: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      this.logger.error(`Could not send "${subject}" to ${to}`, error as Error);
      throw error;
    }
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
