import {
    MenuMappingItem,
    ParsedItem,
} from '../types/parser.types';

export class MenuMatcherService {

    public match(
        items: ParsedItem[],
        menu: MenuMappingItem[],
    ): ParsedItem[] {

        return items.map(item => {

            const normalizedInput =
                item.itemName
                    .toLowerCase()
                    .trim();

            let bestMatch: MenuMappingItem | undefined;

            // Exact Name Match
            bestMatch = menu.find(m =>
                m.name.toLowerCase() === normalizedInput,
            );

            // Alias Match
            if (!bestMatch) {

                bestMatch = menu.find(m =>
                    (m.aliases || []).some(alias =>
                        alias.toLowerCase() === normalizedInput,
                    ),
                );

            }

            // Contains Match
            if (!bestMatch) {

                bestMatch = menu.find(m =>
                    normalizedInput.includes(
                        m.name.toLowerCase(),
                    ),
                );

            }

            if (bestMatch) {

                item.matchedMenuItemId =
                    bestMatch.id;

                item.confidence =
                    1;

            } else {

                item.confidence =
                    0;

            }

            return item;

        });

    }

}