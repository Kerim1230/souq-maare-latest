import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'bkbd098@gmail.com';
  const newPassword = 'qqppzzmm1230';
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error('User not found'); process.exit(1); }
  
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(newPassword, salt);
  
  await prisma.user.update({ where: { email }, data: { passwordHash: hash } });
  
  const updated = await prisma.user.findUnique({ where: { email } });
  const match = await bcrypt.compare(newPassword, updated!.passwordHash!);
  
  console.log('Password update:', match ? 'SUCCESS ✅' : 'FAILED ❌');
  console.log('User ID:', user.id);
  console.log('Email:', email);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
