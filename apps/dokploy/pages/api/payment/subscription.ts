import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { email, instance_id } = req.body;

	if (!email) {
		return res.status(400).json({ error: "Email is required" });
	}

	try {
		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;

		if (!externalApiUrl) {
			return res.status(500).json({ error: "External API URL not configured" });
		}

		console.log(
			`[Payment API] Proxying subscription request to ${externalApiUrl}/api/subscription for email: ${email}`,
		);

		// Server-side call to external API (bypasses CORS and browser restrictions)
		const subscriptionResponse = await fetch(
			`${externalApiUrl}/api/subscription`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					email,
					instance_id: instance_id || "unknown-instance",
				}),
			},
		);

		console.log(
			`[Payment API] External API response status: ${subscriptionResponse.status}`,
		);

		if (!subscriptionResponse.ok) {
			const errorText = await subscriptionResponse.text();
			console.error(
				`[Payment API] External API error (${subscriptionResponse.status}):`,
				errorText,
			);
			return res.status(subscriptionResponse.status).json({
				error: `Activation server error (${subscriptionResponse.status})`,
				details: errorText,
			});
		}

		const data = await subscriptionResponse.json();
		console.log("[Payment API] Subscription data received:", {
			has_key: !!data?.key,
			has_subscription_id: !!data?.subscription_id,
		});

		return res.status(200).json(data);
	} catch (error: any) {
		console.error("[Payment API] Error:", error);
		return res.status(500).json({
			error: "Failed to initiate payment",
			details: error.message,
		});
	}
}
