const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Map Stripe price IDs to plan names
function planFromPriceId(priceId) {
  const map = {
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID]: 'pro',
    [process.env.STRIPE_PRO_ANNUAL_PRICE_ID]: 'pro',
    [process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID]: 'enterprise',
    [process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID]: 'enterprise',
  };
  return map[priceId] || 'starter';
}

// POST /api/payment/create-checkout-session
exports.createCheckoutSession = async (req, res) => {
  try {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: 'priceId is required' });

    const user = req.user;

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user._id.toString() },
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(user._id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${CLIENT_URL}/dashboard?payment=success`,
      cancel_url: `${CLIENT_URL}/#pricing`,
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId: user._id.toString() },
      },
      metadata: { userId: user._id.toString() },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/payment/create-portal-session
exports.createPortalSession = async (req, res) => {
  try {
    const user = req.user;
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${CLIENT_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal session error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/payment/subscription
exports.getSubscription = async (req, res) => {
  try {
    const user = req.user;
    res.json({
      plan: user.plan || 'starter',
      subscriptionStatus: user.subscriptionStatus || '',
      currentPeriodEnd: user.currentPeriodEnd || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/payment/webhook — called by Stripe (no auth, uses signature)
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (userId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = sub.items.data[0]?.price?.id;
          await User.findByIdAndUpdate(userId, {
            stripeSubscriptionId: sub.id,
            plan: planFromPriceId(priceId),
            subscriptionStatus: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          const priceId = sub.items.data[0]?.price?.id;
          await User.findByIdAndUpdate(userId, {
            plan: planFromPriceId(priceId),
            subscriptionStatus: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await User.findByIdAndUpdate(userId, {
            plan: 'starter',
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: '',
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (user) {
          await User.findByIdAndUpdate(user._id, {
            subscriptionStatus: 'past_due',
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }

  res.json({ received: true });
};
