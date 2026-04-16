import { Copy, Key, Loader2, ShieldCheck, CheckCircle2, Calendar, CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { useLicense } from "@/components/shared/license-provider";
import { Badge } from "@/components/ui/badge";

export function LicenseKeySettings() {
	const { licenseData, isLicenseActive, isLoading, email } = useLicense();
	const [copiedField, setCopiedField] = useState<string | null>(null);

	const copyToClipboard = async (text: string, field: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedField(field);
			toast.success(`${field} copied to clipboard`);
			setTimeout(() => setCopiedField(null), 2000);
		} catch (err) {
			toast.error("Failed to copy");
		}
	};

	const formatDate = (dateStr?: string) => {
		if (!dateStr) return "N/A";
		return new Intl.DateTimeFormat("en-US", {
			dateStyle: "long",
			timeStyle: "short",
		}).format(new Date(dateStr));
	};

	if (isLoading) {
		return (
			<div className="flex flex-col items-center gap-4 justify-center min-h-[30vh]">
				<Loader2 className="size-8 text-muted-foreground animate-spin" />
				<p className="text-sm text-muted-foreground">Fetching license details...</p>
			</div>
		);
	}

	if (isLicenseActive && licenseData) {
		return (
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="rounded-full bg-primary/10 p-2 text-primary">
								<CheckCircle2 className="size-6" />
							</div>
							<div>
								<CardTitle className="text-2xl font-bold italic tracking-tight uppercase">
									Hostify Pro
								</CardTitle>
							</div>
						</div>
						<Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 text-sm font-semibold capitalize">
							{licenseData.status || "Active"}
						</Badge>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
						<div className="space-y-4">
							<div className="space-y-1">
								<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">License Key</label>
								<div className="flex items-center gap-2 group">
									<code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all border border-muted-foreground/10">
										{licenseData.license_key || "N/A"}
									</code>
									<Button
										variant="ghost"
										size="icon"
										className="shrink-0"
										onClick={() => copyToClipboard(licenseData.license_key || "", "License Key")}
									>
										<Copy className="size-4" />
									</Button>
								</div>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subscription ID</label>
								<div className="flex items-center gap-2">
									<code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all border border-muted-foreground/10 text-muted-foreground">
										{licenseData.subscription_id || "N/A"}
									</code>
									<Button
										variant="ghost"
										size="icon"
										className="shrink-0"
										onClick={() => copyToClipboard(licenseData.subscription_id || "", "Subscription ID")}
									>
										<Copy className="size-4" />
									</Button>
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-4">
							<div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
								<Calendar className="size-5 text-muted-foreground shrink-0 mt-0.5" />
								<div className="space-y-1">
									<p className="text-sm font-medium">Valid Until</p>
									<p className="text-xs text-muted-foreground italic">
										{formatDate(licenseData.expires_at)}
									</p>
									{licenseData.grace_until && (
										<p className="text-[10px] text-amber-500/80 font-medium pt-1">
											(Grace period ends: {formatDate(licenseData.grace_until)})
										</p>
									)}
								</div>
							</div>
							
							<div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
								<div className="flex items-center gap-3">
									<CreditCard className="size-5 text-muted-foreground" />
									<p className="text-sm font-medium">Billing Account</p>
								</div>
								<p className="text-sm text-muted-foreground">{email}</p>
							</div>
						</div>
					</div>

				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 rounded-lg border p-4 bg-muted/10">
			<div className="flex flex-col items-center gap-4 justify-center min-h-[40vh] text-center">
				<div className="flex flex-col items-center gap-4 max-w-[450px]">
					<div className="rounded-full bg-muted p-6 shadow-inner">
						<ShieldCheck className="size-12 text-muted-foreground/50" />
					</div>
					<div className="space-y-2">
						<h3 className="text-2xl font-bold tracking-tight">Enterprise Features</h3>
						<p className="text-balance text-muted-foreground">
							Unlock the power of Hostify with persistent license management, 
							shared whitelabeling, and priority cloud activation.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4 w-full max-w-[400px] py-4">
				    <div className="flex flex-col items-center gap-1 p-3 rounded-lg border bg-card">
				        <div className="text-xs font-bold text-primary">SSO</div>
				        <div className="text-[10px] text-muted-foreground">Single Sign-On</div>
				    </div>
				    <div className="flex flex-col items-center gap-1 p-3 rounded-lg border bg-card">
				        <div className="text-xs font-bold text-primary">Branding</div>
				        <div className="text-[10px] text-muted-foreground">Whitelabeling</div>
				    </div>
				</div>

				<Button asChild className="w-full max-w-[280px]" size="lg">
					<Link href="/">Activate Subscription</Link>
				</Button>
				
				<p className="text-xs text-muted-foreground">
					Need help? Contact <Link href="mailto:support@dpinfosystem.in" className="underline underline-offset-4">Support</Link>
				</p>
			</div>
		</div>
	);
}
