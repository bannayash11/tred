import { User } from '../models/User.js';

const DEFAULT_ADMIN = {
  name: 'Terminal Admin',
  email: 'yashvardhan0488@gmail.com',
  password: 'Admin@123',
  role: 'admin',
  subscription: {
    status: 'active',
    plan: 'Lifetime Enterprise Admin',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  }
};

const DEFAULT_SUBADMIN = {
  name: 'Security Sub-Admin',
  email: 'subadmin@orderblock.local',
  password: 'subadmin123',
  role: 'subadmin',
  subscription: {
    status: 'active',
    plan: 'Sub-Admin Operator Pass',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  }
};

/**
 * Ensures the default admin email exists in MongoDB.
 * Creates it only if missing — does not overwrite an existing account.
 */
export async function seedDefaultAdmin() {
  const existing = await User.findOne({ email: DEFAULT_ADMIN.email });

  if (!existing) {
    await User.create(DEFAULT_ADMIN);
    console.log(
      `[Seed] Default admin created → ${DEFAULT_ADMIN.email} / ${DEFAULT_ADMIN.password}`
    );
  } else if (existing.role !== 'admin') {
    existing.role = 'admin';
    existing.subscription = DEFAULT_ADMIN.subscription;
    await existing.save();
    console.log(`[Seed] Existing user promoted to admin → ${DEFAULT_ADMIN.email}`);
  } else {
    console.log(`[Seed] Admin already exists → ${DEFAULT_ADMIN.email}`);
  }

  const existingSub = await User.findOne({ email: DEFAULT_SUBADMIN.email });
  if (!existingSub) {
    await User.create(DEFAULT_SUBADMIN);
    console.log(
      `[Seed] Default sub-admin created → ${DEFAULT_SUBADMIN.email} / ${DEFAULT_SUBADMIN.password}`
    );
  }
}
