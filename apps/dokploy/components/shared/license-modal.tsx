import { useState, useEffect } from "react";
import { useLicense } from "./license-provider";
import { useWhitelabelingPublic } from "@/utils/hooks/use-whitelabeling";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Logo } from "./logo";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/router";

export const LicenseModal = () => {
	const { isLicenseActive, isLoading, email, checkLicense, saveLicense } = useLicense();
	const { config: whitelabeling } = useWhitelabelingPublic();
	const [isVerifying, setIsVerifying] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const router = useRouter();

	const handleLogout = async () => {
		try {
			await authClient.signOut().then(() => {
				router.push("/");
			});
		} catch (error) {
			toast.error("Logout failed. Please try again.");
		}
	};

	useEffect(() => {
		if (!isLoading && !isLicenseActive) {
			setIsOpen(true);
		} else {
			setIsOpen(false);
		}
	}, [isLoading, isLicenseActive]);

	const handlePayment = async () => {
		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;

		if (!email) {
			toast.error("Configuration error. Please reload the page.");
			return;
		}

		try {
			console.log("[License] Starting payment via server proxy");
			setIsVerifying(true);
			
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

			// Call local API endpoint (server-side proxy) instead of external API directly
			const subRes = await fetch(`/api/payment/subscription`, {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Accept": "application/json"
				},
				signal: controller.signal,
				body: JSON.stringify({
					email: email,
					instance_id: whitelabeling?.id || "unknown-instance",
				}),
			});

			clearTimeout(timeoutId);
			console.log("[License] Response status:", subRes.status);

			if (!subRes.ok) {
				const errorText = await subRes.text();
				throw new Error(`Activation server error (${subRes.status}): ${errorText}`);
			}

			const subData = await subRes.json();
			console.log("[License] Subscription data received:", subData);

			if (subData?.subscription_id) {
				const options = {
					key: subData.key,
					subscription_id: subData.subscription_id,
					name: "WebDok Pro",
					prefill: {
						email: email,
						name: "User",
					},
					handler: () => {
						toast.info("Payment initiated, verifying activation...");
					},
				};
				console.log("[License] Opening Razorpay modal...");
				const rzp = new (window as any).Razorpay(options);
				rzp.open();
				
				const interval = setInterval(async () => {
					try {
						const statusRes = await fetch(`/api/payment/subscription-status?email=${encodeURIComponent(email)}`);
						if (statusRes.ok) {
							const statusData = await statusRes.json();
							if (statusData?.status?.toLowerCase() === "active") {
								clearInterval(interval);
								// Save license data to local database
								await saveLicense(subData.license_key || subData.key, subData.subscription_id);
								await checkLicense();
								setIsVerifying(false);
								toast.success("Account activated! Welcome back.");
								setIsOpen(false);
							}
						}
					} catch (e) {
						console.error("[License] Polling failed", e);
					}
				}, 5000);
			} else {
				throw new Error("No subscription ID returned from server.");
			}
		} catch (error: any) {
			console.error("[License] Payment initiation failed:", error);
			const msg = error.name === 'AbortError' ? "Request timed out. Server might be down or blocking the connection." : "Failed to start payment process.";
			toast.error(msg);
			setIsVerifying(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={() => {}}>
			<DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
				<DialogHeader className="flex flex-col items-center justify-center pt-4">
					<Logo className="size-16 mb-2" />
					<DialogTitle className="text-2xl font-bold">License Required</DialogTitle>
					<DialogDescription className="text-center text-muted-foreground pt-2">
						Your subscription is currently inactive. Please complete the payment to unlock the dashboard.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-4">
					{isVerifying ? (
						<div className="flex flex-col items-center gap-4 py-4">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
							<p className="text-sm font-medium animate-pulse">Verifying payment status...</p>
						</div>
					) : (
						<div className="flex flex-col gap-2">
							<Button onClick={handlePayment} className="w-full h-12 text-lg font-semibold" size="lg">
								Pay & Activate Now
							</Button>
							<Button onClick={handleLogout} variant="ghost" className="w-full h-10 text-muted-foreground" size="sm">
								Logout from {email}
							</Button>
						</div>
					)}
					<p className="text-xs text-center text-muted-foreground">
					    After payment, your dashboard will unlock automatically.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
};
