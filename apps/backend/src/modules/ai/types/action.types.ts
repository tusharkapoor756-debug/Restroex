export enum ParsedActionType {

    // ------------------------
    // ORDER
    // ------------------------

    ADD_ITEM = 'ADD_ITEM',

    REMOVE_ITEM = 'REMOVE_ITEM',

    UPDATE_ITEM = 'UPDATE_ITEM',

    REPLACE_ITEM = 'REPLACE_ITEM',

    // ------------------------
    // QUANTITY
    // ------------------------

    SET_QUANTITY = 'SET_QUANTITY',

    INCREASE_QUANTITY = 'INCREASE_QUANTITY',

    DECREASE_QUANTITY = 'DECREASE_QUANTITY',

    // ------------------------
    // VARIANT
    // ------------------------

    SET_VARIANT = 'SET_VARIANT',

    // ------------------------
    // NOTES
    // ------------------------

    ADD_NOTE = 'ADD_NOTE',

    REMOVE_NOTE = 'REMOVE_NOTE',

    // ------------------------
    // MENU
    // ------------------------

    VIEW_MENU = 'VIEW_MENU',

    VIEW_CATEGORY = 'VIEW_CATEGORY',

    SEARCH_ITEM = 'SEARCH_ITEM',

    ASK_PRICE = 'ASK_PRICE',

    ASK_AVAILABILITY = 'ASK_AVAILABILITY',

    // ------------------------
    // CART
    // ------------------------

    VIEW_CART = 'VIEW_CART',

    CLEAR_CART = 'CLEAR_CART',

    // ------------------------
    // CHECKOUT
    // ------------------------

    CHECKOUT = 'CHECKOUT',

    CONFIRM_ORDER = 'CONFIRM_ORDER',

    CANCEL_ORDER = 'CANCEL_ORDER',

    // ------------------------
    // PAYMENT
    // ------------------------

    START_PAYMENT = 'START_PAYMENT',

    PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',

    PAYMENT_FAILED = 'PAYMENT_FAILED',

    // ------------------------
    // ORDER STATUS
    // ------------------------

    TRACK_ORDER = 'TRACK_ORDER',

    // ------------------------
    // CONVERSATION
    // ------------------------

    GREETING = 'GREETING',

    THANK_YOU = 'THANK_YOU',

    YES = 'YES',

    NO = 'NO',

    UNDO = 'UNDO',

    SMALL_TALK = 'SMALL_TALK',

    CALL_HUMAN = 'CALL_HUMAN',

    // ------------------------
    // FALLBACK
    // ------------------------

    UNKNOWN = 'UNKNOWN',
}