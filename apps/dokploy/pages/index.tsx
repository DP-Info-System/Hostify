import { IS_CLOUD, isAdminPresent } from "@dokploy/server";
import { validateRequest } from "@dokploy/server/lib/auth";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import type { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { type ReactElement, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { OnboardingLayout } from "@/components/layouts/onboarding-layout";
import { SignInWithGithub } from "@/components/proprietary/auth/sign-in-with-github";
import { SignInWithGoogle } from "@/components/proprietary/auth/sign-in-with-google";
import { SignInWithSSO } from "@/components/proprietary/sso/sign-in-with-sso";
import { AlertBlock } from "@/components/shared/alert-block";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { api } from "@/utils/api";
import { useWhitelabelingPublic } from "@/utils/hooks/use-whitelabeling";

const LoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

const _TwoFactorSchema = z.object({
	code: z.string().min(6),
});

type LoginForm = z.infer<typeof LoginSchema>;

interface Props {
	IS_CLOUD: boolean;
}
export default function Home({ IS_CLOUD }: Props) {
	const router = useRouter();
	const { config: whitelabeling } = useWhitelabelingPublic();
	const { data: showSignInWithSSO } = api.sso.showSignInWithSSO.useQuery();
	const [isVerifying, setIsVerifying] = useState(false);
	const [isLoginLoading, setIsLoginLoading] = useState(false);
	const [isTwoFactorLoading, setIsTwoFactorLoading] = useState(false);
	const [isBackupCodeLoading, setIsBackupCodeLoading] = useState(false);
	const [isTwoFactor, setIsTwoFactor] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const [isBackupCodeModalOpen, setIsBackupCodeModalOpen] = useState(false);
	const [backupCode, setBackupCode] = useState("");

	const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
	const [syncFirstName, setSyncFirstName] = useState("");
	const [syncLastName, setSyncLastName] = useState("");
	const [credentials, setCredentials] = useState<{ email: string; password?: string } | null>(null);
	const loginForm = useForm<LoginForm>({
		resolver: zodResolver(LoginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const pollStatus = async (email: string) => {
		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;
		if (!externalApiUrl) return;

		const interval = setInterval(async () => {
			try {
				const statusRes = await fetch(`${externalApiUrl}/api/auth/status/${email}`);
				const statusData = await statusRes.json();
				if (statusData?.success && statusData?.user?.status?.toLowerCase() === "active") {
					clearInterval(interval);
					toast.success("Account activated successfully!");
					router.push("/dashboard/projects");
				}
			} catch (e) {
				console.error("Polling failed", e);
			}
		}, 5000);
	};

	const initiateSubscription = async (email: string, firstName?: string, lastName?: string) => {
		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;
		const instanceId = whitelabeling?.id;
		if (!externalApiUrl) return;

		try {
			const subRes = await fetch(`${externalApiUrl}/api/subscription`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: email,
					instance_id: instanceId || "unknown-instance",
				}),
			});
			if (!subRes.ok) throw new Error("Subscription failed");
			const subData = await subRes.json();

			if (subData?.subscription_id) {
				const options = {
					key: subData.key,
					subscription_id: subData.subscription_id,
					name: "Hostify Pro",
					prefill: {
						name: `${firstName || "User"} ${lastName || ""}`,
						email: email,
					},
					handler: () => {
						toast.info("Payment processed, verifying activation...");
					},
				};
				const rzp = new (window as any).Razorpay(options);
				rzp.open();
				pollStatus(email);
			}
		} catch (subErr) {
			console.error("Subscription initiate failed", subErr);
			toast.error("Cloud backend unreachable. Check your CORS.");
		}
	};

	const syncAndCheckLicense = async (email: string, password?: string) => {
		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;
		const instanceId = whitelabeling?.id;

		if (externalApiUrl) {
			try {
				const statusRes = await fetch(
					`${externalApiUrl}/api/auth/status/${email}`,
				);
				const statusData = await statusRes.json();

				const userExists = statusRes.status === 200 && statusData?.user?.email;
				const currentStatus = statusData?.user?.status;
				const isAlreadyActive = currentStatus?.toLowerCase() === "active";

				console.log("Activation path check:", { userExists, currentStatus, isAlreadyActive });

				// 1. If user is NOT ACTIVE (Missing or Pending), show Sync POPUP Modal
				// This ensures they have a profile synced before paying
				if (!isAlreadyActive) {
					if (password) {
						setCredentials({ email, password });
						// Pre-fill names if they exist in the backend already
						setSyncFirstName(statusData?.user?.firstName || "");
						setSyncLastName(statusData?.user?.lastName || "");
						setIsSyncModalOpen(true);
					} else {
						// Fallback for session/2FA path without password
						setIsVerifying(true);
						await initiateSubscription(email);
					}
					return;
				}
			} catch (e) {
				console.error("License sync failed", e);
			}
		}

		toast.success("Logged in successfully");
		router.push("/dashboard/projects");
	};

	const onSyncSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!syncFirstName || !syncLastName || !credentials) return;

		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;
		const instanceId = whitelabeling?.id;

		try {
			setIsLoginLoading(true);
			// 1. Signup in external backend
			const signupRes = await fetch(`${externalApiUrl}/api/auth/signup`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					firstName: syncFirstName,
					lastName: syncLastName,
					email: credentials.email,
					password: credentials.password,
					confirmPassword: credentials.password,
				}),
			});

			if (!signupRes.ok) throw new Error("Failed to create external profile");

			// 2. Clear modal and show verification
			setIsSyncModalOpen(false);
			setIsVerifying(true);

			await initiateSubscription(credentials.email, syncFirstName, syncLastName);
		} catch (err) {
			console.error("Profile sync failed", err);
			toast.error("Sync failed. Please try again.");
		} finally {
			setIsLoginLoading(false);
		}
	};

	const onSubmit = async (values: LoginForm) => {
		setIsLoginLoading(true);
		try {
			const { data, error } = await authClient.signIn.email({
				email: values.email,
				password: values.password,
			});

			if (error) {
				toast.error(error.message);
				setError(error.message || "An error occurred while logging in");
				return;
			}

			// @ts-ignore
			if (data?.twoFactorRedirect as boolean) {
				setTwoFactorCode("");
				setIsTwoFactor(true);
				toast.info("Please enter your 2FA code");
				return;
			}

			await syncAndCheckLicense(values.email, values.password);
		} catch {
			toast.error("An error occurred while logging in");
		} finally {
			setIsLoginLoading(false);
		}
	};
	const onTwoFactorSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (twoFactorCode.length !== 6) {
			toast.error("Please enter a valid 6-digit code");
			return;
		}

		setIsTwoFactorLoading(true);
		try {
			const { error } = await authClient.twoFactor.verifyTotp({
				code: twoFactorCode.replace(/\s/g, ""),
			});

			if (error) {
				toast.error(error.message);
				setError(error.message || "An error occurred while verifying 2FA code");
				return;
			}

			await syncAndCheckLicense(loginForm.getValues().email);
		} catch {
			toast.error("An error occurred while verifying 2FA code");
		} finally {
			setIsTwoFactorLoading(false);
		}
	};

	const onBackupCodeSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (backupCode.length < 8) {
			toast.error("Please enter a valid backup code");
			return;
		}

		setIsBackupCodeLoading(true);
		try {
			const { error } = await authClient.twoFactor.verifyBackupCode({
				code: backupCode.trim(),
			});

			if (error) {
				toast.error(error.message);
				setError(
					error.message || "An error occurred while verifying backup code",
				);
				return;
			}

			await syncAndCheckLicense(loginForm.getValues().email);
		} catch {
			toast.error("An error occurred while verifying backup code");
		} finally {
			setIsBackupCodeLoading(false);
		}
	};

	const loginContent = (
		<>
			{IS_CLOUD && <SignInWithGithub />}
			{IS_CLOUD && <SignInWithGoogle />}
			<Form {...loginForm}>
				<form
					onSubmit={loginForm.handleSubmit(onSubmit)}
					className="space-y-4"
					id="login-form"
				>
					<FormField
						control={loginForm.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input placeholder="john@example.com" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={loginForm.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Password</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Enter your password"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button className="w-full" type="submit" isLoading={isLoginLoading}>
						Login
					</Button>
				</form>
			</Form>
		</>
	);

	return (
		<>
			<div className="flex flex-col space-y-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">
					<div className="flex flex-row items-center justify-center gap-2">
						<Logo
							className="size-12"
							logoUrl={
								whitelabeling?.loginLogoUrl ||
								whitelabeling?.logoUrl ||
								undefined
							}
						/>
						Sign in
					</div>
				</h1>
				<p className="text-sm text-muted-foreground">
					Enter your email and password to sign in
				</p>
			</div>
			{error && (
				<AlertBlock type="error" className="my-2">
					<span>{error}</span>
				</AlertBlock>
			)}
			<CardContent className="p-0">
				{isVerifying ? (
					<div className="flex flex-col items-center justify-center space-y-4 py-8">
						<div className="flex flex-col items-center gap-2">
							<Logo className="size-16 animate-pulse" />
							<h2 className="text-xl font-semibold">Verifying activation...</h2>
							<p className="text-center text-sm text-muted-foreground px-4">
								Please complete the payment in the window. <br />
								We are waiting for your account to become active.
							</p>
						</div>
						<Button
							variant="ghost"
							onClick={() => window.location.reload()}
							className="text-xs text-muted-foreground hover:underline"
						>
							Reload page if stuck
						</Button>
					</div>
				) : (
					<>
						{!isTwoFactor ? (
							<>
								{showSignInWithSSO ? (
									<SignInWithSSO>{loginContent}</SignInWithSSO>
								) : (
									loginContent
								)}
							</>
						) : (
							<>
								<form
									onSubmit={onTwoFactorSubmit}
									className="space-y-4"
									id="two-factor-form"
									autoComplete="on"
								>
									<div className="flex flex-col gap-2">
										<Label htmlFor="totp-code">2FA Code</Label>
										<InputOTP
											id="totp-code"
											name="totp"
											value={twoFactorCode}
											onChange={setTwoFactorCode}
											maxLength={6}
											placeholder="••••••"
											pattern={REGEXP_ONLY_DIGITS}
											autoFocus
										/>
										<CardDescription>
											Enter the 6-digit code from your authenticator app
										</CardDescription>
										<button
											type="button"
											onClick={() => setIsBackupCodeModalOpen(true)}
											className="text-sm text-muted-foreground hover:underline self-start mt-2"
										>
											Lost access to your authenticator app?
										</button>
									</div>

									<div className="flex gap-4">
										<Button
											variant="outline"
											className="w-full"
											type="button"
											onClick={() => {
												setIsTwoFactor(false);
												setTwoFactorCode("");
											}}
										>
											Back
										</Button>
										<Button
											className="w-full"
											type="submit"
											isLoading={isTwoFactorLoading}
										>
											Verify
										</Button>
									</div>
								</form>

								<Dialog
									open={isBackupCodeModalOpen}
									onOpenChange={setIsBackupCodeModalOpen}
								>
									<DialogContent>
										<DialogHeader>
											<DialogTitle>Enter Backup Code</DialogTitle>
											<DialogDescription>
												Enter one of your backup codes to access your account
											</DialogDescription>
										</DialogHeader>

										<form onSubmit={onBackupCodeSubmit} className="space-y-4">
											<div className="flex flex-col gap-2">
												<Label>Backup Code</Label>
												<Input
													value={backupCode}
													onChange={(e) => setBackupCode(e.target.value)}
													placeholder="Enter your backup code"
													className="font-mono"
												/>
												<CardDescription>
													Enter one of the backup codes you received when
													setting up 2FA
												</CardDescription>
											</div>

											<div className="flex gap-4">
												<Button
													variant="outline"
													className="w-full"
													type="button"
													onClick={() => {
														setIsBackupCodeModalOpen(false);
														setBackupCode("");
													}}
												>
													Cancel
												</Button>
												<Button
													className="w-full"
													type="submit"
													isLoading={isBackupCodeLoading}
												>
													Verify
												</Button>
											</div>
										</form>
									</DialogContent>
								</Dialog>
							</>
						)}

						<div className="flex flex-row justify-between flex-wrap">
							<div className="mt-4 text-center text-sm flex flex-row justify-center gap-2">
								{IS_CLOUD ? (
									<Link
										className="hover:underline text-muted-foreground"
										href="/register"
									>
										Create an account
									</Link>
								) : (
									<div />
								)}
							</div>

							<div className="mt-4 text-sm flex flex-row justify-center gap-2">
								{IS_CLOUD ? (
									<Link
										className="hover:underline text-muted-foreground"
										href="/send-reset-password"
									>
										Lost your password?
									</Link>
								) : (
									<Link
										className="hover:underline text-muted-foreground"
										href=""
										target="_blank"
									>
										Lost your password?
									</Link>
								)}
							</div>
						</div>
					</>
				)}
				<div className="p-2" />
			</CardContent>
			<Dialog open={isSyncModalOpen} onOpenChange={() => {}}>
				<DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
					<DialogHeader>
						<DialogTitle>Complete Your Profile</DialogTitle>
						<DialogDescription>
							Provide your details to sync with our activation system.
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={onSyncSubmit} className="space-y-4 pt-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="syncFirstName">First Name</Label>
								<Input
									id="syncFirstName"
									placeholder="John"
									value={syncFirstName}
									onChange={(e) => setSyncFirstName(e.target.value)}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="syncLastName">Last Name</Label>
								<Input
									id="syncLastName"
									placeholder="Doe"
									value={syncLastName}
									onChange={(e) => setSyncLastName(e.target.value)}
									required
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Email</Label>
							<Input value={credentials?.email} disabled />
						</div>
						<Button type="submit" className="w-full" isLoading={isLoginLoading}>
							Submit & Activate
						</Button>
						<Button
							type="button"
							variant="outline"
							className="w-full"
							onClick={() => setIsSyncModalOpen(false)}
						>
							Cancel
						</Button>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}

Home.getLayout = (page: ReactElement) => {
	return <OnboardingLayout>{page}</OnboardingLayout>;
};
export async function getServerSideProps(context: GetServerSidePropsContext) {
	if (IS_CLOUD) {
		try {
			const { user } = await validateRequest(context.req);
			if (user) {
				return {
					redirect: {
						permanent: true,
						destination: "/dashboard/projects",
					},
				};
			}
		} catch {}

		return {
			props: {
				IS_CLOUD: IS_CLOUD,
			},
		};
	}
	const hasAdmin = await isAdminPresent();

	if (!hasAdmin) {
		return {
			redirect: {
				permanent: true,
				destination: "/register",
			},
		};
	}

	const { user } = await validateRequest(context.req);

	if (user) {
		return {
			redirect: {
				permanent: true,
				destination: "/dashboard/projects",
			},
		};
	}

	return {
		props: {
			hasAdmin,
		},
	};
}
