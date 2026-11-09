/** Security scheme names, referenced by @ApiBearerAuth / @ApiSecurity on routes. */
export const JWT_SECURITY = 'jwt';
export const API_KEY_SECURITY = 'api-key';

/** Tag names = sections in Swagger UI. */
export const API_TAGS = {
  health: 'Health',
  auth: 'Auth',
  apiKeys: 'API Keys',
  events: 'Events',
  email: 'Email',
  notifications: 'Notifications',
} as const;
