import { describe, it, expect } from 'vitest';
import {
  classifyLegacyRecetteRows,
  resolveRecipeLines,
  buildSoldProductProposal,
  computeMediumLowPercentage,
} from '../legacy-recipe-migration.js';

const menuById = new Map([
  ['menu-1', { id: 'menu-1', name: 'Smashed Avocado', category: 'Small Bites' }],
  ['menu-2', { id: 'menu-2', name: 'Classic Bun', category: 'Small Bites' }],
]);

function row(overrides) {
  return { id: 'row-x', plat: '', nomPlat: '', quantite: null, unite: null, menuIds: [], ingredientIds: [], ...overrides };
}

describe('classifyLegacyRecetteRows', () => {
  it('classifies a fully blank row as junk', () => {
    const { junkRows } = classifyLegacyRecetteRows([row({ id: 'blank-1' })], menuById);
    expect(junkRows).toHaveLength(1);
  });

  it('groups real rows by their Menu_lie relation, not by name', () => {
    const rows = [
      row({ id: 'r1', plat: 'Smashed Avocado — Citron', menuIds: ['menu-1'], ingredientIds: ['ing-1'], quantite: 10, unite: 'ml' }),
      row({ id: 'r2', plat: 'Smashed Avocado — Feta', menuIds: ['menu-1'], ingredientIds: ['ing-2'], quantite: 20, unite: 'g' }),
      row({ id: 'r3', plat: 'Classic Bun — Buns', menuIds: ['menu-2'], ingredientIds: ['ing-3'], quantite: 1, unite: 'pièce' }),
    ];
    const { dishGroups, junkRows, unlinkedRows } = classifyLegacyRecetteRows(rows, menuById);
    expect(junkRows).toHaveLength(0);
    expect(unlinkedRows).toHaveLength(0);
    expect(dishGroups.get('menu-1')).toHaveLength(2);
    expect(dishGroups.get('menu-2')).toHaveLength(1);
  });

  it('reports a row with no resolvable Menu_lie as unlinked (manual review), not junk, not silently dropped', () => {
    const rows = [row({ id: 'r4', plat: 'Mystery Dish — X', menuIds: ['menu-does-not-exist'], ingredientIds: ['ing-1'], quantite: 5, unite: 'g' })];
    const { dishGroups, unlinkedRows, junkRows } = classifyLegacyRecetteRows(rows, menuById);
    expect(unlinkedRows).toHaveLength(1);
    expect(dishGroups.size).toBe(0);
    expect(junkRows).toHaveLength(0);
  });
});

describe('resolveRecipeLines — unresolved ingredient handling', () => {
  const ingredientById = new Map([['ing-1', { id: 'ing-1', name: 'Feta', archived: false }]]);

  it('flags a line whose ingredient id does not resolve, rather than guessing', () => {
    const [result] = resolveRecipeLines([row({ ingredientIds: ['ing-unknown'], quantite: 5, unite: 'g' })], ingredientById);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('INGREDIENT_NOT_FOUND_IN_MASTER');
  });

  it('flags a line with no ingredient relation at all', () => {
    const [result] = resolveRecipeLines([row({ ingredientIds: [], quantite: 5, unite: 'g' })], ingredientById);
    expect(result.errors).toContain('INGREDIENT_NOT_FOUND_IN_MASTER');
  });

  it('flags an archived ingredient', () => {
    const archivedMap = new Map([['ing-1', { id: 'ing-1', name: 'Feta', archived: true }]]);
    const [result] = resolveRecipeLines([row({ ingredientIds: ['ing-1'], quantite: 5, unite: 'g' })], archivedMap);
    expect(result.errors).toContain('INGREDIENT_ARCHIVED');
  });

  it('flags zero/negative/missing quantity', () => {
    expect(resolveRecipeLines([row({ ingredientIds: ['ing-1'], quantite: 0, unite: 'g' })], ingredientById)[0].errors).toContain('INVALID_QUANTITY');
    expect(resolveRecipeLines([row({ ingredientIds: ['ing-1'], quantite: -1, unite: 'g' })], ingredientById)[0].errors).toContain('INVALID_QUANTITY');
    expect(resolveRecipeLines([row({ ingredientIds: ['ing-1'], quantite: null, unite: 'g' })], ingredientById)[0].errors).toContain('INVALID_QUANTITY');
  });

  it('flags an unknown/missing unit', () => {
    expect(resolveRecipeLines([row({ ingredientIds: ['ing-1'], quantite: 5, unite: 'cuillère' })], ingredientById)[0].errors).toContain('UNKNOWN_OR_MISSING_UNIT');
    expect(resolveRecipeLines([row({ ingredientIds: ['ing-1'], quantite: 5, unite: null })], ingredientById)[0].errors).toContain('UNKNOWN_OR_MISSING_UNIT');
  });

  it('accepts a fully valid line', () => {
    const [result] = resolveRecipeLines([row({ ingredientIds: ['ing-1'], quantite: 5, unite: 'g' })], ingredientById);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('buildSoldProductProposal', () => {
  const ingredientById = new Map([
    ['ing-1', { id: 'ing-1', name: 'Citron vert / lime', archived: false }],
    ['ing-2', { id: 'ing-2', name: 'Feta', archived: false }],
  ]);

  it('the sold-product mapping confidence is always exact (direct relation), never a name heuristic', () => {
    const lines = [row({ id: 'r1', nomPlat: 'Smashed Avocado', ingredientIds: ['ing-2'], quantite: 20, unite: 'g' })];
    const proposal = buildSoldProductProposal(menuById.get('menu-1'), lines, ingredientById, []);
    expect(proposal.confidence).toBe('exact');
    expect(proposal.confidenceReason).toContain('DIRECT_NOTION_RELATION');
  });

  it('classifies the optional Website Product cross-reference independently, by name', () => {
    const lines = [row({ id: 'r1', nomPlat: 'Smashed Avocado', ingredientIds: ['ing-2'], quantite: 20, unite: 'g' })];
    const proposal = buildSoldProductProposal(menuById.get('menu-1'), lines, ingredientById, [{ id: 'web-1', name: 'SMASHED AVOCADO' }]);
    expect(proposal.websiteProductMatch.confidence).toBe('exact');
    expect(proposal.websiteProductMatch.candidate.id).toBe('web-1');
  });

  it('does not invent a Website Product match when none is close', () => {
    const lines = [row({ id: 'r1', nomPlat: 'Smashed Avocado', ingredientIds: ['ing-2'], quantite: 20, unite: 'g' })];
    const proposal = buildSoldProductProposal(menuById.get('menu-1'), lines, ingredientById, [{ id: 'web-1', name: 'Espresso Martini' }]);
    expect(proposal.websiteProductMatch.candidate).toBeNull();
    expect(proposal.websiteProductMatch.confidence).toBe('unmapped');
  });

  it('collects distinct legacy names as aliases, deduplicated against the canonical name', () => {
    const lines = [
      row({ id: 'r1', nomPlat: 'Smashed Avocado', ingredientIds: ['ing-2'], quantite: 20, unite: 'g' }),
      row({ id: 'r2', nomPlat: 'Smashed Avocado', ingredientIds: ['ing-1'], quantite: 10, unite: 'ml' }),
    ];
    const proposal = buildSoldProductProposal(menuById.get('menu-1'), lines, ingredientById, []);
    expect(proposal.aliases).toEqual([]); // identical to canonical name -> not a real alias
  });

  it('counts valid vs. excluded lines correctly', () => {
    const lines = [
      row({ id: 'r1', nomPlat: 'Smashed Avocado', ingredientIds: ['ing-2'], quantite: 20, unite: 'g' }), // valid
      row({ id: 'r2', nomPlat: 'Smashed Avocado', ingredientIds: ['ing-unknown'], quantite: 5, unite: 'g' }), // unresolved ingredient
    ];
    const proposal = buildSoldProductProposal(menuById.get('menu-1'), lines, ingredientById, []);
    expect(proposal.validLineCount).toBe(1);
    expect(proposal.invalidLineCount).toBe(1);
  });

  it('deterministic product_key generation from the canonical menu name', () => {
    const lines = [row({ id: 'r1', ingredientIds: ['ing-2'], quantite: 20, unite: 'g' })];
    const proposal = buildSoldProductProposal(menuById.get('menu-1'), lines, ingredientById, []);
    expect(proposal.productKey).toBe('smashed-avocado');
  });
});

describe('computeMediumLowPercentage', () => {
  it('is 0% when every proposal is exact/high', () => {
    expect(computeMediumLowPercentage([{ confidence: 'exact' }, { confidence: 'high' }])).toBe(0);
  });

  it('computes the correct percentage of medium/low/unmapped proposals', () => {
    expect(computeMediumLowPercentage([{ confidence: 'exact' }, { confidence: 'medium' }])).toBe(50);
  });

  it('is 0% for an empty proposal list (nothing to flag)', () => {
    expect(computeMediumLowPercentage([])).toBe(0);
  });
});
