import { describe, it, expect } from 'vitest';
import { buildStaffProperties, mapPage, createStaff, updateStaff, archiveStaff, listStaff } from '../staff-service.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const STAFF_DB = 'staff-db';

describe('buildStaffProperties — matches the real (rich_text Rôle, phone_number Téléphone) schema', () => {
  it('writes Nom and Prénom from the same input value', () => {
    const props = buildStaffProperties({ nom: 'Alice' });
    expect(props.Nom.title[0].text.content).toBe('Alice');
    expect(props.Prénom.rich_text[0].text.content).toBe('Alice');
  });

  it('writes Rôle as rich_text, not select', () => {
    const props = buildStaffProperties({ nom: 'Alice', role: 'Barista' });
    expect(props.Rôle).toEqual({ rich_text: [{ text: { content: 'Barista' } }] });
  });

  it('defaults Actif to true unless explicitly false', () => {
    expect(buildStaffProperties({ nom: 'Alice' }).Actif.checkbox).toBe(true);
    expect(buildStaffProperties({ nom: 'Alice', actif: false }).Actif.checkbox).toBe(false);
  });

  it('writes Téléphone as phone_number only when provided', () => {
    expect(buildStaffProperties({ nom: 'Alice' })['Téléphone']).toBeUndefined();
    expect(buildStaffProperties({ nom: 'Alice', telephone: '0690' })['Téléphone']).toEqual({ phone_number: '0690' });
  });
});

describe('createStaff / updateStaff / archiveStaff / listStaff', () => {
  it('creates and maps a staff member', async () => {
    const notion = createFakeNotion({});
    const result = await createStaff({ nom: 'Alice', role: 'Barista' }, { staffDbId: STAFF_DB, notion });
    expect(result.item.nom).toBe('Alice');
    expect(result.item.role).toBe('Barista');
    expect(result.item.actif).toBe(true);
  });

  it('updates an existing staff member', async () => {
    const notion = createFakeNotion({ 'staff-1': { dbId: STAFF_DB, properties: buildStaffProperties({ nom: 'Alice' }) } });
    await updateStaff('staff-1', { nom: 'Alice', role: 'Manager' }, { notion });
    const page = await notion.getPage('staff-1');
    expect(mapPage(page).role).toBe('Manager');
  });

  it('archiveStaff performs a real archive (not a soft Actif=false disable)', async () => {
    const notion = createFakeNotion({ 'staff-1': { dbId: STAFF_DB, properties: buildStaffProperties({ nom: 'Alice' }) } });
    await archiveStaff('staff-1', { notion });
    expect(notion._calls.archivePage).toBe(1);
    expect(notion._calls.updatePage).toBe(0);
  });

  it('listStaff maps all pages', async () => {
    const notion = createFakeNotion({
      'staff-1': { dbId: STAFF_DB, properties: buildStaffProperties({ nom: 'Alice' }) },
      'staff-2': { dbId: STAFF_DB, properties: buildStaffProperties({ nom: 'Bob' }) },
    });
    const list = await listStaff({ staffDbId: STAFF_DB, notion });
    expect(list.map((s) => s.nom).sort()).toEqual(['Alice', 'Bob']);
  });
});
