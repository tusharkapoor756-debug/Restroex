import { Request, Response } from 'express';
import { OrderRepository } from '../repositories/order.repository';
import { ReceiptRenderService } from '../services/receipt-render.service';
import { NotFoundError } from '../../../shared/errors/app-error';

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

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(this.receipts.renderMobileReceipt(order));
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
