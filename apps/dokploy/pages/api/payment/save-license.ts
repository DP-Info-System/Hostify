import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user as userTable } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		// Get user session
		const session = await auth.api.getSession({ headers: req.headers });
		if (!session?.user?.id) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const { license_key, subscription_id } = req.body;

		// Update user with license data
		const updatedUser = await db
			.update(userTable)
			.set({
				licenseKey: license_key,
				isValidEnterpriseLicense: !!license_key,
				updated_at: new Date(),
			})
			.where(eq(userTable.id, session.user.id))
			.returning();

		console.log("[License] Saved license to database for user:", session.user.id);

		return res.status(200).json({
			success: true,
			user: updatedUser[0],
		});
	} catch (error: any) {
		console.error("[License] Error saving license:", error);
		return res.status(500).json({
			error: "Failed to save license",
			details: error.message,
		});
	}
}
