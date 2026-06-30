export class GreetingHandler {

    public handle(
        restaurantName: string,
    ): string {

        return [
            `🍽️ *Welcome to ${restaurantName}!*`,
            '',
            '🙏 Namaste!',
            '',
            'Aapka swagat hai. Hum aapka order lene ke liye ready hain.',
            '',
            'Aap neeche diye gaye options me se kuch bhi kar sakte hain:',
            '',
            '📋 *menu* — Complete menu dekhiye',
            '🛒 Seedha apna order bhejiye',
            '',
            'Example:',
            '• 2 Malai Chaap Full',
            '• 1 Paneer Tikka',
            '• 2 Coke',
            '',
            'Agar kisi dish ke baare me kuch poochna ho, bas message kar dijiye 😊',
            '',
            '━━━━━━━━━━━━━━━━━━',
            '✨ Smart Ordering by Restroex',
        ].join('\n');

    }

}