import "./globals.css";

export const metadata = {
  title: "humorproject-admin",
  description: "humorproject admin app",
};

export default function RootLayout({ children }) {
  const themeBootScript = `
    (() => {
      try {
        const storedTheme = localStorage.getItem('ui-theme');
        const preference =
          storedTheme === 'dark' || storedTheme === 'light' || storedTheme === 'system'
            ? storedTheme
            : 'system';
        const prefersDark =
          preference === 'system' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.style.colorScheme = theme;
        root.dataset.themePreference = preference;
      } catch {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
