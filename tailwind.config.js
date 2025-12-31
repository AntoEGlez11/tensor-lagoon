/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{html,ts}",
    ],
    theme: {
        extend: {
            colors: {
                // Automotive Theme Colors
                'auto-black': '#0a0a0a',
                'auto-carbon': '#1a1a1a',
                'auto-metallic': '#2d2d2d',
                'auto-accent': '#ff3e3e', // Red accent
                'auto-gray': '#888888',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
