import { Request, Response } from 'express';
import { OrderRepository } from '../repositories/order.repository';
import { OrderService } from '../services/order.service';
import { OrderStatus } from '../types/order.types';
import { BadRequestError, NotFoundError } from '../../../shared/errors/app-error';

const WORKFLOW_STATUSES: OrderStatus[] = ['accepted', 'preparing', 'ready', 'completed', 'cancelled'];

export class OrderOperationsController {
  private readonly orders: OrderRepository;
  private readonly orderService: OrderService;

  constructor() {
    this.orders = new OrderRepository();
    this.orderService = new OrderService();
  }

  public getActiveOrders = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const orders = await this.orders.findActiveOrders(restaurantId);
    res.status(200).json({
      success: true,
      data: orders,
    });
  };

  public transitionOrder = async (req: Request, res: Response): Promise<void> => {
    const orderId = String(req.params.orderId || '');
    const restaurantId = this.getRestaurantId(req);
    const targetStatus = req.body?.status as OrderStatus | undefined;

    if (!targetStatus || !WORKFLOW_STATUSES.includes(targetStatus)) {
      throw new BadRequestError('Unsupported order status transition');
    }

    const existingOrder = await this.orders.findById(orderId);
    if (!existingOrder) throw new NotFoundError('Order not found');
    if (existingOrder.restaurantId !== restaurantId) throw new NotFoundError('Order not found');

    const updatedOrder = await this.orderService.transitionOrder(orderId, targetStatus);
    res.status(200).json({
      success: true,
      data: updatedOrder,
    });
  };

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
