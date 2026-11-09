import Handlebars from 'handlebars';
import type {
  ChannelContent,
  TemplateFieldMode,
} from '../channels/channels.interfaces.js';

/** Isolated Handlebars instance: no global helpers/partials leak in. */
const hbs = Handlebars.create();

/**
 * Throws if a template has a syntax error (e.g. "Hi {{name"). Called at trigger
 * time, so the client gets a 400 right away instead of a failed job later.
 */
export function assertValidTemplate(template: string): void {
  hbs.parse(template);
}

/**
 * Renders every template field of a channel's content. Works for any channel:
 * the channel handler says which fields exist and whether to HTML-escape them.
 * Missing values render as empty strings.
 */
export function renderTemplates(
  content: ChannelContent,
  fields: Record<string, TemplateFieldMode>,
  data: Record<string, unknown>,
): ChannelContent {
  const rendered: ChannelContent = {};
  for (const [field, mode] of Object.entries(fields)) {
    const template = content[field];
    if (template === undefined) continue;
    rendered[field] = hbs.compile(template, { noEscape: mode === 'plain' })(
      data,
    );
  }
  return rendered;
}
