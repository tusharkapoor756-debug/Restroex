import { db } from '../../../infrastructure/database/database.client';
import { ImportSessionPayload, ParsedCategoryGroup, StagedMenuItem, DryRunSummary } from '../types/menu-import.types';
import { MenuRepository } from './menu.repository';
import { CategoryRepository } from './category.repository';

export class MenuImportRepository {
  private get client() {
    return db.getClient();
  }

  // ─── Session Management ───────────────────────────────────────────────────

  public async createSession(
    restaurantId: string,
    originalFilename: string,
    fileUrl: string,
    importMode: 'append' | 'replace_category' | 'full_sync' = 'append'
  ): Promise<string> {
    const { data, error } = await this.client
      .from('menu_import_sessions')
      .insert({
        restaurant_id: restaurantId,
        status: 'queued',
        import_mode: importMode,
        original_filename: originalFilename,
        file_url: fileUrl
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create menu import session: ${error.message}`);
    return data.id;
  }

  public async updateSessionStatus(
    sessionId: string,
    status: 'queued' | 'processing' | 'draft' | 'committed' | 'failed' | 'cancelled',
    errorMessage?: string,
    dryRunSummary?: DryRunSummary
  ): Promise<void> {
    const updatePayload: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (errorMessage) updatePayload.error_message = errorMessage;
    if (dryRunSummary) updatePayload.dry_run_summary = dryRunSummary;

    const { error } = await this.client
      .from('menu_import_sessions')
      .update(updatePayload)
      .eq('id', sessionId);

    if (error) throw new Error(`Failed to update session status: ${error.message}`);
  }

  public async saveStagedItems(sessionId: string, categories: ParsedCategoryGroup[]): Promise<void> {
    const rowsToInsert: any[] = [];

    for (const cat of categories) {
      for (const item of cat.items) {
        rowsToInsert.push({
          session_id: sessionId,
          category_name: cat.name,
          subcategory_name: item.subcategoryName || null,
          item_name: item.itemName,
          description: item.description || null,
          base_price: item.basePrice,
          veg_type: item.vegType,
          is_bestseller: item.isBestseller,
          variants: JSON.stringify(item.variants),
          customizations: JSON.stringify(item.customizations),
          bounding_box: item.boundingBox ? JSON.stringify(item.boundingBox) : null,
          confidence_score: item.confidenceScore,
          needs_review: item.needsReview,
          matched_menu_item_id: item.matchedMenuItemId || null,
          sync_action: item.syncAction
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error } = await this.client.from('menu_import_items').insert(rowsToInsert);
      if (error) throw new Error(`Failed to save staged import items: ${error.message}`);
    }
  }

  public async getSessionPayload(sessionId: string): Promise<ImportSessionPayload | null> {
    const { data: session, error: sessionErr } = await this.client
      .from('menu_import_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) return null;

    const { data: itemsData, error: itemsErr } = await this.client
      .from('menu_import_items')
      .select('*')
      .eq('session_id', sessionId);

    if (itemsErr) throw new Error(`Failed to fetch staged items: ${itemsErr.message}`);

    // Group items back into categories
    const categoriesMap = new Map<string, ParsedCategoryGroup>();

    for (const row of itemsData || []) {
      const catName = row.category_name || 'General';
      if (!categoriesMap.has(catName)) {
        categoriesMap.set(catName, {
          id: `cat_${categoriesMap.size + 1}`,
          name: catName,
          confidence: 0.95,
          items: []
        });
      }

      categoriesMap.get(catName)!.items.push({
        id: row.id,
        categoryName: row.category_name,
        subcategoryName: row.subcategory_name,
        itemName: row.item_name,
        description: row.description,
        basePrice: row.base_price !== null ? Number(row.base_price) : null,
        vegType: row.veg_type,
        isBestseller: row.is_bestseller,
        variants: typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants || [],
        customizations: typeof row.customizations === 'string' ? JSON.parse(row.customizations) : row.customizations || [],
        boundingBox: typeof row.bounding_box === 'string' ? JSON.parse(row.bounding_box) : row.bounding_box || null,
        confidenceScore: Number(row.confidence_score),
        needsReview: row.needs_review,
        matchedMenuItemId: row.matched_menu_item_id,
        syncAction: row.sync_action
      });
    }

    return {
      sessionId: session.id,
      restaurantId: session.restaurant_id,
      status: session.status,
      importMode: session.import_mode,
      originalFilename: session.original_filename,
      fileUrl: session.file_url,
      qualityReport: session.quality_report,
      dryRunSummary: session.dry_run_summary,
      categories: Array.from(categoriesMap.values()),
      errorMessage: session.error_message,
      createdAt: session.created_at,
      updatedAt: session.updated_at
    };
  }

  // ─── Versioning Snapshot & Rollback ───────────────────────────────────────

  public async createMenuSnapshot(restaurantId: string, source: string, sessionId?: string, createdBy?: string): Promise<number> {
    // Get latest version number
    const { data: latest } = await this.client
      .from('menu_versions')
      .select('version_number')
      .eq('restaurant_id', restaurantId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version_number || 0) + 1;

    // Fetch full active menu snapshot
    const { data: items } = await this.client
      .from('menu_items')
      .select('*, menu_item_variants(*), menu_item_customizations(*)')
      .eq('restaurant_id', restaurantId);

    const { error } = await this.client.from('menu_versions').insert({
      restaurant_id: restaurantId,
      version_number: nextVersion,
      source,
      import_session_id: sessionId || null,
      snapshot_data: JSON.stringify(items || []),
      created_by: createdBy || null
    });

    if (error) throw new Error(`Failed to create menu snapshot: ${error.message}`);
    return nextVersion;
  }

  // ─── Write Staged Items → Live Menu (the actual commit) ────────────────────

  /**
   * Reads all staged items from menu_import_items for the session,
   * creates real categories (or reuses existing by name match),
   * inserts real menu_items + menu_item_variants for each staged item.
   *
   * Returns a full evidence report of every DB write.
   */
  public async writeToLiveMenu(
    restaurantId: string,
    sessionId: string
  ): Promise<{
    categoriesCreated: string[];
    categoriesReused: string[];
    itemsInserted: { name: string; categoryName: string; basePrice: number | null; variantCount: number }[];
    itemsSkipped: { name: string; reason: string }[];
  }> {
    const menuRepo = new MenuRepository();
    const categoryRepo = new CategoryRepository();

    const evidence = {
      categoriesCreated: [] as string[],
      categoriesReused: [] as string[],
      itemsInserted: [] as { name: string; categoryName: string; basePrice: number | null; variantCount: number }[],
      itemsSkipped: [] as { name: string; reason: string }[],
    };

    // 1. Fetch all staged items for this session
    const { data: stagedRows, error: fetchErr } = await this.client
      .from('menu_import_items')
      .select('*')
      .eq('session_id', sessionId);

    if (fetchErr) throw new Error(`Failed to fetch staged items: ${fetchErr.message}`);
    if (!stagedRows || stagedRows.length === 0) return evidence;

    // 2. Load existing categories for this restaurant (to avoid duplicates by name)
    const existingCategories = await categoryRepo.listByRestaurant(restaurantId);
    const categoryNameToId = new Map<string, string>();
    for (const cat of existingCategories) {
      categoryNameToId.set(cat.name.toLowerCase().trim(), cat.id);
    }

    // 3. Group staged items by category name
    const byCategory = new Map<string, typeof stagedRows>();
    for (const row of stagedRows) {
      const catName = (row.category_name || 'General').trim();
      if (!byCategory.has(catName)) byCategory.set(catName, []);
      byCategory.get(catName)!.push(row);
    }

    // 4. For each category group: find/create the real category, then create items
    for (const [catName, rows] of byCategory) {
      let categoryId: string;

      const existingId = categoryNameToId.get(catName.toLowerCase());
      if (existingId) {
        categoryId = existingId;
        evidence.categoriesReused.push(catName);
      } else {
        // Create new real category
        const newCat = await categoryRepo.create(restaurantId, {
          name: catName,
          displayOrder: existingCategories.length + evidence.categoriesCreated.length + 1,
          isVisible: true,
        });
        categoryId = newCat.id;
        categoryNameToId.set(catName.toLowerCase(), categoryId);
        evidence.categoriesCreated.push(catName);
      }

      // 5. Insert each item in this category
      for (const row of rows) {
        const itemName = (row.item_name || '').trim();
        if (!itemName) {
          evidence.itemsSkipped.push({ name: '(blank)', reason: 'Empty item name' });
          continue;
        }

        const variants: { variantName: string; price: number; displayOrder?: number }[] = [];
        let rawVariants = row.variants;
        if (typeof rawVariants === 'string') {
          try { rawVariants = JSON.parse(rawVariants); } catch (_) { rawVariants = []; }
        }
        if (Array.isArray(rawVariants)) {
          for (let i = 0; i < rawVariants.length; i++) {
            const v = rawVariants[i];
            const vName = v?.variantName || v?.variant_name || v?.name;
            const rawP = v?.price ?? v?.priceAdjustment;
            const vPrice = typeof rawP === 'number' ? rawP : parseFloat(rawP);
            if (v && vName && !isNaN(vPrice) && vPrice >= 0) {
              variants.push({ variantName: String(vName).trim(), price: vPrice, displayOrder: i });
            }
          }
        }

        const hasVariants = variants.length > 0;
        const rawBasePrice = row.base_price;
        const basePrice = (rawBasePrice !== null && rawBasePrice !== undefined) ? Number(rawBasePrice) : null;

        // Validation: item must have either at least one variant or a non-null valid base price
        if (!hasVariants && (basePrice === null || isNaN(basePrice) || basePrice < 0)) {
          evidence.itemsSkipped.push({ name: itemName, reason: 'No valid price or variants' });
          continue;
        }

        try {
          // If item has variants, pass basePrice as 0 (or null if repo accepts) so menuRepo.createWithVariants passes validation
          const itemBasePrice = hasVariants ? 0 : basePrice;

          await menuRepo.createWithVariants(restaurantId, {
            name: itemName,
            aliases: [],
            basePrice: itemBasePrice,
            categoryId,
            vegType: row.veg_type === 'non-veg' ? 'non-veg' : 'veg',
            isPopular: row.is_bestseller ?? false,
            allowInstructions: true,
            variants,
          });

          evidence.itemsInserted.push({
            name: itemName,
            categoryName: catName,
            basePrice: itemBasePrice,
            variantCount: variants.length,
          });
        } catch (insertErr: any) {
          evidence.itemsSkipped.push({ name: itemName, reason: insertErr.message });
        }
      }
    }

    return evidence;
  }
}
