import { Request, Response } from 'express';
import { OrderRepository } from '../repositories/order.repository';
import { ReceiptRenderService } from '../services/receipt-render.service';
import { NotFoundError } from '../../../shared/errors/app-error';
import { logger } from '../../../infrastructure/logger/logger';

export class ReceiptController {
  private readonly orders: OrderRepository;
  private readonly receipts: ReceiptRenderService;

  constructor() {
    this.orders = new OrderRepository();
    this.receipts = new ReceiptRenderService();
  }

  public getCustomerReceipt = async (req: Request, res: Response): Promise<void> => {
    const orderId = this.readSingle(req.params.orderId);
    const token = this.readSingle(req.query.token);

    this.receipts.assertValidToken(orderId, token, 'customer_receipt');

    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    const { SettingsRepository } = require('../../restaurants/repositories/settings.repository');
    const settingsRepo = new SettingsRepository();

    let restaurantProfile;
    try {
      const fullSettings = await settingsRepo.getSettings(order.restaurantId);
      restaurantProfile = {
        name: fullSettings.profile.name,
        address: fullSettings.profile.address,
        city: fullSettings.profile.city,
        state: fullSettings.profile.state,
        pincode: fullSettings.profile.pincode,
        phoneNumber: fullSettings.profile.phoneNumber,
        email: fullSettings.profile.email,
        gstNumber: fullSettings.settings.gstEnabled ? fullSettings.settings.gstNumber : undefined,
        fssaiNumber: fullSettings.settings.fssaiNumber,
        logoUrl: fullSettings.profile.logoUrl,
      };
    } catch (profileErr) {
      // Fall back gracefully if profile fails
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(this.receipts.renderMobileReceipt(order, restaurantProfile));
  };

  public getCustomerPdf = async (req: Request, res: Response): Promise<void> => {
    const orderId = this.readSingle(req.params.orderId);
    const token = this.readSingle(req.query.token);

    this.receipts.assertValidToken(orderId, token, 'customer_receipt');

    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    const { pdfGeneratorService } = require('../services/pdf-generator.service');
    const { invoiceService } = require('../services/invoice.service');
    const { SettingsRepository } = require('../../restaurants/repositories/settings.repository');
    const settingsRepo = new SettingsRepository();

    let restaurantProfile;
    try {
      const fullSettings = await settingsRepo.getSettings(order.restaurantId);
      restaurantProfile = {
        name: fullSettings.profile.name,
        address: fullSettings.profile.address,
        city: fullSettings.profile.city,
        state: fullSettings.profile.state,
        pincode: fullSettings.profile.pincode,
        phoneNumber: fullSettings.profile.phoneNumber,
        email: fullSettings.profile.email,
        gstNumber: fullSettings.settings.gstEnabled ? fullSettings.settings.gstNumber : undefined,
        fssaiNumber: fullSettings.settings.fssaiNumber,
        logoUrl: fullSettings.profile.logoUrl,
      };
    } catch (profileErr) {
      // Fall back safely if profile load fails without blocking invoice rendering
    }

    const invoiceNumber = await invoiceService.generateInvoiceNumber(order.restaurantId, order.id);
    const htmlContent = this.receipts.renderMobileReceipt(order, restaurantProfile);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await pdfGeneratorService.generatePdfFromHtml(htmlContent, '80mm');
    } catch (renderErr: any) {
      logger.error(
        { orderId: order.id, error: renderErr?.message, stack: renderErr?.stack },
        '⚠️ [PDF CONTROLLER CATCH] Puppeteer HTML PDF generation failed, executing generatePdfBuffer fallback!'
      );
      pdfBuffer = pdfGeneratorService.generatePdfBuffer(order, invoiceNumber, restaurantProfile, { paperSize: '80mm' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Tax_Invoice_${invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(pdfBuffer);
  };

  public getSignedReceiptLinks = async (req: Request, res: Response): Promise<void> => {
    const orderId = this.readSingle(req.params.orderId);
    const restaurantId = this.readRestaurantId(req);
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.restaurantId !== restaurantId) throw new NotFoundError('Order not found');

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        humanReadableId: order.humanReadableId,
        expiresInSeconds: 7 * 24 * 60 * 60,
        customerReceiptUrl: this.receipts.generateSignedReceiptUrl(order.id, baseUrl, 'customer_receipt'),
      },
    });
  };

  public getSignedThermalPrintLink = async (req: Request, res: Response): Promise<void> => {
    const orderId = this.readSingle(req.params.orderId);
    const restaurantId = this.readRestaurantId(req);
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.restaurantId !== restaurantId) throw new NotFoundError('Order not found');

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        humanReadableId: order.humanReadableId,
        expiresInSeconds: 10 * 60,
        thermalReceiptUrl: this.receipts.generateSignedReceiptUrl(
          order.id,
          baseUrl,
          'thermal_receipt',
          10 * 60 * 1000
        ),
      },
    });
  };

  public getThermalReceipt = async (req: Request, res: Response): Promise<void> => {
    const orderId = this.readSingle(req.params.orderId);
    const restaurantId = this.readRestaurantId(req);
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.restaurantId !== restaurantId) throw new NotFoundError('Order not found');

    const autoPrint = req.query.autoPrint !== 'false';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(this.receipts.renderThermalReceipt(order, { autoPrint }));
  };

  public getSignedThermalReceipt = async (req: Request, res: Response): Promise<void> => {
    const orderId = this.readSingle(req.params.orderId);
    const token = this.readSingle(req.query.token);

    this.receipts.assertValidToken(orderId, token, 'thermal_receipt');

    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    const autoPrint = req.query.autoPrint !== 'false';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(this.receipts.renderThermalReceipt(order, { autoPrint }));
  };

  private readSingle(value: unknown): string {
    if (Array.isArray(value)) return String(value[0] || '');
    return String(value || '');
  }

  private readRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
