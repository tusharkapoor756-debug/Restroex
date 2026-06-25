import { db } from '../../../infrastructure/database/database.client';

export interface RestaurantSettings {
    restaurantId: string;
    aboutRestaurant?: string;
    openingTime?: string;
    closingTime?: string;
    weeklyHolidays?: string;
    paymentMethods?: string;
    upiId?: string;
    pickupInstructions?: string;
    faq?: any[];
}

export class RestaurantSettingsRepository {
    private get client() {
        return db.getClient();
    }

    public async findByRestaurantId(
        restaurantId: string
    ): Promise<RestaurantSettings | null> {
        const { data, error } = await this.client
            .from('restaurant_settings')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (error) {
            throw new Error(
                `Failed to fetch restaurant settings: ${error.message}`
            );
        }

        if (!data) return null;

        return {
            restaurantId: data.restaurant_id,
            aboutRestaurant: data.about_restaurant,
            openingTime: data.opening_time,
            closingTime: data.closing_time,
            weeklyHolidays: data.weekly_holidays,
            paymentMethods: data.payment_methods,
            upiId: data.upi_id,
            pickupInstructions: data.pickup_instructions,
            faq: data.faq || [],
        };
    }
}