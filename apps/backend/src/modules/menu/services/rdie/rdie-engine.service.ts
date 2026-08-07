import { ImagePreprocessorService } from './modules/image-preprocessor.service';
import { SpatialGridService } from './modules/spatial-grid.service';
import { ColumnDetectorService } from './modules/column-detector.service';
import { SpatialBlockService } from './modules/spatial-block.service';
import { HeadingDetectorService } from './modules/heading-detector.service';
import { PriceVariantService } from './modules/price-variant.service';
import { ItemRelationService } from './modules/item-relation.service';
import { MenuGraphService } from './modules/menu-graph.service';
import { ValidationService } from './modules/validation.service';
import { RDIEOutput } from './types/rdie.types';
import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';

export class RDIEEngineService {
  private preprocessor = new ImagePreprocessorService();
  private spatialGrid = new SpatialGridService();
  private columnDetector = new ColumnDetectorService();
  private spatialBlock = new SpatialBlockService();
  private headingDetector = new HeadingDetectorService();
  private priceVariant = new PriceVariantService();
  private itemRelation = new ItemRelationService();
  private menuGraph = new MenuGraphService();
  private validator = new ValidationService();

  /**
   * Main Execution Pipeline for Restroex Restaurant Document Intelligence Engine (RDIE).
   */
  public async processDocument(inputBuffer: Buffer): Promise<RDIEOutput> {
    // Step 1: Preprocess Image (300 DPI, contrast, grayscale)
    const prepResult = await this.preprocessor.preprocess(inputBuffer);

    // Step 2: Extract hOCR from Tesseract Worker
    const tempPath = path.join(process.cwd(), `tmp_rdie_${Date.now()}.png`);
    fs.writeFileSync(tempPath, prepResult.imageBuffer);

    let hocrHtml = '';
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(tempPath, {}, { hocr: true });
      hocrHtml = data.hocr || '';
    } finally {
      await worker.terminate();
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }

    // Step 3: Parse Spatial Token Grid
    const tokens = this.spatialGrid.parseHOCR(hocrHtml);

    // Step 4: Detect Multi-Column Boundaries dynamically
    const columns = this.columnDetector.detectColumns(tokens, prepResult.metadata.width);

    // Step 5: Build Spatial Lines and Reading Blocks per Column
    const blocks = this.spatialBlock.buildSpatialBlocks(tokens, columns);

    // Step 6: Detect Category Headings & Heal Split Tokens ("BREA DS" -> "BREADS")
    const headings = this.headingDetector.detectHeadings(blocks);

    // Step 7: Extract Prices & Variant Matrix Header Coordinates
    const allLines = blocks.flatMap((b) => b.lines);
    const variantMatrixSpecs = this.priceVariant.detectVariantMatrix(allLines);

    // Step 8: Bind Item Relationships within Column Boundaries
    const rawItems = this.itemRelation.bindItemRelationships(blocks, headings, variantMatrixSpecs, columns);

    // Step 9: Construct Menu Hierarchy DAG Graph
    const rawGraph = this.menuGraph.buildMenuGraph(headings, rawItems, tokens.length, columns.length);

    // Step 10: Validate, Deduplicate & Clean Graph Output
    const finalGraph = this.validator.validateAndCleanGraph(rawGraph);

    return finalGraph;
  }
}
