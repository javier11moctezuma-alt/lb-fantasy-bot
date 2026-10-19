export const metadata = {
  title: "LB Fantasy Bot",
  description: "Dashboard de ESPN Fantasy Basketball"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#10101a", color: "#f5f5f7", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
