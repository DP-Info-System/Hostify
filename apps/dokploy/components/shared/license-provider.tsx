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
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export const LicenseProvider = ({ children }: { children: React.ReactNode }) => {
	const [licenseData, setLicenseData] = useState<LicenseData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const { data: userMember } = api.user.get.useQuery();
	const email = userMember?.user?.email;

	const checkLicense = useCallback(async () => {
		if (!email) return;

		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;
		if (!externalApiUrl) {
			// If no external API is configured, assume active or handle accordingly
			setIsLoading(false);
			return;
		}

		try {
			const res = await fetch(`${externalApiUrl}/api/subscription/user-status/${email}`);
			if (!res.ok) {
				setLicenseData({ status: "inactive" });
				return;
			}
			const data = await res.json();
			setLicenseData(data);
		} catch (error) {
			console.error("Failed to check license status", error);
		} finally {
			setIsLoading(false);
		}
	}, [email]);

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
		<LicenseContext.Provider value={{ isLicenseActive, licenseData, isLoading, email, checkLicense }}>
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
