import { describe, it, expect } from 'vitest';
import { buildSupplierProperties, mapPage, createSupplier, updateSupplier, archiveSupplier, listSuppliers } from '../suppliers-service.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const FOURNISSEURS_DB = 'fournisseurs-db';

describe('buildSupplierProperties', () => {
  it('writes Fournisseur title and defaults Actif to true', () => {
    const props = buildSupplierProperties({ nom: 'ACME' });
    expect(props.Fournisseur.title[0].text.content).toBe('ACME');
    expect(props.Actif.checkbox).toBe(true);
  });

  it('only writes Méthode contact when it is one of the two valid values', () => {
    expect(buildSupplierProperties({ nom: 'ACME', methodeContact: 'WhatsApp' })['Méthode contact'].select.name).toBe('WhatsApp');
    expect(buildSupplierProperties({ nom: 'ACME', methodeContact: 'Fax' })['Méthode contact']).toBeUndefined();
  });

  it('writes WhatsApp as phone_number from either telephone or whatsapp input', () => {
    expect(buildSupplierProperties({ nom: 'ACME', telephone: '0690' }).WhatsApp).toEqual({ phone_number: '0690' });
    expect(buildSupplierProperties({ nom: 'ACME', whatsapp: '0691' }).WhatsApp).toEqual({ phone_number: '0691' });
  });
});

describe('createSupplier / updateSupplier / archiveSupplier / listSuppliers', () => {
  it('creates and maps a supplier', async () => {
    const notion = createFakeNotion({});
    const result = await createSupplier({ nom: 'ACME', categorie: 'Fruits & légumes' }, { fournisseursDbId: FOURNISSEURS_DB, notion });
    expect(result.item.nom).toBe('ACME');
    expect(result.item.categorie).toBe('Fruits & légumes');
  });

  it('updates an existing supplier', async () => {
    const notion = createFakeNotion({ 'sup-1': { dbId: FOURNISSEURS_DB, properties: buildSupplierProperties({ nom: 'ACME' }) } });
    await updateSupplier('sup-1', { nom: 'ACME', email: 'a@acme.com' }, { notion });
    const page = await notion.getPage('sup-1');
    expect(mapPage(page).email).toBe('a@acme.com');
  });

  it('archiveSupplier performs a real archive', async () => {
    const notion = createFakeNotion({ 'sup-1': { dbId: FOURNISSEURS_DB, properties: buildSupplierProperties({ nom: 'ACME' }) } });
    await archiveSupplier('sup-1', { notion });
    expect(notion._calls.archivePage).toBe(1);
  });

  it('listSuppliers maps all pages', async () => {
    const notion = createFakeNotion({
      'sup-1': { dbId: FOURNISSEURS_DB, properties: buildSupplierProperties({ nom: 'ACME' }) },
      'sup-2': { dbId: FOURNISSEURS_DB, properties: buildSupplierProperties({ nom: 'Autre' }) },
    });
    const list = await listSuppliers({ fournisseursDbId: FOURNISSEURS_DB, notion });
    expect(list.map((s) => s.nom).sort()).toEqual(['ACME', 'Autre']);
  });
});
