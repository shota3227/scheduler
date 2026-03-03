const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const notifs = await prisma.notification.findMany({
        where: { type: 'URL_SENT' },
        orderBy: { sentAt: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(notifs, null, 2));
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
