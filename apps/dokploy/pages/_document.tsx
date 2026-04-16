import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
	return (
		<Html lang="en" className="font-sans">
			<Head>
				<link rel="icon" type="image/svg+xml" href="/icon.svg?v=2" />
				<script
					src="https://checkout.razorpay.com/v1/checkout.js"
					async
					defer
				/>
			</Head>
			<body className="flex h-full w-full flex-col font-sans">
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
