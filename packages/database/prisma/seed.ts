// /packages/database/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = 'apkrunner_salt_2025';
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  const adminEmail = 'admin@apkrunner.local';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'System Administrator',
        role: 'admin',
        passwordHash: hashPassword('AdminPassword123!'),
      },
    });
    console.log(`✅ Admin user seeded: ${admin.email}`);

    // Seed initial demo app
    const demoApp = await prisma.app.create({
      data: {
        name: 'OpenCalc Android',
        packageName: 'com.android.calculator2',
        iconUrl: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=128&auto=format&fit=crop&q=80',
        ownerId: admin.id,
        builds: {
          create: [
            {
              version: '1.4.2',
              fileUrl: 's3://apkrunner-apks/com.android.calculator2/build-1.4.2.apk',
              fileSize: 4520192,
            },
            {
              version: '1.5.0-rc1',
              fileUrl: 's3://apkrunner-apks/com.android.calculator2/build-1.5.0.apk',
              fileSize: 4892400,
            },
          ],
        },
      },
    });
    console.log(`✅ Demo app seeded: ${demoApp.name} (${demoApp.packageName})`);
  } else {
    console.log(`ℹ️ Admin user already exists: ${existingAdmin.email}`);
  }

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e: unknown) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
