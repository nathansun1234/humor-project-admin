import "./globals.css";

export const metadata = {
  title: "humorproject-admin",
  description: "humorproject admin app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
