import { Injectable, Logger } from '@nestjs/common';

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendPasswordReset(to: string, resetUrl: string) {
    return this.send({
      to,
      subject: 'Reset your AKEEM password',
      text: `Reset your password: ${resetUrl}`,
      html: `<p>Use the link below to reset your password. It expires in 30 minutes.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>`,
    });
  }

  async sendInvitation(
    to: string,
    invitationUrl: string,
    organization: string,
  ) {
    return this.send({
      to,
      subject: `You were invited to ${organization}`,
      text: `Accept your invitation: ${invitationUrl}`,
      html: `<p>You were invited to <strong>${escapeHtml(organization)}</strong>.</p><p><a href="${escapeHtml(invitationUrl)}">Accept invitation</a></p>`,
    });
  }

  private async send(message: EmailMessage): Promise<boolean> {
    const endpoint = process.env.EMAIL_API_URL;
    const apiKey = process.env.EMAIL_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!endpoint || !apiKey || !from) {
      this.logger.warn('Email delivery is not configured');
      return false;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
      if (!response.ok) {
        this.logger.error(`Email provider returned HTTP ${response.status}`);
        return false;
      }
      return true;
    } catch {
      this.logger.error('Email provider request failed');
      return false;
    }
  }
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
