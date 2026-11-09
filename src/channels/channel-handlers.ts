import type { Channel } from './channels.constants.js';
import type { ChannelHandler } from './channels.interfaces.js';
import { emailChannel } from './email/email.channel.js';

/**
 * Registry: channel name → handler. `Record<Channel, ...>` makes TypeScript
 * refuse to compile if a channel in CHANNELS has no handler here.
 */
export const CHANNEL_HANDLERS: Record<Channel, ChannelHandler> = {
  email: emailChannel,
};
