import { BadRequestError, NotFoundError } from '../../../shared/errors/app-error';
import { Restaurant, RestaurantRepository, RestaurantSetupUpdate } from '../repositories/restaurant.repository';

export interface RestaurantSetupResponse {
  restaurant: Restaurant;
  currentStep: 1 | 2 | 3;
  isComplete: boolean;
}

export class RestaurantService {
  private readonly restaurants: RestaurantRepository;

  constructor() {
    this.restaurants = new RestaurantRepository();
  }

  public async getSetup(restaurantId: string): Promise<RestaurantSetupResponse> {
    const restaurant = await this.loadRestaurant(restaurantId);
    return this.toSetupResponse(restaurant);
  }

  public async updateSetup(restaurantId: string, dto: any): Promise<RestaurantSetupResponse> {
    const update = this.normalizePartialSetup(dto);
    if (Object.keys(update).length === 0) {
      throw new BadRequestError('At least one setup field is required');
    }

    const restaurant = await this.restaurants.updateSetup(restaurantId, update);
    return this.toSetupResponse(restaurant);
  }

  public async completeSetup(restaurantId: string, dto: any): Promise<RestaurantSetupResponse> {
    const update = this.normalizePartialSetup(dto);
    const restaurant = Object.keys(update).length > 0
      ? await this.restaurants.updateSetup(restaurantId, update)
      : await this.loadRestaurant(restaurantId);

    const missing = this.getMissingRequiredFields(restaurant);
    if (missing.length > 0) {
      throw new BadRequestError(`Restaurant setup is incomplete: ${missing.join(', ')}`);
    }

    return this.toSetupResponse(restaurant);
  }

  private async loadRestaurant(restaurantId: string): Promise<Restaurant> {
    const restaurant = await this.restaurants.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundError('Restaurant not found');
    }

    return restaurant;
  }

  private normalizePartialSetup(dto: any): RestaurantSetupUpdate {
    const update: RestaurantSetupUpdate = {};

    if ('name' in dto) update.name = this.requiredString(dto.name, 'Restaurant name', 2, 120);
    if ('phoneNumber' in dto || 'phone' in dto) update.phoneNumber = this.normalizePhone(dto.phoneNumber || dto.phone);
    if ('email' in dto) update.email = this.normalizeEmail(dto.email);
    if ('address' in dto) update.address = this.requiredString(dto.address, 'Address', 5, 300);
    if ('city' in dto) update.city = this.requiredString(dto.city, 'City', 2, 80);
    if ('state' in dto) update.state = this.requiredString(dto.state, 'State', 2, 80);
    if ('pincode' in dto) update.pincode = this.normalizePincode(dto.pincode);

    return update;
  }

  private toSetupResponse(restaurant: Restaurant): RestaurantSetupResponse {
    return {
      restaurant,
      currentStep: this.getCurrentStep(restaurant),
      isComplete: this.getMissingRequiredFields(restaurant).length === 0,
    };
  }

  private getCurrentStep(restaurant: Restaurant): 1 | 2 | 3 {
    if (!restaurant.name || !restaurant.phoneNumber || !restaurant.email) return 1;
    if (!restaurant.address || !restaurant.city || !restaurant.state || !restaurant.pincode) return 2;
    return 3;
  }

  private getMissingRequiredFields(restaurant: Restaurant): string[] {
    const required: Array<[keyof Restaurant, string]> = [
      ['name', 'restaurant name'],
      ['phoneNumber', 'phone'],
      ['email', 'email'],
      ['address', 'address'],
      ['city', 'city'],
      ['state', 'state'],
      ['pincode', 'pincode'],
    ];

    return required
      .filter(([key]) => !String(restaurant[key] || '').trim())
      .map(([, label]) => label);
  }

  private requiredString(value: unknown, label: string, min: number, max: number): string {
    const text = String(value || '').trim();
    if (text.length < min) {
      throw new BadRequestError(`${label} must be at least ${min} characters`);
    }

    if (text.length > max) {
      throw new BadRequestError(`${label} must be ${max} characters or less`);
    }

    return text;
  }

  private normalizePhone(value: unknown): string {
    const phone = String(value || '').replace(/[^\d+]/g, '').trim();
    const digitCount = phone.replace(/[^\d]/g, '').length;
    if (digitCount < 8 || digitCount > 15) {
      throw new BadRequestError('Phone must contain 8 to 15 digits');
    }

    return phone;
  }

  private normalizeEmail(value: unknown): string {
    const email = String(value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestError('Valid email is required');
    }

    return email;
  }

  private normalizePincode(value: unknown): string {
    const pincode = String(value || '').replace(/[^\d]/g, '').trim();
    if (pincode.length < 4 || pincode.length > 10) {
      throw new BadRequestError('Pincode must contain 4 to 10 digits');
    }

    return pincode;
  }
}
