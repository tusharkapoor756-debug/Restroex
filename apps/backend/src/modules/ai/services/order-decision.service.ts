export enum OrderDecisionType {

    ADD_TO_CART = 'ADD_TO_CART',

    ASK_VARIANT = 'ASK_VARIANT',

    ASK_QUANTITY = 'ASK_QUANTITY',

    SUGGEST_ALTERNATIVES = 'SUGGEST_ALTERNATIVES',

    ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',

    REMOVE_ITEM = 'REMOVE_ITEM',

    UPDATE_ITEM = 'UPDATE_ITEM',

    CHECKOUT = 'CHECKOUT',

    CHAT = 'CHAT',

}

export interface OrderDecision {

    type: OrderDecisionType;

    payload?: any;

}

export class OrderDecisionService {

}