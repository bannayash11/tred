import { User } from '../models/User.js';

/**
 * Seeds admin accounts only when explicit env credentials are provided.
 * Never hardcodes passwords or prints secrets to logs.
 *
 * Required for admin seed:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 * Optional for sub-admin:
 *   SEED_SUBADMIN_EMAIL, SEED_SUBADMIN_PASSWORD
 */
export async function seedDefaultAdmin() {
  const adminEmail = String(process.env.SEED_ADMIN_EMAIL || '')
    .toLowerCase()
    .trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log(
      '[Seed] Skipping admin seed — set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first admin.'
    );
  } else if (String(adminPassword).length < 10) {
    console.warn('[Seed] SEED_ADMIN_PASSWORD too short (min 10). Admin seed skipped.');
  } else {
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      await User.create({
        name: process.env.SEED_ADMIN_NAME || 'Terminal Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        subscription: {
          status: 'active',
          plan: 'Lifetime Enterprise Admin',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });
      console.log(`[Seed] Default admin created → ${adminEmail}`);
    } else if (existing.role !== 'admin') {
      existing.role = 'admin';
      existing.subscription = {
        status: 'active',
        plan: 'Lifetime Enterprise Admin',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };
      await existing.save();
      console.log(`[Seed] Existing user promoted to admin → ${adminEmail}`);
    } else {
      console.log(`[Seed] Admin already exists → ${adminEmail}`);
    }
  }

  const subEmail = String(process.env.SEED_SUBADMIN_EMAIL || '')
    .toLowerCase()
    .trim();
  const subPassword = process.env.SEED_SUBADMIN_PASSWORD;

  if (!subEmail || !subPassword) return;
  if (String(subPassword).length < 10) {
    console.warn('[Seed] SEED_SUBADMIN_PASSWORD too short (min 10). Sub-admin seed skipped.');
    return;
  }

  const existingSub = await User.findOne({ email: subEmail });
  if (!existingSub) {
    await User.create({
      name: process.env.SEED_SUBADMIN_NAME || 'Security Sub-Admin',
      email: subEmail,
      password: subPassword,
      role: 'subadmin',
      subscription: {
        status: 'active',
        plan: 'Sub-Admin Operator Pass',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });
    console.log(`[Seed] Default sub-admin created → ${subEmail}`);
  }
}
