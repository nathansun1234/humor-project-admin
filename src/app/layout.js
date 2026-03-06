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
        const theme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'light';
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.style.colorScheme = theme;
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
