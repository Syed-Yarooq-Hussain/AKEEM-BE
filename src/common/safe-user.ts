import { User } from '../../models';

export function safeUser(user?: User | Record<string, any> | null) {
  if (!user) return null;
  const value =
    typeof (user as any).toJSON === 'function' ? (user as any).toJSON() : user;
  return {
    id: value.id,
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    phone: value.phone || null,
    avatarUrl: value.avatarUrl || null,
    status: value.status,
    lastLoginAt: value.lastLoginAt || null,
    emailVerifiedAt: value.emailVerifiedAt || null,
    preferences: value.preferences || {},
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
