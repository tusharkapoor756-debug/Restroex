/**
 * A reusable helper to consistently format item names across the application.
 * 
 * Priority for resolving the display name:
 * 1. variantName (direct property)
 * 2. variant snapshot (e.g. variantNameSnapshot from OrderItem)
 * 3. menu variant (resolved from variantId against a menu list)
 * 4. base item name (or itemNameSnapshot)
 */

export function getDisplayName(
  item: {
    variantName?: string;
    variantNameSnapshot?: string;
    variantId?: string;
    itemName?: string;
    itemNameSnapshot?: string;
    menuItemId?: string;
  },
  availableMenu?: Array<{
    id: string;
    name: string;
    variants?: Array<{ id: string; variantName: string }>;
  }>
): string {
  // 1. Initial fallback names
  let baseName = item.itemName || item.itemNameSnapshot || 'Unknown Item';
  let resolvedVariantName = item.variantName || item.variantNameSnapshot;

  // 2. ALWAYS prefer canonical names from the menu if we have IDs
  if (item.menuItemId && availableMenu) {
    const menuItem = availableMenu.find(m => m.id === item.menuItemId);
    if (menuItem) {
      baseName = menuItem.name;
      if (item.variantId && menuItem.variants) {
        const variant = menuItem.variants.find(v => v.id === item.variantId);
        if (variant) {
          resolvedVariantName = variant.variantName;
        }
      }
    }
  }

  // Helper for title casing
  const titleCase = (str: string) => 
    str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();

  // 3. Clean and combine without duplication
  let cleanBase = baseName.trim();
  let cleanVariant = resolvedVariantName ? resolvedVariantName.trim() : '';

  if (cleanVariant) {
    const cbLower = cleanBase.toLowerCase();
    const cvLower = cleanVariant.toLowerCase();

    // Remove variant name from baseName if it is duplicated inside baseName
    if (cbLower.endsWith(' ' + cvLower)) {
      cleanBase = cleanBase.slice(0, cleanBase.length - cleanVariant.length).trim();
    } else if (cbLower.startsWith(cvLower + ' ')) {
      cleanBase = cleanBase.slice(cleanVariant.length).trim();
    }

    const cbLowerClean = cleanBase.toLowerCase();
    const cvLowerClean = cleanVariant.toLowerCase();
    if (cbLowerClean.includes(cvLowerClean)) {
      return titleCase(cleanBase);
    }

    // Format as: "Half Paneer Tikka"
    return titleCase(`${cleanVariant} ${cleanBase}`);
  }

  return titleCase(cleanBase);
}
