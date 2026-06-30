import { VariantRepository } from '../../menu/repositories/variant.repository';
import { MenuVariant } from '../../menu/types/menu-item.types';

export class VariantHandler {

    private readonly variantRepository: VariantRepository;

    constructor() {
        this.variantRepository = new VariantRepository();
    }

    /**
     * Returns true if the menu item has at least one available variant.
     */
    public async needsVariant(menuItemId: string): Promise<boolean> {
        const variants = await this.variantRepository.findByMenuItem(menuItemId);
        return variants.length > 0;
    }

    /**
     * Builds a natural-language WhatsApp reply asking the customer to choose a variant.
     */
    public async buildVariantReply(menuItemId: string): Promise<string> {
        const variants = await this.variantRepository.findByMenuItem(menuItemId);

        if (variants.length === 0) {
            return '';
        }

        const lines = variants.map(
            (variant: MenuVariant) =>
                `• ${variant.variantName} — ₹${variant.price}`,
        );

        return [
            '🍽️ Which variant would you like?',
            '',
            ...lines,
            '',
            'Reply with the variant name (e.g. "Full")',
        ].join('\n');
    }

    /**
     * Attempts to find a variant by name for the given menu item.
     * Returns the variant if matched, null otherwise.
     */
    public async resolveVariantByName(
        menuItemId: string,
        variantNameInput: string,
    ): Promise<MenuVariant | null> {
        const variants = await this.variantRepository.findByMenuItem(menuItemId);
        const normalized = variantNameInput.trim().toLowerCase();
        return variants.find(v => v.variantName.trim().toLowerCase() === normalized) ?? null;
    }

    /**
     * Main entry point: returns the variant clarification message,
     * or null if the item has no variants (caller should use base price).
     */
    public async handle(menuItemId: string): Promise<string | null> {
        const hasVariants = await this.needsVariant(menuItemId);

        if (!hasVariants) {
            return null;
        }

        return this.buildVariantReply(menuItemId);
    }

}