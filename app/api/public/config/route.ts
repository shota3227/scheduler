import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SiteConfig } from "@prisma/client";

// 社外ゲスト向けの公開設定（認証不要）
export async function GET() {
    const configs = await prisma.siteConfig.findMany({
        where: {
            key: {
                in: [
                    "wording_guest_heading",
                    "wording_guest_description",
                    "wording_no_slots_message",
                    "wording_conflict_message",
                    "wording_completion_message",
                    "branding_company_name",
                    "branding_logo_url",
                    "branding_logo_data",
                ],
            },
        },
    });

    const find = (key: string): string =>
        configs.find((c: SiteConfig) => c.key === key)?.value ?? "";

    const logoData = find("branding_logo_data");
    const logoUrl = find("branding_logo_url");

    const mapped = {
        heading: find("wording_guest_heading"),
        description: find("wording_guest_description"),
        noSlotsMessage: find("wording_no_slots_message"),
        conflictMessage: find("wording_conflict_message"),
        completionMessage: find("wording_completion_message"),
        companyName: find("branding_company_name"),
        logoUrl: logoData ? "/api/images/branding_logo_data" : logoUrl,
    };

    return NextResponse.json(mapped);
}
