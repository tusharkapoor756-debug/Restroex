export class ContextBuilderService {
    public buildContext(params: {
        restaurant: any;
        settings?: any;
        menu: any[];
        cart?: any;
        customerMessage: string;
    }): string {
        const {
            restaurant,
            menu,
            cart,
            customerMessage,
        } = params;

        const menuText = menu.length
            ? menu
                .map(
                    (item) =>
                        `• ${item.name} - ₹${item.basePrice}`
                )
                .join('\n')
            : 'No menu available';

        return `
You are the official WhatsApp assistant for this restaurant.

========================
RESTAURANT DETAILS
========================

Name:
${restaurant?.name || 'Unknown'}

Phone:
${restaurant?.phoneNumber || 'Not available'}

Email:
${restaurant?.email || 'Not available'}

Address:
${restaurant?.address || 'Not available'}

City:
${restaurant?.city || 'Not available'}

State:
${restaurant?.state || 'Not available'}

Country:
${restaurant?.country || 'Not available'}

Pincode:
${restaurant?.pincode || 'Not available'}

========================
AVAILABLE MENU
========================

${menuText}

========================
CURRENT CART
========================

${JSON.stringify(cart ?? {}, null, 2)}

========================
CUSTOMER MESSAGE
========================

${customerMessage}

========================
RULES
========================

1. Answer ONLY using the restaurant information above.
2. Never invent prices.
3. Never invent menu items.
4. Never invent address or phone number.
5. If information is missing, say "I don't have that information."
6. Reply in the customer's language.
7. Keep replies short and natural.
`;
    }
}