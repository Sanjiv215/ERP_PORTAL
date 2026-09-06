import { env } from '../config/env.js';

export async function sendWelcomeEmail({ to, name, businessName }) {
  if (env.NODE_ENV !== 'production') {
    console.log(`Welcome email queued for ${to}: ${name} at ${businessName}`);
    return;
  }

  throw new Error('Production email provider is not configured');
}

export async function sendInviteEmail({ to, name }) {
  if (env.NODE_ENV !== 'production') {
    console.log(`Invite email dispatched to ${to} (${name})`);
    return;
  }

  throw new Error('Production email provider is not configured');
}

export async function sendPasswordResetEmail({ to }) {
  if (env.NODE_ENV !== 'production') {
    console.log(`Password reset email dispatched to ${to}`);
    return;
  }

  throw new Error('Production email provider is not configured');
}
