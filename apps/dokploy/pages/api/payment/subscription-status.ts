import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { email } = req.query;

	if (!email || typeof email !== "string") {
		return res.status(400).json({ error: "Email is required" });
	}

	try {
		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;

		if (!externalApiUrl) {
			return res.status(500).json({ error: "External API URL not configured" });
		}

		console.log(
			`[Payment Status API] Checking subscription status for email: ${email}`,
		);

		// Server-side call to external API (bypasses CORS)
		const statusResponse = await fetch(
			`${externalApiUrl}/api/subscription/user-status/${encodeURIComponent(email)}`,
			{
				method: "GET",
				headers: {
					Accept: "application/json",
				},
			},
		);

		console.log(
			`[Payment Status API] External API response status: ${statusResponse.status}`,
		);

		if (!statusResponse.ok) {
			const errorText = await statusResponse.text();
			console.error(
				`[Payment Status API] External API error (${statusResponse.status}):`,
				errorText,
			);
			return res.status(statusResponse.status).json({
				error: `Check status failed (${statusResponse.status})`,
				details: errorText,
			});
		}

		const data = await statusResponse.json();
		console.log("[Payment Status API] Status received:", data?.status);

		return res.status(200).json(data);
	} catch (error: any) {
		console.error("[Payment Status API] Error:", error);
		return res.status(500).json({
			error: "Failed to check subscription status",
			details: error.message,
		});
	}
}
