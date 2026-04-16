import { api } from "@/utils/api";
import { ImpersonationBar } from "../dashboard/impersonation/impersonation-bar";
import { HubSpotWidget } from "../shared/HubSpotWidget";
import Page from "./side";
import { LicenseProvider } from "../shared/license-provider";
import { LicenseModal } from "../shared/license-modal";

interface Props {
	children: React.ReactNode;
	metaName?: string;
}

export const DashboardLayout = ({ children }: Props) => {
	const { data: haveRootAccess } = api.user.haveRootAccess.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: currentPlan } = api.stripe.getCurrentPlan.useQuery(undefined, {
		enabled: isCloud === true,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		refetchOnReconnect: false,
	});

	const isChatEnabled = isCloud === true && currentPlan === "startup";

	return (
		<LicenseProvider>
			<Page>{children}</Page>
			<LicenseModal />
			{isChatEnabled && (
				<>
					<HubSpotWidget />
				</>
			)}

			{haveRootAccess === true && <ImpersonationBar />}
		</LicenseProvider>
	);
};
