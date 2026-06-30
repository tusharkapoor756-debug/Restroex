import { MenuMappingItem } from '../../ai/types/parser.types';

export class MenuHandler {

    public handle(
        menuItems: MenuMappingItem[],
    ): string {

        if (menuItems.length === 0) {
            return 'Menu abhi setup nahi hua hai. Restaurant staff se contact karein.';
        }

        const formattedItems = menuItems.map(item => {
            const emoji = this.getFoodEmoji(item.name);
            const hasVariants = item.variants && item.variants.length > 0;

            if (!hasVariants) {
                // If item has NO variants: Paneer Tikka — ₹240
                const price = item.basePrice !== null ? item.basePrice : 0;
                return `${emoji} ${item.name} — ₹${price}`;
            } else {
                // If item HAS variants: Margherita Pizza \n • Small — ₹199 \n • Medium — ₹299
                const variantLines = item.variants.map(v => `• ${v.variantName} — ₹${v.price}`);
                return [
                    `${emoji} ${item.name}`,
                    ...variantLines
                ].join('\n');
            }
        });

        const menuText = formattedItems.join('\n\n');

        return [
            '📋 *Our Menu*',
            '',
            menuText,
            '',
            '━━━━━━━━━━━━━━━━━━',
            '',
            'Reply with the item name to place your order.',
        ].join('\n');
    }

    private getFoodEmoji(name: string): string {
        const lower = name.toLowerCase();
        if (lower.includes('pizza')) return '🍕';
        if (lower.includes('burger')) return '🍔';
        if (lower.includes('roll') || lower.includes('kathi')) return '🌯';
        if (lower.includes('chaap') || lower.includes('kabab') || lower.includes('kebab')) return '🍢';
        if (lower.includes('tikka') || lower.includes('paneer') || lower.includes('curry') || lower.includes('masala')) return '🥘';
        if (lower.includes('coke') || lower.includes('drink') || lower.includes('soda') || lower.includes('pepsi') || lower.includes('water')) return '🥤';
        if (lower.includes('roti') || lower.includes('naan') || lower.includes('bread') || lower.includes('parantha')) return '🫓';
        if (lower.includes('momos') || lower.includes('dimsum')) return '🥟';
        if (lower.includes('biryani') || lower.includes('rice') || lower.includes('pulao')) return '🍛';
        if (lower.includes('chowmein') || lower.includes('noodle') || lower.includes('pasta')) return '🍝';
        if (lower.includes('sweet') || lower.includes('ice cream') || lower.includes('dessert') || lower.includes('cake')) return '🍰';
        return '🍽️';
    }

}