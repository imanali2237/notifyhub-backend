import { assertValidTemplate, renderTemplates } from './template-renderer.js';

describe('renderTemplates', () => {
  const fields = { subject: 'plain', html: 'html' } as const;

  it('fills placeholders, including nested ones', () => {
    const out = renderTemplates(
      { subject: 'Order {{orderId}}', html: '<p>Hi {{subscriber.name}}</p>' },
      fields,
      { orderId: 'A42', subscriber: { name: 'Sara' } },
    );
    expect(out).toEqual({ subject: 'Order A42', html: '<p>Hi Sara</p>' });
  });

  it('escapes values in html fields but not in plain fields', () => {
    const out = renderTemplates(
      { subject: 'From {{name}}', html: '<p>{{name}}</p>' },
      fields,
      { name: '<b>Tom & Jerry</b>' },
    );
    expect(out.subject).toBe('From <b>Tom & Jerry</b>');
    expect(out.html).toBe('<p>&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;</p>');
  });

  it('renders missing values as empty and skips absent fields', () => {
    expect(renderTemplates({ subject: 'Hi {{nope}}!' }, fields, {})).toEqual({
      subject: 'Hi !',
    });
  });
});

describe('assertValidTemplate', () => {
  it('throws on syntax errors only', () => {
    expect(() => assertValidTemplate('Hi {{name')).toThrow();
    expect(() => assertValidTemplate('Hi {{name}}')).not.toThrow();
  });
});
