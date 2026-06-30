import { logger } from '../../../infrastructure/logger/logger';

import {
    MenuMappingItem,
    MenuMatchResult,
    MenuVariantMappingItem,
    ParsedItem,
    ParseResult,
} from '../types/parser.types';

export class DeterministicParserService {

    public parseInput(
        text: string,
        menu: MenuMappingItem[],
    ): ParseResult {

        const normalized =
            this.normalize(text);

        const tokens =
            this.tokenize(normalized);

        const items =
            tokens.map(token => {
                const quantityMatch = token.match(/^(\d+)/);
                const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
                const remaining = token.replace(/^(\d+)/, '').trim();

                let matchedItem: MenuMappingItem | undefined;
                let matchedVariant: MenuVariantMappingItem | undefined;
                let confidence = 0;

                const cleanRemaining = remaining.toLowerCase().trim();

                // 1. Exact Match on name or alias
                const exactItem = menu.find(item => 
                    item.name.toLowerCase() === cleanRemaining || 
                    item.aliases.some(alias => alias.toLowerCase() === cleanRemaining)
                );

                if (exactItem) {
                    matchedItem = exactItem;
                    confidence = 1.0;
                } else {
                    // 2. Prefix/Suffix match using DB variants of all items (100% database-driven)
                    for (const item of menu) {
                        const itemNames = [item.name.toLowerCase(), ...item.aliases.map(a => a.toLowerCase())];
                        
                        for (const name of itemNames) {
                            // Check if remaining starts with name + space (e.g. "malai chaap full" starts with "malai chaap ")
                            if (cleanRemaining.startsWith(name + ' ')) {
                                const leftover = cleanRemaining.substring(name.length).trim();
                                const vMatch = item.variants.find(v => v.variantName.toLowerCase() === leftover);
                                if (vMatch) {
                                    matchedItem = item;
                                    matchedVariant = vMatch;
                                    confidence = 1.0;
                                    break;
                                }
                            }
                            // Check if remaining ends with space + name (e.g. "full malai chaap" ends with " malai chaap")
                            if (cleanRemaining.endsWith(' ' + name)) {
                                const leftover = cleanRemaining.substring(0, cleanRemaining.length - name.length).trim();
                                const vMatch = item.variants.find(v => v.variantName.toLowerCase() === leftover);
                                if (vMatch) {
                                    matchedItem = item;
                                    matchedVariant = vMatch;
                                    confidence = 1.0;
                                    break;
                                }
                            }
                        }
                        if (matchedItem) break;
                    }
                }

                // 3. Partial Match fallback
                if (!matchedItem) {
                    const partialMatches = menu.filter(item => item.name.toLowerCase().includes(cleanRemaining));
                    if (partialMatches.length === 1) {
                        matchedItem = partialMatches[0];
                        confidence = 0.8;
                    }
                }

                const item: ParsedItem = {
                    itemName: matchedItem ? matchedItem.name : remaining,
                    quantity,
                    confidence,
                };

                if (matchedItem) {
                    item.matchedMenuItemId = matchedItem.id;

                    const hasVariants = matchedItem.variants.length > 0;

                    if (hasVariants) {
                        if (matchedVariant) {
                            item.matchedVariantId = matchedVariant.id;
                            item.variantPrice = matchedVariant.price;
                            item.variantName = matchedVariant.variantName;
                            item.needsVariant = false;
                        } else {
                            // Item has variants but none matched (or customer omitted it)
                            item.needsVariant = true;
                        }
                    } else {
                        // No variants — use base price
                        item.needsVariant = false;
                    }
                }

                return item;
            });

        logger.debug(
            {
                raw: text,
                normalized,
                tokens,
                items,
            },
            'Parser V2',
        );

        const matchedItems =
            items.filter(
                item => item.matchedMenuItemId,
            );

        return {
            items: matchedItems,
            intent: matchedItems.length > 0
                ? 'add_to_cart'
                : 'unknown',
            overallConfidence: matchedItems.length > 0
                ? 1
                : 0,
            isFallbackTriggered: matchedItems.length === 0,
            rawInput: text,
        };

    }

    private normalize(
        text: string,
    ): string {

        return text
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

    }

    private tokenize(
        text: string,
    ): string[] {

        return text
            .split(/\s*(?:,|and|or|aur|&|\+|\n)\s*/i)
            .map(part => part.trim())
            .filter(part => part.length > 0);

    }
}