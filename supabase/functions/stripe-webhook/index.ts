// Supabase Edge Function: Stripe webhook.
//
// Stripe calls this after a checkout/subscription event. It verifies the
// signature, then updates the user's profile (status -> active/expired) using
// the service-role key (bypasses RLS). The user is identified by the
// client_reference_id we attach to the Payment Link (their Supabase user id).
//
// Required secrets (set in Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY        (sk_test_… / sk_live_…)
//   STRIPE_WEBHOOK_SECRET    (whsec_… — from the Stripe webhook endpoint)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Deploy with JWT verification OFF (Stripe doesn't send a Supabase JWT).

import Stripe from 'npm:stripe@^16';
import {createClient} from 'jsr:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async req => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret,
    );
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (userId) {
          await supabase
            .from('profiles')
            .update({
              status: 'active',
              stripe_customer_id: session.customer as string,
            })
            .eq('id', userId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from('profiles')
          .update({status: 'expired'})
          .eq('stripe_customer_id', sub.customer as string);
        break;
      }
    }
  } catch (err) {
    console.error('handler error', err);
    return new Response('handler error', {status: 500});
  }

  return new Response(JSON.stringify({received: true}), {
    headers: {'Content-Type': 'application/json'},
  });
});
