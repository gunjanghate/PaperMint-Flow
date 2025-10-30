/** @type {import('next').NextConfig} */
const nextConfig = {
    // Ensure Next.js uses this project folder as the workspace root
    outputFileTracingRoot: process.cwd(),
    eslint: {
        // Avoid failing production builds due to ESLint errors
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
