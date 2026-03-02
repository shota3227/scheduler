import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const notifs = await prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { schedule: { select: { title: true } } }
    });
    console.log(JSON.stringify(notifs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
