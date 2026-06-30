import { db } from '../../../infrastructure/database/database.client';
import { MenuVariant } from '../types/menu-item.types';

export class VariantRepository {

    private get client() {
        return db.getClient();
    }

    public async findByMenuItem(menuItemId: string): Promise<MenuVariant[]> {
        const { data, error } = await this.client
            .from('menu_item_variants')
            .select('*')
            .eq('menu_item_id', menuItemId)
            .eq('is_available', true)
            .order('price');

        if (error) {
            throw new Error(`Failed to fetch menu variants: ${error.message}`);
        }

        return (data ?? []).map((v: any) => this.mapToDomain(v));
    }

    public async findById(variantId: string): Promise<MenuVariant | null> {
        const { data, error } = await this.client
            .from('menu_item_variants')
            .select('*')
            .eq('id', variantId)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to fetch variant: ${error.message}`);
        }

        return data ? this.mapToDomain(data) : null;
    }

    private mapToDomain(row: any): MenuVariant {
        return {
            id: row.id,
            menuItemId: row.menu_item_id,
            variantName: row.variant_name,
            price: Number(row.price),
            isAvailable: row.is_available,
        };
    }
}
