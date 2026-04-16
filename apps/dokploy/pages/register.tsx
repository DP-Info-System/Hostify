import { IS_CLOUD, isAdminPresent, validateRequest } from "@dokploy/server";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { AlertTriangle } from "lucide-react";
import type { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { type ReactElement, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { OnboardingLayout } from "@/components/layouts/onboarding-layout";
import { SignInWithGithub } from "@/components/proprietary/auth/sign-in-with-github";
import { SignInWithGoogle } from "@/components/proprietary/auth/sign-in-with-google";
import { AlertBlock } from "@/components/shared/alert-block";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useWhitelabelingPublic } from "@/utils/hooks/use-whitelabeling";

const registerSchema = z
	.object({
		name: z.string().min(1, {
			message: "First name is required",
		}),
		lastName: z.string().min(1, {
			message: "Last name is required",
		}),
		email: z
			.string()
			.min(1, {
				message: "Email is required",
			})
			.email({
				message: "Email must be a valid email",
			}),
		password: z
			.string()
			.min(1, {
				message: "Password is required",
			})
			.refine((password) => password === "" || password.length >= 8, {
				message: "Password must be at least 8 characters",
			}),
		confirmPassword: z
			.string()
			.min(1, {
				message: "Password is required",
			})
			.refine(
				(confirmPassword) =>
					confirmPassword === "" || confirmPassword.length >= 8,
				{
					message: "Password must be at least 8 characters",
				},
			),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type Register = z.infer<typeof registerSchema>;

interface Props {
	hasAdmin: boolean;
	isCloud: boolean;
}

const Register = ({ isCloud }: Props) => {
	const router = useRouter();
	const { config: whitelabeling } = useWhitelabelingPublic();
	const [isError, setIsError] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);
	const [data, setData] = useState<any>(null);

	const form = useForm<Register>({
		defaultValues: {
			name: "",
			lastName: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
		resolver: zodResolver(registerSchema),
	});

	useEffect(() => {
		form.reset();
	}, [form, form.reset, form.formState.isSubmitSuccessful]);

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

	const syncAndCheckLicense = async (values: Register) => {
		const externalApiUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;
		const instanceId = whitelabeling?.id;

		if (externalApiUrl) {
			try {
				// 1. Check current status
				const statusRes = await fetch(
					`${externalApiUrl}/api/auth/status/${values.email}`,
				);
				const statusData = await statusRes.json();

				const userExists = statusRes.ok && statusData?.success;
				const currentStatus = statusData?.user?.status;
				const isAlreadyActive = currentStatus?.toLowerCase() === "active";

				// 2. Register if user is totally missing
				if (!userExists) {
					await fetch(`${externalApiUrl}/api/auth/signup`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							firstName: values.name,
							lastName: values.lastName,
							email: values.email,
							password: values.password,
							confirmPassword: values.confirmPassword,
						}),
					});
				}

				if (currentStatus?.toLowerCase() !== "active") {
					setIsVerifying(true);
					try {
						const subRes = await fetch(`${externalApiUrl}/api/subscription`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								email: values.email,
								instance_id: instanceId || "unknown-instance",
							}),
						});
						if (!subRes.ok) throw new Error("Subscription initiation failed");
						const subData = await subRes.json();

						if (subData?.subscription_id) {
							const options = {
								key: subData.key,
								subscription_id: subData.subscription_id,
								name: "Hostify Pro",
								handler: () => {
									toast.info("Payment processed, verifying activation...");
								},
							};
							const rzp = new (window as any).Razorpay(options);
							rzp.open();
							pollStatus(values.email);
							return; // Block redirect
						}
					} catch (subErr) {
						console.error("Subscription initiate failed", subErr);
						toast.error("Cloud backend is currently unreachable. Please try again later.");
						return;
					}
				}
			} catch (e) {
				console.error("License sync failed", e);
				toast.error("Internal verification error. Please contact support.");
				return; // Block redirect on error
			}
		}

		toast.success("User registered successfully");
		if (!isCloud) {
			router.push("/");
		} else {
			// This branch is for cloud users which we didn't touch
			console.log("Cloud redirect");
		}
	};

	const onSubmit = async (values: Register) => {
		const { error } = await authClient.signUp.email({
			email: values.email,
			password: values.password,
			name: values.name,
			lastName: values.lastName,
		});

		if (error) {
			setIsError(true);
			setError(error.message || "An error occurred");
		} else {
			await syncAndCheckLicense(values);
		}
	};
	return (
		<div className="">
			<div className="flex  w-full items-center justify-center ">
				<div className="flex flex-col items-center gap-4 w-full">
					<CardTitle className="text-2xl font-bold flex  items-center gap-2">
						<Link href="/" className="flex flex-row items-center gap-2">
							<Logo
								className="size-12"
								logoUrl={
									whitelabeling?.loginLogoUrl ||
									whitelabeling?.logoUrl ||
									undefined
								}
							/>
						</Link>
						{isCloud ? "Sign Up" : "Setup the server"}
					</CardTitle>
					<CardDescription>
						Enter your email and password to{" "}
						{isCloud ? "create an account" : "setup the server"}
					</CardDescription>
					<div className="mx-auto w-full max-w-lg bg-transparent">
						{isError && (
							<div className="my-2 flex flex-row items-center gap-2 rounded-lg bg-red-50 p-2 dark:bg-red-950">
								<AlertTriangle className="text-red-600 dark:text-red-400" />
								<span className="text-sm text-red-600 dark:text-red-400">
									{error}
								</span>
							</div>
						)}
						{isCloud && data && (
							<AlertBlock type="success" className="my-2">
								<span>
									Registered successfully, please check your inbox or spam
									folder to confirm your account.
								</span>
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
									{isCloud && (
										<div className="flex flex-col">
											<SignInWithGithub />
											<SignInWithGoogle />
										</div>
									)}
									{isCloud && (
										<p className="mb-4 text-center text-xs text-muted-foreground">
											Or register with email
										</p>
									)}
									<Form {...form}>
										<form
											onSubmit={form.handleSubmit(onSubmit)}
											className="grid gap-4"
										>
											<div className="space-y-4">
												<FormField
													control={form.control}
													name="name"
													render={({ field }) => (
														<FormItem>
															<FormLabel>First Name</FormLabel>
															<FormControl>
																<Input placeholder="John" {...field} />
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
												<FormField
													control={form.control}
													name="lastName"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Last Name</FormLabel>
															<FormControl>
																<Input placeholder="Doe" {...field} />
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
												<FormField
													control={form.control}
													name="email"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Email</FormLabel>
															<FormControl>
																<Input
																	placeholder="email@hostify.com"
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
												<FormField
													control={form.control}
													name="password"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Password</FormLabel>
															<FormControl>
																<Input
																	type="password"
																	placeholder="Password"
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>

												<FormField
													control={form.control}
													name="confirmPassword"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Confirm Password</FormLabel>
															<FormControl>
																<Input
																	type="password"
																	placeholder="Password"
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>

												<Button
													type="submit"
													isLoading={form.formState.isSubmitting}
													className="w-full"
												>
													Register
												</Button>
											</div>
										</form>
									</Form>
								</>
							)}
							<div className="flex flex-row justify-between flex-wrap">
								{isCloud && (
									<div className="mt-4 text-center text-sm flex gap-2 text-muted-foreground">
										Already have account?
										<Link className="underline" href="/">
											Sign in
										</Link>
									</div>
								)}

								<div className="mt-4 text-center text-sm flex flex-row justify-center gap-2  text-muted-foreground">
									Need help?
									<Link
										className="underline"
										href="https://hostify.com"
										target="_blank"
									>
										Contact Hostify
									</Link>
								</div>
							</div>
						</CardContent>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Register;

Register.getLayout = (page: ReactElement) => {
	return <OnboardingLayout>{page}</OnboardingLayout>;
};
export async function getServerSideProps(context: GetServerSidePropsContext) {
	if (IS_CLOUD) {
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
				isCloud: true,
			},
		};
	}
	const hasAdmin = await isAdminPresent();

	if (hasAdmin) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}
	return {
		props: {
			isCloud: false,
		},
	};
}
