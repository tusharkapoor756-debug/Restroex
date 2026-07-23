import { SessionRepository } from '../../../conversations/repositories/session.repository';

export class InteractiveNavigationHandler {
  private repository = new SessionRepository();

  /**
   * Pushes a screen payload (serialized JSON) onto the customer's navigation stack.
   */
  public async pushScreen(
    restaurantId: string,
    customerPhone: string,
    screenId: string
  ): Promise<void> {
    const session = await this.repository.findSession(restaurantId, customerPhone);
    if (!session) return;

    const stack: string[] = session.context.navigationStack || [];
    // Prevent duplicate consecutive pushes
    if (stack[stack.length - 1] !== screenId) {
      stack.push(screenId);
    }
    // Limit stack depth
    if (stack.length > 10) stack.shift();

    await this.repository.patchContext(restaurantId, customerPhone, {
      navigationStack: stack,
    });
  }

  /**
   * Pops the last screen from the navigation stack and returns the one before it.
   */
  public async popScreen(
    restaurantId: string,
    customerPhone: string
  ): Promise<string | null> {
    const session = await this.repository.findSession(restaurantId, customerPhone);
    if (!session) return null;

    const stack: string[] = session.context.navigationStack || [];
    stack.pop(); // Remove current screen
    const previous = stack[stack.length - 1] || null;

    await this.repository.patchContext(restaurantId, customerPhone, {
      navigationStack: stack,
    });

    return previous;
  }

  /**
   * Clears the navigation stack entirely.
   */
  public async clearStack(restaurantId: string, customerPhone: string): Promise<void> {
    await this.repository.patchContext(restaurantId, customerPhone, {
      navigationStack: [],
    });
  }
}
