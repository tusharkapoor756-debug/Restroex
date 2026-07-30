export class GreetingHandler {

    public handle(
        restaurantName: string,
        restaurantSlug?: string,
        customerPhone?: string,
    ): string {
        const dashboardBase = process.env.DASHBOARD_URL || 'http://localhost:3000';
        // Embed customer's WhatsApp number in the URL so the ordering page
        // pre-fills their phone and the bot knows where to send order updates.
        const phoneParam = customerPhone ? `?phone=${encodeURIComponent(customerPhone)}` : '';
        const orderingUrl = `${dashboardBase}/order/${restaurantSlug || 'demo'}${phoneParam}`;

        return [
            `🍽️ *Welcome to ${restaurantName}!*`,
            '',
            'Aapka order ek click mein ready! 🚀',
            '',
            `👇 *Yahan click karein aur apna order place karein:*`,
            `${orderingUrl}`,
            '',
            '━━━━━━━━━━━━━━━━━━',
            '✨ Powered by Restroex',
        ].join('\n');

    }

}