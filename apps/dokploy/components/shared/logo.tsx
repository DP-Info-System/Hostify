import { cn } from "@/lib/utils";

interface Props {
	className?: string;
	logoUrl?: string;
}

export const Logo = ({ className = "size-14", logoUrl }: Props) => {
	if (logoUrl) {
		return (
			// biome-ignore lint/performance/noImgElement: this is for dynamic logo loading
			<img
				src={logoUrl}
				alt="Organization Logo"
				className={cn(className, "object-contain rounded-sm")}
			/>
		);
	}

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 64 64"
			fill="none"
			className={cn(className, "text-black dark:text-white")}
		>
			<rect x="8" y="20" width="48" height="8" rx="2" fill="currentColor" />
			<rect x="8" y="32" width="48" height="8" rx="2" fill="currentColor" />
			<rect x="8" y="44" width="48" height="8" rx="2" fill="currentColor" />

			<circle cx="14" cy="24" r="1.5" fill="white" />
			<circle cx="18" cy="24" r="1.5" fill="white" />
			<circle cx="14" cy="36" r="1.5" fill="white" />
			<circle cx="18" cy="36" r="1.5" fill="white" />
			<circle cx="14" cy="48" r="1.5" fill="white" />
			<circle cx="18" cy="48" r="1.5" fill="white" />

			<g transform="translate(32,12)">
				<circle r="6" fill="currentColor" />
				<circle r="3" fill="white" />
			</g>
		</svg>
	);
};
