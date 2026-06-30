/**
 * Stripe billing config.
 *
 * The hosted Payment Link (test mode). The Subscribe button opens this with the
 * signed-in user's id appended as client_reference_id, so the Stripe webhook can
 * tell which account paid and flip them to "active".
 */
export const STRIPE_PAYMENT_LINK =
  'https://buy.stripe.com/test_dRm8wPaMefUP9mPbnx4Ja00';

export const PRICE_LABEL = '$19.99 / month CAD';
