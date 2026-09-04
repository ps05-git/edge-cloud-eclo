export const metadata = {
  title: "Edge-Cloud ECLO Scheduler",
  description: "Priority-based edge-cloud scheduling with dynamic VM allocation"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}