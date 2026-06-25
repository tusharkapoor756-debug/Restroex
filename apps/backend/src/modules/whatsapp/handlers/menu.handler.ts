export class MenuHandler {

    public handle(
        menuItems: Array<{
            name: string;
            basePrice: number;
        }>,
    ): string {

        if (menuItems.length === 0) {
            return 'Menu abhi setup nahi hua hai. Restaurant staff se contact karein.';
        }

        const menu = menuItems
            .slice(0, 12)
            .map(
                (item, index) =>
                    `${index + 1}. ${item.name} - ₹${Number(item.basePrice).toFixed(2)}`
            )
            .join('\n');

        return [
            '📋 *Our Menu*',
            '',
            menu,
            '',
            '🛒 Reply with item name to place your order.',
        ].join('\n');

    }

}