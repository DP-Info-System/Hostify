import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/utils/api";
import { toast } from "sonner";

interface LicenseData {
	status: string;
	license_key?: string;
	subscription_id?: string;
	instance_id?: string | null;
	plan?: string;
	expires_at?: string;
	grace_until?: string;
}

interface LicenseContextType {
	isLicenseActive: boolean;
	licenseData: LicenseData | null;
	isLoading: boolean;
	email: string | undefined;
	checkLicense: () => Promise<void>;
	saveLicense: (licenseKey: string, subscriptionId?: string) => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export const LicenseProvider = ({ children }: { children: React.ReactNode }) => {
	const [licenseData, setLicenseData] = useState<LicenseData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const { data: userMember } = api.user.get.useQuery();
	const email = userMember?.user?.email;
	const hasLocalLicense = userMember?.user?.licenseKey;

	const saveLicense = useCallback(async (licenseKey: string, subscriptionId?: string) => {
		try {
			const res = await fetch(`/api/payment/save-license`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ license_key: licenseKey, subscription_id: subscriptionId }),
			});

			if (!res.ok) {
				console.warn("[License] Failed to save license to database");
				return;
			}

			// Mark as active locally
			setLicenseData({ status: "active", license_key: licenseKey });
			console.log("[License] License saved to database");
		} catch (error) {
			console.error("[License] Error saving license", error);
		}
	}, []);

	const checkLicense = useCallback(async () => {
		if (!email) return;

		// Check local database first
		if (hasLocalLicense) {
			console.log("[License] Using local license from database");
			setLicenseData({ status: "active", license_key: hasLocalLicense });
			setIsLoading(false);
			return;
		}

		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;
		if (!externalApiUrl) {
			// If no external API is configured, assume active or handle accordingly
			setIsLoading(false);
			return;
		}

		try {
			console.log("[License] Checking status with external API");
			const res = await fetch(`${externalApiUrl}/api/subscription/user-status/${email}`);
			if (!res.ok) {
				setLicenseData({ status: "inactive" });
				return;
			}
			const data = await res.json();
			setLicenseData(data);
		} catch (error) {
			console.error("Failed to check license status", error);
			setLicenseData({ status: "inactive" });
		} finally {
			setIsLoading(false);
		}
	}, [email, hasLocalLicense]);

	useEffect(() => {
		if (email) {
			checkLicense();

			// Polling every 15 minutes
			const interval = setInterval(checkLicense, 15 * 60 * 1000);
			return () => clearInterval(interval);
		}
	}, [email, checkLicense]);

	const isLicenseActive = licenseData?.status?.toLowerCase() === "active";

	return (
		<LicenseContext.Provider value={{ isLicenseActive, licenseData, isLoading, email, checkLicense, saveLicense }}>
			{children}
		</LicenseContext.Provider>
	);
};

export const useLicense = () => {
	const context = useContext(LicenseContext);
	if (context === undefined) {
		throw new Error("useLicense must be used within a LicenseProvider");
	}
	return context;
};
