const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.update({
    where: { email: 's.okamatsu@luvir.jp' },
    data: { role: 'ADMIN' }
}).then((user) => console.log('Successfully updated to ADMIN:', user.email))
    .catch(console.error)
    .finally(() => prisma.$disconnect());
