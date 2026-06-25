import { MenuRepository } from '../../menu/repositories/menu.repository';
import { RestaurantRepository } from '../../restaurants/repositories/restaurant.repository';
import { RestaurantSettingsRepository } from '../../restaurants/repositories/restaurant-settings.repository';

export interface RestaurantKnowledge {
    restaurant: any;
    settings: any;
    menu: any[];
}

export class KnowledgeService {
    private readonly menuRepository = new MenuRepository();
    private readonly restaurantRepository = new RestaurantRepository();
    private readonly restaurantSettingsRepository =
        new RestaurantSettingsRepository();

    public async buildKnowledge(
        restaurantId: string,
    ): Promise<RestaurantKnowledge> {

        const restaurant =
            await this.restaurantRepository.findById(
                restaurantId,
            );

        const settings =
            await this.restaurantSettingsRepository.findByRestaurantId(
                restaurantId,
            );

        const menuItems =
            await this.menuRepository.listByRestaurant(
                restaurantId,
            );

        const menu = menuItems
            .filter(item => item.isAvailable)
            .map(item => ({
                id: item.id,
                name: item.name,
                aliases: item.aliases,
                basePrice: item.basePrice,
            }));

        return {
            restaurant,
            settings,
            menu,
        };
    }
}